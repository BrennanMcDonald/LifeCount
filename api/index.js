import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Game, { createPlayers } from './models/Game.js';

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
      players: createPlayers(playerCount, startingLife)
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
    const game = await Game.findOne({ code: req.params.code.toUpperCase() });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const startingLife = game.startingLife;
    const playerCount = game.playerCount || game.players.length;
    
    game.players = game.players.map(player => ({
      ...player.toObject(),
      life: startingLife,
      commanderDamage: new Array(playerCount).fill(0)
    }));
    
    await game.save();
    
    // Broadcast reset to all clients in the game room
    io.to(game.code).emit('gameUpdate', game);
    
    res.json(game);
  } catch (error) {
    console.error('Error resetting game:', error);
    res.status(500).json({ error: 'Failed to reset game' });
  }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join a game room
  socket.on('joinGame', async (gameCode) => {
    const code = gameCode.toUpperCase();
    socket.join(code);
    console.log(`Socket ${socket.id} joined game ${code}`);
    
    // Send current game state
    const game = await Game.findOne({ code });
    if (game) {
      socket.emit('gameUpdate', game);
    }
  });
  
  // Leave a game room
  socket.on('leaveGame', (gameCode) => {
    socket.leave(gameCode.toUpperCase());
    console.log(`Socket ${socket.id} left game ${gameCode}`);
  });
  
  // Update player life
  socket.on('updateLife', async ({ gameCode, playerIndex, life }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      game.players[playerIndex].life = life;
      await game.save();
      
      // Broadcast to all clients in the room
      io.to(code).emit('gameUpdate', game);
    } catch (error) {
      console.error('Error updating life:', error);
    }
  });
  
  // Update commander damage
  socket.on('updateCommanderDamage', async ({ gameCode, playerIndex, commanderDamage }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      game.players[playerIndex].commanderDamage = commanderDamage;
      await game.save();
      
      // Broadcast to all clients in the room
      io.to(code).emit('gameUpdate', game);
    } catch (error) {
      console.error('Error updating commander damage:', error);
    }
  });
  
  // Update player (life + commander damage together)
  socket.on('updatePlayer', async ({ gameCode, playerIndex, life, commanderDamage }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      if (life !== undefined) {
        game.players[playerIndex].life = life;
      }
      if (commanderDamage !== undefined) {
        game.players[playerIndex].commanderDamage = commanderDamage;
      }
      
      await game.save();
      
      // Broadcast to all clients in the room
      io.to(code).emit('gameUpdate', game);
    } catch (error) {
      console.error('Error updating player:', error);
    }
  });
  
  // Update player name
  socket.on('updatePlayerName', async ({ gameCode, playerIndex, name }) => {
    try {
      const code = gameCode.toUpperCase();
      const game = await Game.findOne({ code });
      if (!game) return;
      
      game.players[playerIndex].name = name;
      await game.save();
      
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

