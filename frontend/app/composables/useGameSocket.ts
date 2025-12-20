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
  playerCount: number
  sequence?: number
  createdAt: string
  lastActivity: string
}

// Shared state across all components using this composable
const socket = ref<Socket | null>(null)
const game = ref<Game | null>(null)
const connected = ref(false)
const currentGameCode = ref<string | null>(null)

// Local-first sync state
const isLocallyActive = ref(false)
const pendingRemoteState = ref<Game | null>(null)
const lastLocalChange = ref<number>(0)
const syncDebounceMs = 1500 // Wait 1.5s after last action before syncing

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null

export function useGameSocket() {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || '192.168.1.10:3001'

  // Deep compare player states to detect conflicts
  const playersMatch = (local: Player[], remote: Player[]): boolean => {
    if (local.length !== remote.length) return false
    for (let i = 0; i < local.length; i++) {
      if (local[i].life !== remote[i].life) return false
      if (local[i].name !== remote[i].name) return false
      for (let j = 0; j < local[i].commanderDamage.length; j++) {
        if (local[i].commanderDamage[j] !== remote[i].commanderDamage[j]) return false
      }
    }
    return true
  }

  // Push all local player states to server
  const pushLocalStateToServer = async () => {
    if (!currentGameCode.value || !game.value) return
    
    console.log('[Sync] Pushing local state to server')
    
    // Push each player's state
    for (let i = 0; i < game.value.players.length; i++) {
      const player = game.value.players[i]
      socket.value?.emit('updatePlayer', {
        gameCode: currentGameCode.value,
        playerIndex: i,
        life: player.life,
        commanderDamage: player.commanderDamage
      })
    }
  }

  // Fetch fresh state from server
  const fetchRemoteState = async (): Promise<Game | null> => {
    if (!currentGameCode.value) return null
    
    try {
      const response = await fetch(`${apiUrl}/api/games/${currentGameCode.value}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('[Sync] Failed to fetch remote state:', error)
    }
    return null
  }

  // Perform sync after debounce period
  const performSync = async () => {
    if (!game.value) return
    
    isLocallyActive.value = false
    console.log('[Sync] Debounce complete, checking for conflicts')
    
    // Check if we have a pending remote state that differs
    if (pendingRemoteState.value) {
      const localPlayers = game.value.players
      const remotePlayers = pendingRemoteState.value.players
      
      if (!playersMatch(localPlayers, remotePlayers)) {
        console.log('[Sync] Conflict detected - local state differs from remote')
        
        // Push our local state to server (we're the source of truth during active period)
        await pushLocalStateToServer()
        
        // Small delay to let server process
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Fetch fresh state
        const freshState = await fetchRemoteState()
        if (freshState) {
          game.value = freshState
          console.log('[Sync] Applied fresh state from server')
        }
      } else {
        // States match, just apply the remote state (may have newer metadata)
        game.value = pendingRemoteState.value
        console.log('[Sync] States match, applied remote state')
      }
      
      pendingRemoteState.value = null
    }
  }

  // Mark local activity and schedule sync
  const markLocalActivity = () => {
    isLocallyActive.value = true
    lastLocalChange.value = Date.now()
    
    // Clear existing timer
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
    }
    
    // Schedule sync after debounce period
    syncDebounceTimer = setTimeout(() => {
      performSync()
    }, syncDebounceMs)
  }

  // Handle incoming game updates
  const handleGameUpdate = (updatedGame: Game) => {
    if (isLocallyActive.value) {
      // User is actively making changes - buffer the remote state for later comparison
      pendingRemoteState.value = updatedGame
      console.log('[Sync] Buffered remote update (user is active)')
    } else {
      // User is idle - apply remote state immediately
      game.value = updatedGame
      pendingRemoteState.value = null
    }
  }

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

    socket.value.on('gameUpdate', handleGameUpdate)
  }

  const getApiUrl = () => {
    return apiUrl;
  }

  const disconnect = () => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
    
    if (currentGameCode.value) {
      socket.value?.emit('leaveGame', currentGameCode.value)
    }
    socket.value?.disconnect()
    socket.value = null
    connected.value = false
    game.value = null
    currentGameCode.value = null
    isLocallyActive.value = false
    pendingRemoteState.value = null
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
    
    // Reset sync state
    isLocallyActive.value = false
    pendingRemoteState.value = null
    
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
    
    // Reset sync state
    isLocallyActive.value = false
    pendingRemoteState.value = null
    
    // Connect socket and join room
    connect()
    socket.value?.emit('joinGame', newGame.code)
    
    return newGame
  }

  const leaveGame = () => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
    
    if (currentGameCode.value) {
      socket.value?.emit('leaveGame', currentGameCode.value)
    }
    game.value = null
    currentGameCode.value = null
    isLocallyActive.value = false
    pendingRemoteState.value = null
  }

  const updateLife = (playerIndex: number, life: number) => {
    if (!currentGameCode.value || !game.value) return
    
    // Mark activity and apply optimistic update
    markLocalActivity()
    game.value.players[playerIndex].life = life
    
    socket.value?.emit('updateLife', {
      gameCode: currentGameCode.value,
      playerIndex,
      life
    })
  }

  const updateCommanderDamage = (playerIndex: number, commanderDamage: number[]) => {
    if (!currentGameCode.value || !game.value) return
    
    // Mark activity and apply optimistic update
    markLocalActivity()
    game.value.players[playerIndex].commanderDamage = commanderDamage
    
    socket.value?.emit('updateCommanderDamage', {
      gameCode: currentGameCode.value,
      playerIndex,
      commanderDamage
    })
  }

  const updatePlayer = (playerIndex: number, life: number, commanderDamage: number[]) => {
    if (!currentGameCode.value || !game.value) return
    
    // Mark activity and apply optimistic update
    markLocalActivity()
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
    
    // Mark activity and apply optimistic update
    markLocalActivity()
    game.value.players[playerIndex].name = name
    
    socket.value?.emit('updatePlayerName', {
      gameCode: currentGameCode.value,
      playerIndex,
      name
    })
  }

  const resetGame = async () => {
    if (!currentGameCode.value) return
    
    // Clear local activity state for reset
    isLocallyActive.value = false
    pendingRemoteState.value = null
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
    
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
    isLocallyActive: readonly(isLocallyActive),
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
