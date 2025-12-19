import mongoose from 'mongoose';

// Action types
export const ActionTypes = {
  CHANGE_LIFE: 'CHANGE_LIFE',
  CHANGE_COMMANDER_DAMAGE: 'CHANGE_COMMANDER_DAMAGE',
  SET_PLAYER_NAME: 'SET_PLAYER_NAME',
  RESET_GAME: 'RESET_GAME',
};

const actionSchema = new mongoose.Schema({
  gameCode: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(ActionTypes),
    required: true
  },
  playerIndex: {
    type: Number,
    required: false // Not needed for RESET_GAME
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Sequence number for ordering within a game
  sequence: {
    type: Number,
    required: true
  },
  // Client that submitted this action (for conflict resolution)
  clientId: {
    type: String,
    required: true
  },
  // Timestamp for ordering and debugging
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
actionSchema.index({ gameCode: 1, sequence: 1 });
actionSchema.index({ gameCode: 1, timestamp: 1 });

// TTL index to clean up old actions (match game TTL)
actionSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

const Action = mongoose.model('Action', actionSchema);

export default Action;

