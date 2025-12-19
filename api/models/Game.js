import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Player'
  },
  life: {
    type: Number,
    default: 40
  },
  color: {
    type: String,
    enum: ['crimson', 'ocean', 'forest', 'amber'],
    required: true
  },
  commanderDamage: {
    type: [Number],
    default: [0, 0, 0, 0]
  }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: 4,
    maxlength: 6
  },
  players: {
    type: [playerSchema],
    required: true
  },
  playerCount: {
    type: Number,
    default: 4,
    min: 2,
    max: 4
  },
  startingLife: {
    type: Number,
    default: 40
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Update lastActivity on save
gameSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Index for cleanup of old games
gameSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 }); // 24 hours TTL

// Helper to create players array
export function createPlayers(playerCount, startingLife) {
  const colors = ['crimson', 'ocean', 'forest', 'amber'];
  const players = [];
  
  for (let i = 0; i < playerCount; i++) {
    players.push({
      name: `Player ${i + 1}`,
      life: startingLife,
      color: colors[i],
      commanderDamage: new Array(playerCount).fill(0)
    });
  }
  
  return players;
}

const Game = mongoose.model('Game', gameSchema);

export default Game;
