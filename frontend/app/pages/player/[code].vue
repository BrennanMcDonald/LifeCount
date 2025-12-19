<template>
  <!-- Player Selection Screen -->
  <div class="player-select" v-if="!selectedPlayer && game">
    <div class="select-content">
      <div class="select-header">
        <span class="game-code">Game {{ gameCode }}</span>
        <h1>Select Your Player</h1>
      </div>
      
      <div class="player-grid">
        <button 
          v-for="(player, index) in game.players" 
          :key="index"
          class="player-option"
          :class="`color-${player.color}`"
          @click="selectPlayer(index)"
        >
          <span class="player-color-dot" :style="{ background: playerColors[player.color] }"></span>
          <span class="player-option-name">{{ player.name }}</span>
          <span class="player-life">{{ player.life }} life</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Player Control Screen -->
  <div class="player-page" :class="`color-${player?.color}`" v-else-if="game && player">
    <div class="player-content">
      <div class="player-header">
        <span class="player-name">{{ player.name }}</span>
      </div>
      
      <div class="life-section">
        <button 
          class="life-btn decrement" 
          @click="changeLife(-1)"
          @mousedown="startHold(-1, 'life')"
          @mouseup="stopHold"
          @mouseleave="stopHold"
          @touchstart="startHold(-1, 'life')"
          @touchend="stopHold"
          @touchcancel="stopHold"
        >
          <span class="btn-icon">−</span>
        </button>
        
        <div class="life-display">
          <span class="life-total" :class="{ 'low-life': player.life <= 10, 'critical': player.life <= 5 }">
            {{ player.life }}
          </span>
          <div class="last-change" v-if="lastChange !== 0">
            <span :class="lastChange > 0 ? 'positive' : 'negative'">
              {{ lastChange > 0 ? '+' : '' }}{{ lastChange }}
            </span>
          </div>
        </div>
        
        <button 
          class="life-btn increment" 
          @click="changeLife(1)"
          @mousedown="startHold(1, 'life')"
          @mouseup="stopHold"
          @mouseleave="stopHold"
          @touchstart="startHold(1, 'life')"
          @touchend="stopHold"
          @touchcancel="stopHold"
        >
          <span class="btn-icon">+</span>
        </button>
      </div>
      
      <!-- Commander Damage Section -->
      <div class="commander-section">
        <h3 class="section-title">Commander Damage Received</h3>
        <div class="commander-grid">
          <div 
            v-for="(sourcePlayer, sourceIndex) in game.players" 
            :key="sourceIndex"
            class="commander-cell"
            :class="{ 'is-self': sourceIndex === selectedPlayerIndex }"
            :style="{ '--cell-color': playerColors[sourcePlayer.color] }"
          >
            <div class="cell-info">
              <span 
                class="cell-dot"
                :style="{ background: playerColors[sourcePlayer.color] }"
              ></span>
              <span class="cell-name">{{ sourcePlayer.name }}</span>
            </div>
            
            <div class="cell-controls">
              <button 
                class="cmd-btn"
                @click="changeCommanderDamage(sourceIndex, -1)"
              >−</button>
              
              <span 
                class="cmd-value"
                :class="{ 'lethal': player.commanderDamage[sourceIndex] >= 21 }"
              >
                {{ player.commanderDamage[sourceIndex] }}
              </span>
              
              <button 
                class="cmd-btn"
                @click="changeCommanderDamage(sourceIndex, 1)"
              >+</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Connection Status -->
      <div class="connection-status" :class="{ connected }">
        <span class="status-dot"></span>
        <span class="status-text">{{ connected ? 'Synced' : 'Offline' }}</span>
      </div>
    </div>
  </div>
  
  <!-- Loading State -->
  <div v-else class="loading-screen">
    <div class="loading-content">
      <UIcon name="i-heroicons-arrow-path" class="loading-spinner" />
      <p>Joining game...</p>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()

const gameCode = route.params.code.toUpperCase()

const { 
  game, 
  connected, 
  joinGame, 
  updatePlayer,
  leaveGame
} = useGameSocket()

