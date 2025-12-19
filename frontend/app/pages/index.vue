<template>
  <div class="lobby">
    <div class="lobby-content">
      <h1 class="title">Life Counter</h1>
      <p class="subtitle">Magic: The Gathering Commander</p>
      
      <div class="actions">
        <!-- Create Game -->
        <div class="action-card">
          <h2>New Game</h2>
          <p>Start a new game and invite others</p>
          
          <div class="option-group">
            <label>Players</label>
            <div class="option-buttons">
              <button 
                v-for="count in [2, 3, 4]" 
                :key="count"
                class="option-btn"
                :class="{ active: playerCount === count }"
                @click="playerCount = count"
              >
                {{ count }}
              </button>
            </div>
          </div>
          
          <div class="option-group">
            <label>Starting Life</label>
            <div class="option-buttons">
              <button 
                v-for="life in [20, 30, 40]" 
                :key="life"
                class="option-btn"
                :class="{ active: startingLife === life }"
                @click="startingLife = life"
              >
                {{ life }}
              </button>
            </div>
          </div>
          
          <button class="btn-primary" @click="handleCreateGame" :disabled="creating">
            <UIcon v-if="creating" name="i-heroicons-arrow-path" class="spinner" />
            <span v-else>Create Game</span>
          </button>
        </div>
        
        <!-- Join Game -->
        <div class="action-card">
          <h2>Join Game</h2>
          <p>Enter a game code to join</p>
          
          <div class="code-input-wrapper">
            <input 
              v-model="joinCode" 
              type="text" 
              placeholder="XXXX"
              maxlength="6"
              class="code-input"
              @keyup.enter="handleJoinGame"
            />
          </div>
          <div>

          </div>
          
          <button class="btn-secondary" @click="handleJoinGame" :disabled="joining || !joinCode">
            <UIcon v-if="joining" name="i-heroicons-arrow-path" class="spinner" />
            <span v-else>Join Game (Grid)</span>
          </button>
          
          <button class="btn-secondary" @click="handleJoinGamePlayer" :disabled="joining || !joinCode">
            <UIcon v-if="joining" name="i-heroicons-arrow-path" class="spinner" />
            <span v-else>Join Game (Player)</span>
          </button>
          
          <p v-if="joinError" class="error">{{ joinError }}</p>
        </div>
      </div>
    </div>
    
    <!-- Decorative elements -->
    <div class="bg-pattern"></div>
  </div>
</template>

<script setup>
const router = useRouter()
const { createGame, joinGame } = useGameSocket()

const playerCount = ref(4)
const startingLife = ref(40)
const joinCode = ref('')
const creating = ref(false)
const joining = ref(false)
const joinError = ref('')

const handleCreateGame = async () => {
  creating.value = true
  try {
    const game = await createGame(startingLife.value, playerCount.value)
    router.push(`/game/${game.code}`)
  } catch (error) {
    console.error('Failed to create game:', error)
  } finally {
    creating.value = false
  }
}

const handleJoinGame = async () => {
  if (!joinCode.value) return
  
  joining.value = true
  joinError.value = ''
  
  try {
    await joinGame(joinCode.value)
    router.push(`/game/${joinCode.value.toUpperCase()}`)
  } catch (error) {
    joinError.value = 'Game not found. Check the code and try again.'
  } finally {
    joining.value = false
  }
}

const handleJoinGamePlayer = async () => {
  if (!joinCode.value) return
  
  joining.value = true
  joinError.value = ''
  
  try {
    router.push(`/player/${joinCode.value.toUpperCase()}`)
  } catch (error) {
    joinError.value = 'Game not found. Check the code and try again.'
  }
  finally {
    joining.value = false
  }
}

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

.lobby {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
  position: relative;
  overflow: hidden;
  padding: 2rem;
}

.bg-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 38, 38, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

.lobby-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 800px;
  width: 100%;
}

.title {
  font-family: 'Orbitron', monospace;
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 900;
  color: #fff;
  margin-bottom: 0.5rem;
  text-shadow: 
    0 0 20px rgba(255, 255, 255, 0.3),
    0 0 40px rgba(255, 255, 255, 0.1);
}

.subtitle {
  font-family: 'Orbitron', monospace;
  font-size: clamp(0.8rem, 2.5vw, 1rem);
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-bottom: 3rem;
}

.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.action-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-card h2 {
  font-family: 'Orbitron', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
}

.action-card p {
  font-family: 'Orbitron', monospace;
  font-size: 0.85rem;
  color: #666;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.25rem 0;
}

.option-group label {
  font-family: 'Orbitron', monospace;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.option-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.option-btn {
  font-family: 'Orbitron', monospace;
  font-size: 1rem;
  font-weight: bold;
  padding: 0.75rem 1.25rem;
  border: 2px solid #333;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  color: #888;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 50px;
}

.option-btn:hover {
  border-color: #555;
  color: #fff;
}

.option-btn.active {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
}

.code-input-wrapper {
  margin: 0.5rem 0;
}

.code-input {
  font-family: 'Orbitron', monospace;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  padding: 1rem;
  width: 100%;
  border: 2px solid #333;
  border-radius: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  outline: none;
  transition: all 0.2s ease;
}

.code-input::placeholder {
  color: #444;
}

.code-input:focus {
  border-color: #0ea5e9;
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);
}

.btn-primary,
.btn-secondary {
  font-family: 'Orbitron', monospace;
  font-size: 1rem;
  font-weight: bold;
  padding: 1rem 2rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: auto;
}

.btn-primary {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border: none;
  color: #000;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(34, 197, 94, 0.6);
}

.btn-secondary {
  background: transparent;
  border: 2px solid #0ea5e9;
  color: #0ea5e9;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.1);
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error {
  color: #ef4444 !important;
  font-size: 0.8rem !important;
}
</style>
