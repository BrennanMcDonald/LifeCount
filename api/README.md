# Life Counter API

Backend API for the MTG Life Counter with real-time sync using Socket.IO.

## Setup

1. Install dependencies:
```bash
cd api
npm install
```

2. Create a `.env` file with:
```
MONGODB_URI=mongodb://localhost:27017/lifecount
FRONTEND_URL=http://localhost:3000
PORT=3001
```

3. Make sure MongoDB is running locally, or use a MongoDB Atlas connection string.

4. Start the server:
```bash
npm run dev
```

## API Endpoints

### Games

- `POST /api/games` - Create a new game (returns game with unique code)
- `GET /api/games/:code` - Get game by code
- `POST /api/games/:code/reset` - Reset game to starting state

### Health

- `GET /api/health` - Health check endpoint

## Socket.IO Events

### Client → Server

- `joinGame(gameCode)` - Join a game room
- `leaveGame(gameCode)` - Leave a game room
- `updateLife({ gameCode, playerIndex, life })` - Update player life
- `updateCommanderDamage({ gameCode, playerIndex, commanderDamage })` - Update commander damage
- `updatePlayer({ gameCode, playerIndex, life, commanderDamage })` - Update both at once
- `updatePlayerName({ gameCode, playerIndex, name })` - Update player name

### Server → Client

- `gameUpdate(game)` - Broadcasted when game state changes

