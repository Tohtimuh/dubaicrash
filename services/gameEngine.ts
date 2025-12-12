export interface GameState {
    roundId: number;
    status: 'COUNTDOWN' | 'RUNNING' | 'CRASHED';
    startTime: number;
    crashPoint: number;
    history: number[];
}

const STORAGE_KEY = 'cg_shared_game_state';

// Constants
const COUNTDOWN_DURATION = 5000; // 5 seconds
const COOLDOWN_DURATION = 3000;  // 3 seconds post-crash
const GROWTH_CONSTANT = 0.0693;  // Determines speed of multiplier (approx 10s to 2x)

// PRNG for deterministic consistency across clients
const mulberry32 = (a: number) => {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
};

export const GameEngine = {
    // Read state from storage or initialize default
    getState: (): GameState => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Initial State
        const initialState: GameState = {
            roundId: 1,
            status: 'COUNTDOWN',
            startTime: Date.now(),
            crashPoint: 2.00, // Placeholder, will be regen'd
            history: []
        };
        
        // Generate valid crash point for round 1
        initialState.crashPoint = GameEngine.generateCrashPoint(1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
        return initialState;
    },

    // Deterministic Crash Point Generator
    generateCrashPoint: (roundId: number): number => {
        // Use roundId as seed so all clients generate same point for same round
        const rng = mulberry32(roundId * 1337); 
        const r = rng();
        // 1% Instant crash, standard distribution otherwise
        const crashPoint = 0.99 / (1 - r); 
        return Math.max(1.00, crashPoint);
    },

    // The "Server" Tick - call this frequently from clients
    tick: (): { state: GameState, multiplier: number, timeRemaining: number } => {
        let state = GameEngine.getState();
        const now = Date.now();
        const elapsed = now - state.startTime;
        let shouldUpdate = false;

        // --- STATE MACHINE ---
        
        // 1. COUNTDOWN -> RUNNING
        if (state.status === 'COUNTDOWN') {
            if (elapsed >= COUNTDOWN_DURATION) {
                state.status = 'RUNNING';
                state.startTime = now; // Reset timer for running phase
                shouldUpdate = true;
            }
        }
        
        // 2. RUNNING -> CRASHED
        else if (state.status === 'RUNNING') {
            // Calculate current multiplier based on time
            // Formula: M = e^(k * t)
            const elapsedSec = elapsed / 1000;
            const currentMultiplier = Math.exp(GROWTH_CONSTANT * elapsedSec);

            if (currentMultiplier >= state.crashPoint) {
                state.status = 'CRASHED';
                state.startTime = now; // Reset timer for cooldown phase
                
                // Add to history (Keep last 100)
                const newHistory = [state.crashPoint, ...state.history].slice(0, 100);
                state.history = newHistory;
                
                shouldUpdate = true;
            }
        }
        
        // 3. CRASHED -> COUNTDOWN (Next Round)
        else if (state.status === 'CRASHED') {
            if (elapsed >= COOLDOWN_DURATION) {
                state.roundId += 1;
                state.status = 'COUNTDOWN';
                state.startTime = now;
                state.crashPoint = GameEngine.generateCrashPoint(state.roundId);
                shouldUpdate = true;
            }
        }

        // --- PERSISTENCE ---
        if (shouldUpdate) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        // --- CALCULATE LIVE VALUES ---
        let liveMultiplier = 1.00;
        let liveTimeRemaining = 0;

        if (state.status === 'RUNNING') {
            const elapsedSec = (now - state.startTime) / 1000;
            liveMultiplier = Math.exp(GROWTH_CONSTANT * elapsedSec);
            // Cap at crash point to avoid visual overshoot before state update processes
            if (liveMultiplier > state.crashPoint) liveMultiplier = state.crashPoint;
        } else if (state.status === 'CRASHED') {
            liveMultiplier = state.crashPoint;
        }

        if (state.status === 'COUNTDOWN') {
            liveTimeRemaining = Math.max(0, (COUNTDOWN_DURATION - elapsed) / 1000);
        }

        return {
            state,
            multiplier: liveMultiplier,
            timeRemaining: liveTimeRemaining
        };
    }
};