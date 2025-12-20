import Game, { createPlayers } from '../models/Game.js';
import Action, { ActionTypes } from '../models/Action.js';

/**
 * Apply an action to a game state
 * Returns the new state (does not mutate)
 */
function applyAction(game, action) {
  const players = game.players.map(p => ({ ...p.toObject ? p.toObject() : p }));
  
  switch (action.type) {
    case ActionTypes.CHANGE_LIFE: {
      const { delta } = action.payload;
      players[action.playerIndex].life += delta;
      break;
    }
    
    case ActionTypes.CHANGE_COMMANDER_DAMAGE: {
      const { fromPlayerIndex, delta } = action.payload;
      const newDamage = players[action.playerIndex].commanderDamage[fromPlayerIndex] + delta;
      players[action.playerIndex].commanderDamage[fromPlayerIndex] = Math.max(0, newDamage);
      // Note: Life change is handled separately via CHANGE_LIFE action
      // The frontend sends both the life change and commander damage change
      break;
    }
    
    case ActionTypes.SET_PLAYER_NAME: {
      const { name } = action.payload;
      players[action.playerIndex].name = name;
      break;
    }
    
    case ActionTypes.RESET_GAME: {
      const startingLife = game.startingLife;
      const playerCount = game.playerCount;
      for (let i = 0; i < players.length; i++) {
        players[i].life = startingLife;
        players[i].commanderDamage = new Array(playerCount).fill(0);
      }
      break;
    }
  }
  
  return players;
}

/**
 * Submit an action and apply it to the game
 * Uses optimistic concurrency with retry
 */
export async function submitAction(gameCode, actionType, playerIndex, payload, clientId) {
  const code = gameCode.toUpperCase();
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get current game state
      const game = await Game.findOne({ code });
      if (!game) {
        throw new Error('Game not found');
      }
      
      // Increment sequence
      const sequence = game.sequence + 1;
      
      // Create the action
      const action = new Action({
        gameCode: code,
        type: actionType,
        playerIndex,
        payload,
        sequence,
        clientId
      });
      
      // Apply action to compute new state
      const newPlayers = applyAction(game, action);
      
      // Optimistic update with version check
      const result = await Game.findOneAndUpdate(
        { code, version: game.version },
        {
          $set: { players: newPlayers },
          $inc: { version: 1, sequence: 1 }
        },
        { new: true }
      );
      
      if (!result) {
        // Version conflict - retry
        console.log(`Version conflict on game ${code}, attempt ${attempt + 1}`);
        continue;
      }
      
      // Save the action to history
      await action.save();
      
      return { game: result, action };
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to submit action after retries');
}

/**
 * Get action history for a game
 */
export async function getActionHistory(gameCode, fromSequence = 0, limit = 100) {
  const code = gameCode.toUpperCase();
  return Action.find({ 
    gameCode: code,
    sequence: { $gt: fromSequence }
  })
    .sort({ sequence: 1 })
    .limit(limit);
}

/**
 * Rebuild game state from action history
 * Useful for recovery or verification
 */
export async function rebuildGameState(gameCode) {
  const code = gameCode.toUpperCase();
  const game = await Game.findOne({ code });
  if (!game) {
    throw new Error('Game not found');
  }
  
  // Get initial state
  const initialPlayers = createPlayers(game.playerCount, game.startingLife);
  
  // Get all actions
  const actions = await Action.find({ gameCode: code }).sort({ sequence: 1 });
  
  // Replay actions
  let players = initialPlayers;
  for (const action of actions) {
    players = applyAction({ ...game.toObject(), players }, action);
  }
  
  return {
    ...game.toObject(),
    players,
    rebuiltFromActions: true,
    actionCount: actions.length
  };
}

/**
 * Sync a client that may have missed updates
 * Returns actions since a given sequence
 */
export async function syncClient(gameCode, clientSequence) {
  const code = gameCode.toUpperCase();
  const game = await Game.findOne({ code });
  if (!game) {
    throw new Error('Game not found');
  }
  
  // If client is too far behind, just send current state
  if (game.sequence - clientSequence > 50) {
    return {
      type: 'FULL_SYNC',
      game
    };
  }
  
  // Otherwise send missed actions
  const missedActions = await getActionHistory(code, clientSequence);
  
  return {
    type: 'INCREMENTAL_SYNC',
    actions: missedActions,
    currentSequence: game.sequence
  };
}

