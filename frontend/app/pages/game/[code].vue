<template>
  <div class="life-counter" :class="`players-${playerCount}`" v-if="game">
    <div 
      v-for="(player, index) in players" 
      :key="index"
      class="player-zone"
      :class="[`player-${index}`, `color-${player.color}`]"
      :style="{ transform: `rotate(${getRotation(index)}deg)` }"
    >
      <div class="player-content">
        <div class="player-name">{{ player.name }}</div>
        
        <div class="life-controls">
          <button 
            class="life-btn decrement" 
            @click="changeLife(index, -1)"
            @mousedown="startHold(index, -1, 'life')"
            @mouseup="stopHold"
            @mouseleave="stopHold"
            @touchstart="startHold(index, -1, 'life')"
            @touchend="stopHold"
            @touchcancel="stopHold"
          >
            <span class="btn-icon">−</span>
          </button>
          <div class="life-display">
            <span class="life-total" :class="{ 'low-life': player.life <= 10, 'critical': player.life <= 5 }">
              {{ player.life }}
            </span>
            <div class="last-change" v-if="lastChanges[index] !== 0">
              <span :class="lastChanges[index] > 0 ? 'positive' : 'negative'">
                {{ lastChanges[index] > 0 ? '+' : '' }}{{ lastChanges[index] }}
              </span>
            </div>
          </div>
          <button 
            class="life-btn increment" 
            @click="changeLife(index, 1)"
            @mousedown="startHold(index, 1, 'life')"
            @mouseup="stopHold"
            @mouseleave="stopHold"
            @touchstart="startHold(index, 1, 'life')"
            @touchend="stopHold"
            @touchcancel="stopHold"
          >
            <span class="btn-icon">+</span>
          </button>
        </div>

        <!-- Commander Damage Button -->
        <button 
          class="commander-btn" 
          @click="openCommanderModal(index)"
        >
          <div class="cmd-grid">
            <div 
              v-for="(dmg, dmgIndex) in player.commanderDamage" 
              :key="dmgIndex"
              class="cmd-grid-cell"
              :class="{ 'has-damage': dmg > 0, 'is-self': dmgIndex === index }"
              :style="{ '--dot-color': getPlayerAccentColor(dmgIndex) }"
            >
              <span class="cmd-grid-dot"></span>
              <span class="cmd-grid-value">{{ dmg }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>
    
    <!-- Game Code Display -->
    <div class="game-code">
      <span class="code-label">Game</span>
      <span class="code-value">{{ gameCode }}</span>
    </div>
    
    <button class="reset-btn" @click="handleReset">
      <UIcon name="i-heroicons-arrow-path" />
    </button>
    
    <button class="qr-btn" @click="openQRModal">
      <UIcon name="i-heroicons-qr-code" />
    </button>

    <!-- Commander Damage Modal -->
    <Teleport to="body">
      <div 
        v-if="commanderModal.open" 
        class="modal-overlay"
        @click.self="closeCommanderModal"
      >
        <div 
          class="commander-modal"
          :style="{ transform: `rotate(${getRotation(commanderModal.playerIndex)}deg)` }"
        >
          <div class="modal-header">
            <h2 class="modal-title">
              <span 
                class="modal-player-dot"
                :style="{ background: getPlayerAccentColor(commanderModal.playerIndex) }"
              ></span>
              {{ players[commanderModal.playerIndex]?.name }} - Commander Damage
            </h2>
            <button class="modal-close" @click="closeCommanderModal">
              <UIcon name="i-heroicons-x-mark" />
            </button>
          </div>
          
          <div class="modal-body">
            <div class="damage-grid">
              <div 
                v-for="(sourcePlayer, sourceIndex) in players" 
                :key="sourceIndex"
                class="damage-cell"
                :class="{ 
                  'is-self': sourceIndex === commanderModal.playerIndex,
                  [`cell-${sourceIndex}`]: true
                }"
                :style="{ 
                  '--cell-color': getPlayerAccentColor(sourceIndex),
                  '--cell-glow': getPlayerAccentColor(sourceIndex) + '40'
                }"
              >
                <div class="cell-header">
                  <span 
                    class="cell-dot"
                    :style="{ background: getPlayerAccentColor(sourceIndex) }"
                  ></span>
                  <span class="cell-name">
                    {{ sourcePlayer.name }}
                    <span v-if="sourceIndex === commanderModal.playerIndex" class="self-label">(Self)</span>
                  </span>
                </div>
                
                <div class="cell-controls">
                  <button 
                    class="cell-btn decrement"
                    @click="changeCommanderDamage(commanderModal.playerIndex, sourceIndex, -1)"
                    @mousedown="startHold(commanderModal.playerIndex, -1, 'cmd', sourceIndex)"
                    @mouseup="stopHold"
                    @mouseleave="stopHold"
                    @touchstart="startHold(commanderModal.playerIndex, -1, 'cmd', sourceIndex)"
                    @touchend="stopHold"
                    @touchcancel="stopHold"
                  >−</button>
                  
                  <div 
                    class="cell-damage"
                    :class="{ 'lethal': players[commanderModal.playerIndex]?.commanderDamage[sourceIndex] >= 21 }"
                  >
                    {{ players[commanderModal.playerIndex]?.commanderDamage[sourceIndex] || 0 }}
                  </div>
                  
                  <button 
                    class="cell-btn increment"
                    @click="changeCommanderDamage(commanderModal.playerIndex, sourceIndex, 1)"
                    @mousedown="startHold(commanderModal.playerIndex, 1, 'cmd', sourceIndex)"
                    @mouseup="stopHold"
                    @mouseleave="stopHold"
                    @touchstart="startHold(commanderModal.playerIndex, 1, 'cmd', sourceIndex)"
                    @touchend="stopHold"
                    @touchcancel="stopHold"
                  >+</button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="total-damage">
              Total: <strong>{{ getTotalCommanderDamage(commanderModal.playerIndex) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- QR Code Modal -->
    <Teleport to="body">
      <div 
        v-if="qrModal.open" 
        class="modal-overlay"
        @click.self="closeQRModal"
      >
        <div class="qr-modal">
          <div class="modal-header">
            <h2 class="modal-title">
              <UIcon name="i-heroicons-qr-code" />
              Join Game
            </h2>
            <button class="modal-close" @click="closeQRModal">
              <UIcon name="i-heroicons-x-mark" />
            </button>
          </div>
          
          <div class="qr-content">
            <div class="qr-code-wrapper">
              <img 
                v-if="qrCode" 
                :src="qrCode" 
                alt="QR code to join game"
                class="qr-image"
              />
              <div v-else class="qr-loading">
                <UIcon name="i-heroicons-arrow-path" class="spinner" />
              </div>
            </div>
            
            <div class="qr-info">
              <div class="qr-game-code">{{ gameCode }}</div>
              <p class="qr-url">{{ playerUrl }}</p>
            </div>
            
            <a 
              :href="playerUrl" 
              target="_blank" 
              class="qr-link"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" />
              Open Link
            </a>
          </div>
          
          <div class="qr-footer">
            <p>Scan this QR code to join the game on another device. Players will select which seat they're in.</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected }">
      <span class="status-dot"></span>
      <span class="status-text">{{ connected ? 'Synced' : 'Offline' }}</span>
    </div>

    <!-- Fullscreen Prompt (Mobile) -->
    <div 
      v-if="showFullscreenPrompt" 
      class="fullscreen-prompt"
      @click="enterFullscreen"
    >
      <div class="prompt-content">
        <UIcon name="i-heroicons-arrows-pointing-out" class="prompt-icon" />
        <span>Tap to enter fullscreen</span>
      </div>
    </div>
  </div>
  
  <!-- Loading State -->
  <div v-else class="loading-screen">
    <div class="loading-content">
      <UIcon name="i-heroicons-arrow-path" class="loading-spinner" />
      <p>Loading game...</p>
    </div>
  </div>
</template>

<script setup>
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()
const gameCode = route.params.code.toUpperCase()

const { 
  game, 
  connected, 
  joinGame, 
  updatePlayer,
  resetGame,
  leaveGame
} = useGameSocket()

const playerColors = {
  crimson: '#dc2626',
  ocean: '#0ea5e9',
  forest: '#22c55e',
  amber: '#f59e0b',
}

const players = computed(() => game.value?.players || [])
const playerCount = computed(() => game.value?.playerCount || game.value?.players?.length || 4)
const lastChanges = ref([0, 0, 0, 0])
const commanderModal = ref({ open: false, playerIndex: 0 })
const qrModal = ref({ open: false })
const qrCode = ref('')
const showFullscreenPrompt = ref(false)
const playerUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/player/${gameCode}`
})

let holdInterval = null
let changeTimeouts = [null, null, null, null]

const getRotation = (index) => {
  const count = playerCount.value
  if (count === 2) {
    return index === 0 ? 180 : 0
  }
  if (count === 3) {
    return index === 0 ? 180 : 0
  }
  // 4 players: top 2 rotated
  return index < 2 ? 180 : 0
}

const getPlayerAccentColor = (playerIndex) => {
  const player = players.value[playerIndex]
  return player ? playerColors[player.color] : '#888'
}

const getTotalCommanderDamage = (playerIndex) => {
  return players.value[playerIndex]?.commanderDamage.reduce((sum, dmg) => sum + dmg, 0) || 0
}

const changeLife = (playerIndex, amount) => {
  if (!game.value) return
  
  const player = players.value[playerIndex]
  const newLife = player.life + amount
  
  lastChanges.value[playerIndex] += amount
  
  clearTimeout(changeTimeouts[playerIndex])
  changeTimeouts[playerIndex] = setTimeout(() => {
    lastChanges.value[playerIndex] = 0
  }, 2000)
  
  updatePlayer(playerIndex, newLife, player.commanderDamage)
}

const changeCommanderDamage = (playerIndex, fromPlayerIndex, amount) => {
  if (!game.value) return
  
  const player = players.value[playerIndex]
  const newDamage = player.commanderDamage[fromPlayerIndex] + amount
  if (newDamage < 0) return
  
  const newCommanderDamage = [...player.commanderDamage]
  newCommanderDamage[fromPlayerIndex] = newDamage
  
  // Commander damage affects life
  const newLife = player.life - amount
  
  lastChanges.value[playerIndex] -= amount
  
  clearTimeout(changeTimeouts[playerIndex])
  changeTimeouts[playerIndex] = setTimeout(() => {
    lastChanges.value[playerIndex] = 0
  }, 2000)
  
  updatePlayer(playerIndex, newLife, newCommanderDamage)
}

const openCommanderModal = (playerIndex) => {
  commanderModal.value = { open: true, playerIndex }
}

const closeCommanderModal = () => {
  commanderModal.value.open = false
}

const generateQRCode = async () => {
  try {
    const url = playerUrl.value
    qrCode.value = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#00000000'
      }
    })
  } catch (error) {
    console.error('Failed to generate QR code:', error)
  }
}

const openQRModal = async () => {
  qrModal.value.open = true
  await generateQRCode()
}

const closeQRModal = () => {
  qrModal.value.open = false
}

const startHold = (playerIndex, amount, type, fromPlayerIndex = null) => {
  stopHold()
  let delay = 300
  const repeat = () => {
    if (type === 'life') {
      changeLife(playerIndex, amount)
    } else if (type === 'cmd' && fromPlayerIndex !== null) {
      changeCommanderDamage(playerIndex, fromPlayerIndex, amount)
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

const handleReset = async () => {
  await resetGame()
  lastChanges.value = [0, 0, 0, 0]
  closeCommanderModal()
}

const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
}

const isFullscreen = () => {
  return !!(document.fullscreenElement || document.webkitFullscreenElement)
}

const enterFullscreen = async () => {
  showFullscreenPrompt.value = false
  try {
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      await elem.requestFullscreen()
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen()
    }
  } catch (error) {
    console.log('Fullscreen not supported or denied')
  }
}

// Join game on mount
onMounted(async () => {
  try {
    await joinGame(gameCode)
    
    // Show fullscreen prompt on mobile if not already fullscreen
    if (isMobile() && !isFullscreen()) {
      showFullscreenPrompt.value = true
    }
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

<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@400;700;900&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #__nuxt {
  height: 100%;
  overflow: hidden;
  touch-action: manipulation;
}

.life-counter {
  display: grid;
  height: 100vh;
  width: 100vw;
  gap: 3px;
  background: #0a0a0a;
  position: relative;
}

/* 4 Player Layout */
.life-counter.players-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* 3 Player Layout */
.life-counter.players-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* 2 Player Layout */
.life-counter.players-2 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr;
}

.player-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.player-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 1rem;
  gap: 0.5rem;
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

.player-name {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.7rem, 2vw, 1rem);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  opacity: 0.8;
}

.life-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
}

.life-btn {
  width: clamp(50px, 15vw, 80px);
  height: clamp(50px, 15vw, 80px);
  border-radius: 50%;
  border: 2px solid var(--accent);
  background: rgba(0, 0, 0, 0.5);
  color: var(--accent);
  font-size: clamp(1.5rem, 5vw, 2.5rem);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px var(--accent-glow);
}

.life-btn:hover {
  background: var(--accent);
  color: #000;
  transform: scale(1.05);
  box-shadow: 0 0 30px var(--accent-glow);
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
  min-width: clamp(80px, 25vw, 150px);
  text-align: center;
  position: relative;
}

.life-total {
  font-family: 'Orbitron', monospace;
  font-size: clamp(3rem, 12vw, 6rem);
  font-weight: 900;
  color: #fff;
  text-shadow: 
    0 0 20px var(--accent-glow),
    0 0 40px var(--accent-glow);
  transition: all 0.3s ease;
}

.life-total.low-life {
  color: #fbbf24;
  text-shadow: 
    0 0 20px rgba(251, 191, 36, 0.6),
    0 0 40px rgba(251, 191, 36, 0.4);
}

.life-total.critical {
  color: #ef4444;
  text-shadow: 
    0 0 20px rgba(239, 68, 68, 0.8),
    0 0 40px rgba(239, 68, 68, 0.6);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.last-change {
  position: absolute;
  bottom: -1.5em;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Orbitron', monospace;
  font-size: clamp(1rem, 3vw, 1.5rem);
  white-space: nowrap;
}

.last-change .positive {
  color: #22c55e;
}

.last-change .negative {
  color: #ef4444;
}

/* Commander Button */
.commander-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.commander-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  border-color: var(--accent);
  box-shadow: 0 0 15px var(--accent-glow);
}

.commander-btn:active {
  transform: scale(0.97);
}

.cmd-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
}

.cmd-grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.2rem 0.35rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  min-width: clamp(28px, 7vw, 38px);
}

.cmd-grid-cell.has-damage {
  background: rgba(255, 255, 255, 0.1);
}

.cmd-grid-cell.is-self {
  opacity: 0.6;
}

.cmd-grid-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dot-color);
  box-shadow: 0 0 4px var(--dot-color);
}

.cmd-grid-value {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.55rem, 1.5vw, 0.7rem);
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8);
}

/* Game Code Display */
.game-code {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateY(-35px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  z-index: 90;
}

.code-label {
  font-family: 'Orbitron', monospace;
  font-size: 0.6rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.code-value {
  font-family: 'Orbitron', monospace;
  font-size: 0.9rem;
  font-weight: bold;
  color: #888;
  letter-spacing: 0.15em;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.commander-modal {
  background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%);
  border: 2px solid #333;
  border-radius: 1.5rem;
  width: min(95vw, 520px);
  max-height: 95vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #333;
  background: rgba(0, 0, 0, 0.3);
}

.modal-title {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.9rem, 3vw, 1.1rem);
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.modal-close {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #444;
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #666;
  color: #fff;
}

.modal-body {
  padding: 1.25rem;
}

.damage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.damage-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 1rem;
  border: 2px solid var(--cell-color);
  box-shadow: 0 0 15px var(--cell-glow);
  gap: 0.5rem;
  overflow: hidden;
}

.damage-cell.is-self {
  border-style: dashed;
  opacity: 0.8;
}

.cell-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cell-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}

.cell-name {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.7rem, 2.5vw, 0.9rem);
  color: rgba(255, 255, 255, 0.9);
}

.self-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85em;
}

.cell-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cell-btn {
  width: clamp(48px, 11vw, 60px);
  height: clamp(48px, 11vw, 60px);
  border-radius: 50%;
  border: 2px solid #555;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.6rem, 4.5vw, 2rem);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.cell-btn.decrement {
  border-color: #991b1b;
  color: #fca5a5;
}

.cell-btn.decrement:hover {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.6);
}

.cell-btn.increment {
  border-color: #166534;
  color: #86efac;
}

.cell-btn.increment:hover {
  background: #22c55e;
  border-color: #22c55e;
  color: #fff;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.6);
}

.cell-btn:active {
  transform: scale(0.9);
}

.cell-damage {
  font-family: 'Orbitron', monospace;
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 900;
  color: #fff;
  min-width: clamp(36px, 9vw, 48px);
  text-align: center;
}

.cell-damage.lethal {
  color: #ef4444;
  text-shadow: 0 0 15px rgba(239, 68, 68, 0.8);
  animation: pulse 0.5s ease-in-out infinite;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #333;
  background: rgba(0, 0, 0, 0.3);
}

.total-damage {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.9rem, 2.5vw, 1rem);
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.total-damage strong {
  color: #fff;
  font-size: 1.2em;
}

.reset-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateY(22px) translateX(-32px);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #444;
  background: #1a1a1a;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  transition: all 0.2s ease;
  z-index: 100;
}

.reset-btn:hover {
  border-color: #888;
  color: #fff;
  background: #2a2a2a;
}

.qr-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateY(22px) translateX(32px);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #444;
  background: #1a1a1a;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  transition: all 0.2s ease;
  z-index: 100;
}

.qr-btn:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
  background: #1a2a3a;
}

/* QR Modal */
.qr-modal {
  background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%);
  border: 2px solid #333;
  border-radius: 1.5rem;
  width: min(90vw, 360px);
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
}

.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
}

.qr-code-wrapper {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1rem;
  padding: 0.75rem;
  border: 2px solid #333;
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-loading {
  color: #666;
  font-size: 2rem;
}

.qr-loading .spinner {
  animation: spin 1s linear infinite;
}

.qr-info {
  text-align: center;
}

.qr-game-code {
  font-family: 'Orbitron', monospace;
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.2em;
  margin-bottom: 0.5rem;
}

.qr-url {
  font-family: 'Orbitron', monospace;
  font-size: 0.65rem;
  color: #666;
  word-break: break-all;
}

.qr-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Orbitron', monospace;
  font-size: 0.85rem;
  color: #0ea5e9;
  text-decoration: none;
  padding: 0.75rem 1.5rem;
  border: 2px solid #0ea5e9;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.qr-link:hover {
  background: rgba(14, 165, 233, 0.2);
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);
}

.qr-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #333;
  background: rgba(0, 0, 0, 0.3);
}

.qr-footer p {
  font-family: 'Orbitron', monospace;
  font-size: 0.7rem;
  color: #666;
  text-align: center;
  line-height: 1.5;
}

/* Connection Status */
.connection-status {
  position: absolute;
  bottom: 50%;
  left: 50%;
  transform: translate(-50%, 50%) translateY(55px);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  z-index: 90;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
}

.connection-status.connected .status-dot {
  background: #22c55e;
}

.status-text {
  font-family: 'Orbitron', monospace;
  font-size: 0.55rem;
  color: #666;
  text-transform: uppercase;
}

/* Loading Screen */
.loading-screen {
  height: 100vh;
  width: 100vw;
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

/* 4 Player Grid Positions */
.players-4 .player-0 { grid-area: 1 / 1 / 2 / 2; }
.players-4 .player-1 { grid-area: 1 / 2 / 2 / 3; }
.players-4 .player-2 { grid-area: 2 / 1 / 3 / 2; }
.players-4 .player-3 { grid-area: 2 / 2 / 3 / 3; }

/* 3 Player Grid Positions */
.players-3 .player-0 { grid-area: 1 / 1 / 2 / 3; }
.players-3 .player-1 { grid-area: 2 / 1 / 3 / 2; }
.players-3 .player-2 { grid-area: 2 / 2 / 3 / 3; }

/* 2 Player Grid Positions */
.players-2 .player-0 { grid-area: 1 / 1 / 2 / 2; }
.players-2 .player-1 { grid-area: 2 / 1 / 3 / 2; }

/* Fullscreen Prompt */
.fullscreen-prompt {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.prompt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #fff;
  font-family: 'Orbitron', monospace;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  animation: promptPulse 2s ease-in-out infinite;
}

.prompt-icon {
  font-size: 3rem;
  color: #0ea5e9;
}

@keyframes promptPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.98); }
}
</style>

