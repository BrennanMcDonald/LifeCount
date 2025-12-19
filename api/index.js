import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Game, { createPlayers } from './models/Game.js';
import { ActionTypes } from './models/Action.js';
import { 
  submitAction, 
  getActionHistory, 
  rebuildGameState,
  syncClient 
} from './services/gameService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lifecount';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Generate random game code
function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// REST API Routes

// Create new game
app.post('/api/games', async (req, res) => {
  try {
    let code;
    let attempts = 0;
    
    // Generate unique code
    do {
      code = generateGameCode();
      attempts++;
    } while (await Game.findOne({ code }) && attempts < 10);
    
    if (attempts >= 10) {
      return res.status(500).json({ error: 'Could not generate unique game code' });
    }

    const startingLife = req.body.startingLife || 40;
    const playerCount = Math.min(4, Math.max(2, req.body.playerCount || 4));
    
    const game = new Game({
      code,
      startingLife,
      playerCount,
      players: createPlayers(playerCount, startingLife),
      sequence: 0,
      version: 0
    });
    
    await game.save();
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get game by code
app.get('/api/games/:code', async (req, res) => {
  try {
    const game = await Game.findOne({ code: req.params.code.toUpperCase() });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Reset game
app.post('/api/games/:code/reset', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    
    const { game } = await submitAction(
      code,
      ActionTypes.RESET_GAME,
      null,
      {},
      'api-reset'
    );
    
    // Broadcast reset to all clients in the game room
    io.to(code).emit('gameUpdate', game);
    
    res.json(game);
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: 'Failed to reset game' });
  }
});

// Get action history for a game
app.get('/api/games/:code/history', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const fromSequence = parseInt(req.query.from) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    
    const actions = await getActionHistory(code, fromSequence, limit);
    res.json({ actions, count: actions.length });
  } catch (error) {
    console.error('Error fetching action history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Rebuild game state from actions (for verification/recovery)
app.post('/api/games/:code/rebuild', async (req, res) => {
  try {
    const rebuiltState = await rebuildGameState(req.params.code);
    res.json(rebuiltState);
  } catch (error) {
    console.error('Error rebuilding game state:', error);
    res.status(500).json({ error: 'Failed to rebuild state' });
  }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Track client's known sequence per game for sync
  const clientSequences = new Map();
  
  // Join a game room
  socket.on('joinGame', async (gameCode) => {
    const code = gameCode.toUpperCase();
    socket.join(code);
    console.log(`Socket ${socket.id} joined game ${code}`);
    
    // Send current game state
    const game = await Game.findOne({ code });
    if (game) {
      clientSequences.set(code, game.sequence);
      socket.emit('gameUpdate', game);
    }
  });
  
  // Leave a game room
  socket.on('leaveGame', (gameCode) => {
    const code = gameCode.toUpperCase();
    socket.leave(code);
    clientSequences.delete(code);
    console.log(`Socket ${socket.id} left game ${gameCode}`);
  });
  
  // Sync client that may have missed updates
  socket.on('sync', async ({ gameCode, lastKnownSequence }) => {
    try {
      const syncResult = await syncClient(gameCode, lastKnownSequence);
      socket.emit('syncResponse', syncResult);
      
      if (syncResult.type === 'FULL_SYNC') {
        clientSequences.set(gameCode.toUpperCase(), syncResult.game.sequence);
      } else {
        clientSequences.set(gameCode.toUpperCase(), syncResult.currentSequence);
      }
    } catch (error) {
      console.error('Error syncing client:', error);
      socket.emit('syncError', { message: error.message });
    }
  });
  
  // Submit an action (new transactional approach)
  socket.on('submitAction', async ({ gameCode, actionType, playerIndex, payload }) => {
    try {
      const { game, action } = await submitAction(
        gameCode, 
        actionType, 
        playerIndex, 
        payload, 
        socket.id
      );
      
      // Broadcast action to all clients for real-time updates
      io.to(gameCode.toUpperCase()).emit('actionApplied', {
        action: {
          type: action.type,
          playerIndex: action.playerIndex,
          payload: action.payload,
          sequence: action.sequence,
          timestamp: action.timestamp
        },
        game
      });
    } catch (error) {
      console.error('Error submitting action:', error);
      socket.emit('actionError', { message: error.message });
    }
  });
  
  // Legacy support: Update player life (converts to action)
  socket.on('updateLife', async ({ gameCode, playerIndex, life }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      // Calculate delta from current state
      const currentLife = game.players[playerIndex].life;
      const delta = life - currentLife;
      
      if (delta === 0) return;
      
      const { game: updatedGame, action } = await submitAction(
        code,
        ActionTypes.CHANGE_LIFE,
        playerIndex,
        { delta },
        socket.id
      );
      
      // Broadcast to all clients in the room
      io.to(code).emit('actionApplied', {
        action: {
          type: action.type,
          playerIndex: action.playerIndex,
          payload: action.payload,
          sequence: action.sequence,
          timestamp: action.timestamp
        },
        game: updatedGame
      });
      // Also emit legacy format for backwards compatibility
      io.to(code).emit('gameUpdate', updatedGame);
    } catch (error) {
      console.error('Error updating life:', error);
    }
  });
  
  // Legacy support: Update commander damage (converts to action)
  socket.on('updateCommanderDamage', async ({ gameCode, playerIndex, commanderDamage }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      // Find which commander damage changed and by how much
      const currentDamage = game.players[playerIndex].commanderDamage;
      for (let i = 0; i < commanderDamage.length; i++) {
        const delta = commanderDamage[i] - currentDamage[i];
        if (delta !== 0) {
          const { game: updatedGame } = await submitAction(
            code,
            ActionTypes.CHANGE_COMMANDER_DAMAGE,
            playerIndex,
            { fromPlayerIndex: i, delta },
            socket.id
          );
          io.to(code).emit('gameUpdate', updatedGame);
        }
      }
    } catch (error) {
      console.error('Error updating commander damage:', error);
    }
  });
  
  // Legacy support: Update player (life + commander damage together)
  socket.on('updatePlayer', async ({ gameCode, playerIndex, life, commanderDamage }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      let updatedGame = game;
      
      // Handle life change
      if (life !== undefined) {
        const currentLife = game.players[playerIndex].life;
        const lifeDelta = life - currentLife;
        
        if (lifeDelta !== 0) {
          const result = await submitAction(
            code,
            ActionTypes.CHANGE_LIFE,
            playerIndex,
            { delta: lifeDelta },
            socket.id
          );
          updatedGame = result.game;
        }
      }
      
      // Handle commander damage changes
      if (commanderDamage !== undefined) {
        const currentDamage = updatedGame.players[playerIndex].commanderDamage;
        for (let i = 0; i < commanderDamage.length; i++) {
          const delta = commanderDamage[i] - currentDamage[i];
          if (delta !== 0) {
            const result = await submitAction(
              code,
              ActionTypes.CHANGE_COMMANDER_DAMAGE,
              playerIndex,
              { fromPlayerIndex: i, delta },
              socket.id
            );
            updatedGame = result.game;
          }
        }
      }
      
      // Broadcast final state to all clients
      io.to(code).emit('gameUpdate', updatedGame);
    } catch (error) {
      console.error('Error updating player:', error);
    }
  });
  
  // Legacy support: Update player name
  socket.on('updatePlayerName', async ({ gameCode, playerIndex, name }) => {
    try {
      const code = gameCode.toUpperCase();
      
      const { game } = await submitAction(
        code,
        ActionTypes.SET_PLAYER_NAME,
        playerIndex,
        { name },
        socket.id
      );
      
      // Broadcast to all clients in the room
      io.to(code).emit('gameUpdate', game);
    } catch (error) {
      console.error('Error updating player name:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState === 1 });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});

