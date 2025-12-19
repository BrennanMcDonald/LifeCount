import { io, Socket } from 'socket.io-client'

interface Player {
  name: string
  life: number
  color: 'crimson' | 'ocean' | 'forest' | 'amber'
  commanderDamage: number[]
}

interface Game {
  _id: string
  code: string
  players: Player[]
  startingLife: number
  createdAt: string
  lastActivity: string
}

const socket = ref<Socket | null>(null)
const game = ref<Game | null>(null)
const connected = ref(false)
const currentGameCode = ref<string | null>(null)

export function useGameSocket() {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || '192.168.1.10:3001'

  const connect = () => {
    if (socket.value?.connected) return

    socket.value = io(apiUrl, {
      transports: ['websocket', 'polling']
    })

    socket.value.on('connect', () => {
      connected.value = true
      console.log('Connected to server')
      
      // Rejoin game if we were in one
      if (currentGameCode.value) {
        socket.value?.emit('joinGame', currentGameCode.value)
      }
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      console.log('Disconnected from server')
    })

    socket.value.on('gameUpdate', (updatedGame: Game) => {
      game.value = updatedGame
    })
  }

  const getApiUrl = () => {
    return apiUrl;
  }

  const disconnect = () => {
    if (currentGameCode.value) {
      socket.value?.emit('leaveGame', currentGameCode.value)
    }
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
    game.value = null
    currentGameCode.value = null
  }

  const joinGame = async (gameCode: string) => {
    const code = gameCode.toUpperCase()
    
    // Fetch initial game state via REST
    const response = await fetch(`${apiUrl}/api/games/${code}`)
    if (!response.ok) {
      throw new Error('Game not found')
    }
    
    game.value = await response.json()
    currentGameCode.value = code
    
    // Connect socket and join room
    connect()
    socket.value?.emit('joinGame', code)
    
    return game.value
  }

  const createGame = async (startingLife = 40, playerCount = 4) => {
    const response = await fetch(`${apiUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startingLife, playerCount })
    })
    
    if (!response.ok) {
      throw new Error('Failed to create game')
    }
    
    const newGame = await response.json()
    game.value = newGame
    currentGameCode.value = newGame.code
    
    // Connect socket and join room
    connect()
    socket.value?.emit('joinGame', newGame.code)
    
    return newGame
  }

  const leaveGame = () => {
    if (currentGameCode.value) {
      socket.value?.emit('leaveGame', currentGameCode.value)
    }
    game.value = null
    currentGameCode.value = null
  }

  const updateLife = (playerIndex: number, life: number) => {
    if (!currentGameCode.value || !game.value) return
    
    // Optimistic update
    game.value.players[playerIndex].life = life
    
    socket.value?.emit('updateLife', {
      gameCode: currentGameCode.value,
      playerIndex,
      life
    })
  }

  const updateCommanderDamage = (playerIndex: number, commanderDamage: number[]) => {
    if (!currentGameCode.value || !game.value) return
    
    // Optimistic update
    game.value.players[playerIndex].commanderDamage = commanderDamage
    
    socket.value?.emit('updateCommanderDamage', {
      gameCode: currentGameCode.value,
      playerIndex,
      commanderDamage
    })
  }

  const updatePlayer = (playerIndex: number, life: number, commanderDamage: number[]) => {
    if (!currentGameCode.value || !game.value) return
    
    // Optimistic update
    game.value.players[playerIndex].life = life
    game.value.players[playerIndex].commanderDamage = commanderDamage
    
    socket.value?.emit('updatePlayer', {
      gameCode: currentGameCode.value,
      playerIndex,
      life,
      commanderDamage
    })
  }

  const updatePlayerName = (playerIndex: number, name: string) => {
    if (!currentGameCode.value || !game.value) return
    
    // Optimistic update
    game.value.players[playerIndex].name = name
    
    socket.value?.emit('updatePlayerName', {
      gameCode: currentGameCode.value,
      playerIndex,
      name
    })
  }

  const resetGame = async () => {
    if (!currentGameCode.value) return
    
    const response = await fetch(`${apiUrl}/api/games/${currentGameCode.value}/reset`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error('Failed to reset game')
    }
  }

  return {
    socket: readonly(socket),
    game: readonly(game),
    connected: readonly(connected),
    currentGameCode: readonly(currentGameCode),
    connect,
    disconnect,
    joinGame,
    createGame,
    leaveGame,
    updateLife,
    updateCommanderDamage,
    updatePlayer,
    updatePlayerName,
    resetGame,
    getApiUrl
  }
}