const playerColors = {
  crimson: '#dc2626',
  ocean: '#0ea5e9',
  forest: '#22c55e',
  amber: '#f59e0b',
}

const selectedPlayerIndex = ref(null)
const selectedPlayer = computed(() => selectedPlayerIndex.value !== null)
const player = computed(() => selectedPlayerIndex.value !== null ? game.value?.players[selectedPlayerIndex.value] : null)
const lastChange = ref(0)

let holdInterval = null
let changeTimeout = null

const selectPlayer = (index) => {
  selectedPlayerIndex.value = index
}

const deselectPlayer = () => {
  selectedPlayerIndex.value = null
  lastChange.value = 0
}

const changeLife = (amount) => {
  if (!game.value || !player.value || selectedPlayerIndex.value === null) return
  
  const newLife = player.value.life + amount
  
  lastChange.value += amount
  
  clearTimeout(changeTimeout)
  changeTimeout = setTimeout(() => {
    lastChange.value = 0
  }, 2000)
  
  updatePlayer(selectedPlayerIndex.value, newLife, player.value.commanderDamage)
}

const changeCommanderDamage = (fromPlayerIndex, amount) => {
  if (!game.value || !player.value || selectedPlayerIndex.value === null) return
  
  const newDamage = player.value.commanderDamage[fromPlayerIndex] + amount
  if (newDamage < 0) return
  
  const newCommanderDamage = [...player.value.commanderDamage]
  newCommanderDamage[fromPlayerIndex] = newDamage
  
  // Commander damage affects life
  const newLife = player.value.life - amount
  
  lastChange.value -= amount
  
  clearTimeout(changeTimeout)
  changeTimeout = setTimeout(() => {
    lastChange.value = 0
  }, 2000)
  
  updatePlayer(selectedPlayerIndex.value, newLife, newCommanderDamage)
}

const startHold = (amount, type) => {
  stopHold()
  let delay = 300
  const repeat = () => {
    if (type === 'life') {
      changeLife(amount)
    }
    delay = Math.max(50, delay * 0.8)
    holdInterval = setTimeout(repeat, delay)
  }
  holdInterval = setTimeout(repeat, 500)
}

const stopHold = () => {
  if (holdInterval) {
    clearTimeout(holdInterval)
    holdInterval = null
  }
}

// Join game on mount
onMounted(async () => {
  try {
    await joinGame(gameCode)
  } catch (error) {
    console.error('Failed to join game:', error)
    router.push('/')
  }
})

// Leave game on unmount
onUnmounted(() => {
  leaveGame()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@400;700;900&display=swap');

/* Player Selection Screen */
.player-select {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
  padding: 1.5rem;
}

.select-content {
  width: 100%;
  max-width: 400px;
}

.select-header {
  text-align: center;
  margin-bottom: 2rem;
}

.select-header .game-code {
  font-family: 'Orbitron', monospace;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.select-header h1 {
  font-family: 'Orbitron', monospace;
  font-size: 1.5rem;
  color: #fff;
  margin-top: 0.5rem;
}

.player-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.player-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.player-option:hover {
  transform: translateX(5px);
  border-color: var(--accent);
  box-shadow: 0 0 20px var(--accent-glow);
}

.player-option.color-crimson {
  --accent: #dc2626;
  --accent-glow: rgba(220, 38, 38, 0.3);
}

.player-option.color-ocean {
  --accent: #0ea5e9;
  --accent-glow: rgba(14, 165, 233, 0.3);
}

.player-option.color-forest {
  --accent: #22c55e;
  --accent-glow: rgba(34, 197, 94, 0.3);
}

.player-option.color-amber {
  --accent: #f59e0b;
  --accent-glow: rgba(245, 158, 11, 0.3);
}

.player-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-option-name {
  flex: 1;
  font-family: 'Orbitron', monospace;
  font-size: 1rem;
  color: #fff;
}

.player-life {
  font-family: 'Orbitron', monospace;
  font-size: 0.8rem;
  color: #888;
}

/* Player Control Screen */
.player-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

/* Color Schemes */
.color-crimson {
  background: linear-gradient(145deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%);
  --accent: #dc2626;
  --accent-glow: rgba(220, 38, 38, 0.4);
}

.color-ocean {
  background: linear-gradient(145deg, #030a14 0%, #051525 50%, #030a14 100%);
  --accent: #0ea5e9;
  --accent-glow: rgba(14, 165, 233, 0.4);
}

.color-forest {
  background: linear-gradient(145deg, #031a0a 0%, #052d12 50%, #031a0a 100%);
  --accent: #22c55e;
  --accent-glow: rgba(34, 197, 94, 0.4);
}

.color-amber {
  background: linear-gradient(145deg, #1a1005 0%, #2d1a08 50%, #1a1005 100%);
  --accent: #f59e0b;
  --accent-glow: rgba(245, 158, 11, 0.4);
}

.player-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 1.5rem;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.3);
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.back-btn:hover {
  border-color: #666;
  color: #fff;
}

.game-code {
  font-family: 'Orbitron', monospace;
  font-size: 0.75rem;
  color: #666;
  letter-spacing: 0.1em;
}

.player-name {
  font-family: 'Orbitron', monospace;
  font-size: 1rem;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-left: auto;
}

.life-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  min-height: 200px;
}

.life-btn {
  width: clamp(70px, 20vw, 100px);
  height: clamp(70px, 20vw, 100px);
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: rgba(0, 0, 0, 0.5);
  color: var(--accent);
  font-size: clamp(2rem, 8vw, 3rem);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px var(--accent-glow);
}

.life-btn:hover {
  background: var(--accent);
  color: #000;
  transform: scale(1.05);
}

.life-btn:active {
  transform: scale(0.95);
}

.btn-icon {
  font-family: 'Bebas Neue', sans-serif;
  font-weight: bold;
  line-height: 1;
}

.life-display {
  text-align: center;
  position: relative;
}

.life-total {
  font-family: 'Orbitron', monospace;
  font-size: clamp(5rem, 20vw, 10rem);
  font-weight: 900;
  color: #fff;
  text-shadow: 
    0 0 30px var(--accent-glow),
    0 0 60px var(--accent-glow);
  line-height: 1;
}

.life-total.low-life {
  color: #fbbf24;
  text-shadow: 
    0 0 30px rgba(251, 191, 36, 0.6),
    0 0 60px rgba(251, 191, 36, 0.4);
}

.life-total.critical {
  color: #ef4444;
  text-shadow: 
    0 0 30px rgba(239, 68, 68, 0.8),
    0 0 60px rgba(239, 68, 68, 0.6);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.last-change {
  position: absolute;
  bottom: -2rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Orbitron', monospace;
  font-size: clamp(1.25rem, 5vw, 2rem);
  white-space: nowrap;
}

.last-change .positive {
  color: #22c55e;
}

.last-change .negative {
  color: #ef4444;
}

/* Commander Section */
.commander-section {
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.section-title {
  font-family: 'Orbitron', monospace;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  text-align: center;
}

.commander-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.commander-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.75rem;
  border: 1px solid var(--cell-color);
}

.commander-cell.is-self {
  opacity: 0.6;
  border-style: dashed;
}

.cell-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cell-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.cell-name {
  font-family: 'Orbitron', monospace;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
}

.cell-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cmd-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #444;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.cmd-btn:hover {
  background: var(--cell-color);
  border-color: var(--cell-color);
}

.cmd-btn:active {
  transform: scale(0.9);
}

.cmd-value {
  font-family: 'Orbitron', monospace;
  font-size: 1rem;
  font-weight: bold;
  color: #fff;
  min-width: 2rem;
  text-align: center;
}

.cmd-value.lethal {
  color: #ef4444;
  animation: pulse 0.5s ease-in-out infinite;
}

/* Connection Status */
.connection-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.connection-status.connected .status-dot {
  background: #22c55e;
}

.status-text {
  font-family: 'Orbitron', monospace;
  font-size: 0.7rem;
  color: #666;
  text-transform: uppercase;
}

/* Loading Screen */
.loading-screen {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #888;
  font-family: 'Orbitron', monospace;
}

.loading-spinner {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

