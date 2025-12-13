import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/storage';
import { GameEngine, GameState } from '../services/gameEngine';
import { Link } from 'react-router-dom';
import { X, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { User } from '../types';

// --- GAME CONSTANTS ---
const CHART_X_MAX = 20;
const CHART_Y_MAX = 4;
const GROWTH_CONSTANT = 0.0693; // Matches Engine constant
const INDIAN_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Priya", "Ananya", "Diya", "Riya", "Saanvi", "Kabir", "Neha", "Rohan", "Sonia", "Vikram"];

// --- PRNG LOGIC (For Bots) ---
const mulberry32 = (a: number) => {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
};

interface BotPlayer {
    name: string;
    bet: number;
    cashoutAt: number;
    status: 'active' | 'cashed_out' | 'lost';
    profit?: number;
    cashedOutMultiplier?: number;
}

const Game: React.FC = () => {
    // --- STATE ---
    const [balance, setBalance] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState['status']>('IDLE');
    const [multiplier, setMultiplier] = useState(1.00);
    const [countdownTime, setCountdownTime] = useState(0);
    const [history, setHistory] = useState<number[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    
    // User Betting State
    const [betAmount, setBetAmount] = useState(10.00);
    const [cashoutAt, setCashoutAt] = useState(2.00);
    const [hasBet, setHasBet] = useState(false);
    const [isBetActive, setIsBetActive] = useState(false);
    const [cashedOut, setCashedOut] = useState(false);
    const [winAmount, setWinAmount] = useState(0);
    const [userCashoutMultiplier, setUserCashoutMultiplier] = useState(0);
    
    // New State for Next Round Queue and Active Display
    const [activeBetAmount, setActiveBetAmount] = useState(0);
    const [nextRoundBet, setNextRoundBet] = useState<{amount: number, cashoutAt: number} | null>(null);

    // Data State
    const [players, setPlayers] = useState<BotPlayer[]>([]);
    const [activeTab, setActiveTab] = useState<'BET' | 'HOW'>('BET');
    const [isConnecting, setIsConnecting] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Refs for Game Loop
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);
    const animationRef = useRef<number>(0);
    const isMountedRef = useRef(true);
    
    // Engine State Tracking
    const lastRoundIdRef = useRef<number>(0);
    const localGameStateRef = useRef<GameState['status']>('IDLE');
    
    // Refs for Betting Logic (to avoid closure staleness in loop)
    const hasBetRef = useRef(false);
    const isBetActiveRef = useRef(false);
    const cashedOutRef = useRef(false);
    const nextRoundBetRef = useRef<{amount: number, cashoutAt: number} | null>(null);
    const activeRoundConfigRef = useRef<{bet: number, cashoutAt: number}>({ bet: 0, cashoutAt: 2.0 });

    // New Refs to sync Bet Amount/Cashout state with Game Loop
    const betAmountRef = useRef(betAmount);
    const cashoutAtRef = useRef(cashoutAt);

    // Sync Refs with State
    useEffect(() => { nextRoundBetRef.current = nextRoundBet; }, [nextRoundBet]);
    useEffect(() => { betAmountRef.current = betAmount; }, [betAmount]);
    useEffect(() => { cashoutAtRef.current = cashoutAt; }, [cashoutAt]);

    // --- INITIALIZATION ---
    useEffect(() => {
        isMountedRef.current = true;
        
        // Network Event Listeners
        const handleOnline = () => {
            console.log("Network restored");
            setIsOnline(true);
            fetchUserData();
        };
        const handleOffline = () => {
            console.log("Network lost");
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const fetchUserData = async () => {
            try {
                const sessionUser = await ApiService.getSession();
                if (sessionUser) {
                    setUserId(sessionUser.id);
                    // Fetch fresh balance
                    const freshUser = await ApiService.getUser(sessionUser.id);
                    if (freshUser) setBalance(freshUser.balance);
                }
            } catch (e) {
                console.error("Failed to load user", e);
            } finally {
                if(isMountedRef.current) setIsConnecting(false);
            }
        };

        fetchUserData();

        if (chartRef.current && (window as any).Chart) {
            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new (window as any).Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        borderColor: '#FFFFFF',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: {
                            target: 'origin',
                            above: 'rgba(255, 255, 0, 0.4)'
                        },
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: {
                            type: 'linear',
                            display: true,
                            min: 0,
                            max: CHART_X_MAX,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#8a9bad', stepSize: 4, callback: (v: any) => `${v}s` }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            min: 1,
                            max: CHART_Y_MAX,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#8a9bad', stepSize: 1, callback: (v: any) => `${Number(v).toFixed(1)}x` }
                        }
                    },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        }

        startEngineLoop();

        return () => {
            isMountedRef.current = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, []);

    // --- ENGINE LOOP ---
    const startEngineLoop = () => {
        const loop = () => {
            if (!isMountedRef.current) return;

            // Only update game state if online or connecting (allow catch-up)
            // If completely offline for long period, we still run calculation so when
            // UI shows again, it jumps to correct current time.
            const { state, multiplier, timeRemaining } = GameEngine.tick();
            
            // 2. Sync Global State
            setMultiplier(multiplier);
            setCountdownTime(timeRemaining);
            setHistory(state.history);
            
            // 3. Handle Round Transitions
            if (state.roundId !== lastRoundIdRef.current) {
                handleNewRound(state);
                lastRoundIdRef.current = state.roundId;
            }

            // 4. Handle Phase Transitions (State Machine Reactions)
            if (state.status !== localGameStateRef.current) {
                handleStatusChange(state.status, localGameStateRef.current);
                localGameStateRef.current = state.status;
                setGameState(state.status);
            }

            // 5. Running Logic
            if (state.status === 'RUNNING') {
                handleRunningLoop(multiplier, state.startTime);
            } 
            else if (state.status === 'CRASHED' && chartInstance.current) {
                 // Ensure visual consistency on crash
                 if (chartInstance.current.data.datasets[0].borderColor !== '#ff5252') {
                    chartInstance.current.data.datasets[0].borderColor = '#ff5252';
                    chartInstance.current.data.datasets[0].fill.above = 'rgba(255, 82, 82, 0.2)';
                    chartInstance.current.update();
                 }
            }

            animationRef.current = requestAnimationFrame(loop);
        };
        animationRef.current = requestAnimationFrame(loop);
    };

    // --- LOGIC HANDLERS ---

    const handleNewRound = (state: GameState) => {
        // Reset User State for new round
        setWinAmount(0);
        setUserCashoutMultiplier(0);
        setCashedOut(false);
        cashedOutRef.current = false;
        setIsBetActive(false);
        isBetActiveRef.current = false;

        // Reset Chart
        if (chartInstance.current) {
            chartInstance.current.data.labels = [];
            chartInstance.current.data.datasets[0].data = [];
            chartInstance.current.data.datasets[0].borderColor = '#FFFFFF'; 
            chartInstance.current.data.datasets[0].fill.above = 'rgba(255, 255, 0, 0.4)';
            chartInstance.current.update();
        }

        // Generate Deterministic Bots for this round
        const seed = state.roundId * 12345;
        const rng = mulberry32(seed);
        const botCount = Math.floor(rng() * 10) + 5;
        const newBots: BotPlayer[] = [];
        for(let i=0; i<botCount; i++) {
            newBots.push({
                name: INDIAN_NAMES[Math.floor(rng() * INDIAN_NAMES.length)],
                bet: parseFloat((rng() * 500 + 10).toFixed(2)),
                cashoutAt: parseFloat((rng() * 5 + 1.1).toFixed(2)),
                status: 'active'
            });
        }
        setPlayers(newBots);

        // Promote "Next Round Bet" to Current Bet
        if (nextRoundBetRef.current) {
            setHasBet(true);
            hasBetRef.current = true;
            setBetAmount(nextRoundBetRef.current.amount);
            setCashoutAt(nextRoundBetRef.current.cashoutAt);
            setNextRoundBet(null);
            nextRoundBetRef.current = null;
        } else {
            setHasBet(false);
            hasBetRef.current = false;
        }
    };

    const handleStatusChange = (newStatus: GameState['status'], oldStatus: GameState['status']) => {
        if (newStatus === 'RUNNING') {
            // Round Started
            if (hasBetRef.current) {
                setIsBetActive(true);
                isBetActiveRef.current = true;
                // Snapshot the bet config from REFS to ensure we have the latest value
                activeRoundConfigRef.current = {
                    bet: betAmountRef.current, 
                    cashoutAt: cashoutAtRef.current
                };
                setActiveBetAmount(betAmountRef.current);
            }
        } else if (newStatus === 'CRASHED') {
            // Round Crashed
            setIsBetActive(false);
            isBetActiveRef.current = false;
            
            // Mark active bots as lost
            setPlayers(prev => prev.map(p => {
                if (p.status === 'active') return { ...p, status: 'lost' };
                return p;
            }));
            
            // Sync balance occasionally to ensure consistency
            if (userId) {
                ApiService.getUser(userId).then(u => {
                    if(u && isMountedRef.current) setBalance(u.balance);
                });
            }
        }
    };

    const handleRunningLoop = (currentM: number, startTime: number) => {
        // Update Chart
        const elapsedSec = (Date.now() - startTime) / 1000;
        if (chartInstance.current && elapsedSec <= CHART_X_MAX) {
            const data = chartInstance.current.data;
            
            // Backfill Logic
            if (data.labels.length === 0 && elapsedSec > 0.1) {
                for(let t = 0; t < elapsedSec; t+=0.1) {
                    data.labels.push(t);
                    data.datasets[0].data.push(Math.exp(GROWTH_CONSTANT * t));
                }
            }

            // Throttle chart updates slightly for performance
            if (data.labels.length === 0 || elapsedSec - data.labels[data.labels.length-1] > 0.05) {
                data.labels.push(elapsedSec);
                data.datasets[0].data.push(currentM);
                if (currentM > chartInstance.current.options.scales.y.max) {
                    chartInstance.current.options.scales.y.max = currentM * 1.1;
                }
                chartInstance.current.update('none');
            }
        }

        // Check Auto-Cashout
        const targetCashout = activeRoundConfigRef.current.cashoutAt;
        if (isBetActiveRef.current && !cashedOutRef.current && currentM >= targetCashout) {
            triggerCashout(targetCashout);
        }

        // Update Bots
        setPlayers(prev => prev.map(p => {
            if (p.status === 'active' && currentM >= p.cashoutAt) {
                return { ...p, status: 'cashed_out', cashedOutMultiplier: p.cashoutAt, profit: p.bet * (p.cashoutAt - 1) };
            }
            return p;
        }));
    };

    // --- USER ACTIONS ---

    const updateBetAmount = (newVal: number) => {
        // Allow decimals during typing (removed strict .toFixed(2) logic)
        const newAmount = Math.max(0, newVal);
        if (newAmount === betAmount) return;

        // Logic: allow changing amount anytime. 
        // If bet is "Locked" (queued for next round OR waiting for current countdown), we adjust balance.
        const isLockedBet = !!nextRoundBet || (hasBet && !isBetActive);
        
        if (isLockedBet && userId) {
            const diff = newAmount - betAmount;
            if (diff > 0 && balance < diff) return; // Insufficient balance
            
            // Optimistic Update
            setBalance(prev => prev - diff);
            ApiService.updateBalance(userId, -diff);
            
            if (nextRoundBet) {
                setNextRoundBet(prev => prev ? ({ ...prev, amount: newAmount }) : null);
            }
        }
        setBetAmount(newAmount);
    };

    const updateCashoutAt = (newVal: number) => {
        newVal = Math.max(1.01, parseFloat(newVal.toFixed(2)));
        if (nextRoundBet) {
             setNextRoundBet(prev => prev ? ({ ...prev, cashoutAt: newVal }) : null);
        }
        setCashoutAt(newVal);
    };

    const placeBet = () => {
        if (!isOnline) {
            alert("Waiting for connection...");
            return;
        }
        if (betAmount < 10) {
            alert("Minimum bet amount is ₹10");
            return;
        }
        if (betAmount > balance) {
            alert("Insufficient Balance");
            return;
        }
        if (!userId) return;

        // Queue Bet for Next Round if Current Round is Active
        if (gameState === 'RUNNING' && isBetActiveRef.current && cashedOutRef.current) {
             setNextRoundBet({ amount: betAmount, cashoutAt: cashoutAt });
             // Optimistic Update
             setBalance(prev => prev - betAmount);
             ApiService.updateBalance(userId, -betAmount);
             return;
        }
        
        // Standard Bet Placement (Countdown or Idle)
        setHasBet(true);
        hasBetRef.current = true;

        // Optimistic Update
        setBalance(prev => prev - betAmount);
        ApiService.updateBalance(userId, -betAmount);
    };

    const cancelBet = () => {
        if (!userId) return;

        // Cancel Next Round Bet
        if (nextRoundBet) {
            // Refund
            ApiService.updateBalance(userId, nextRoundBet.amount);
            setBalance(prev => prev + nextRoundBet.amount);
            setNextRoundBet(null);
            return;
        }

        // Cancel Standard Bet (if not yet running)
        if (isBetActiveRef.current) return; // Can't cancel active bet

        setHasBet(false);
        hasBetRef.current = false;

        // Refund
        ApiService.updateBalance(userId, betAmount);
        setBalance(prev => prev + betAmount);
    };

    const triggerCashout = (atMultiplier: number) => {
        if (!isBetActiveRef.current || cashedOutRef.current) return;
        if (!userId) return;
        
        // Use snapshotted bet amount
        const currentBet = activeRoundConfigRef.current.bet; 
        const winnings = currentBet * atMultiplier;
        
        // Optimistic Update
        setBalance(prev => prev + winnings);
        ApiService.updateBalance(userId, winnings);
        
        setWinAmount(winnings);
        setUserCashoutMultiplier(atMultiplier);
        setCashedOut(true);
        cashedOutRef.current = true;
    };

    const profitOnWin = (isNaN(betAmount) ? 0 : betAmount * (cashoutAt - 1)).toFixed(2);

    return (
        <div className="flex justify-center items-center min-h-screen p-2.5 text-gray-200 font-sans bg-[#0f212e]">
            
            {/* Connection Status Overlays */}
            {(isConnecting || !isOnline) && (
                <div className="fixed inset-0 bg-[rgba(15,33,46,0.95)] backdrop-blur-sm flex flex-col justify-center items-center z-[2000] transition-opacity duration-300">
                    <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-[#1f2933] border border-[#2d4557] shadow-2xl">
                        {!isOnline ? (
                            <>
                                <WifiOff size={48} className="text-[#ff5252] animate-pulse" />
                                <h2 className="text-xl font-bold text-white">No Connection</h2>
                                <div className="flex items-center gap-2 text-[#8a9bad]">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Reconnecting...</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <Loader2 size={48} className="text-[#00d8ff] animate-spin" />
                                <h2 className="text-xl font-bold text-white">Connecting to Server...</h2>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="w-full max-w-[500px] lg:max-w-[1100px] bg-[#0f212e] rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-400">
                {/* Header */}
                <header className="flex justify-between items-center p-4 sm:p-5 border-b border-[#2d4557]">
                    <Link to="/" className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#00d8ff] to-[#5eafff] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,216,255,0.6)] group-hover:scale-105 transition-transform">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L1.5 6.5L12 11L22.5 6.5L12 2Z M12 13L1.5 8.5V17.5L12 22L22.5 17.5V8.5L12 13Z" fill="white"/>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold text-white no-underline">Crash</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        {/* Network Quality Indicator */}
                        <div className={`hidden sm:flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border ${isOnline ? 'border-[#00e700] text-[#00e700] bg-[rgba(0,231,0,0.1)]' : 'border-[#ff5252] text-[#ff5252] bg-[rgba(255,82,82,0.1)]'}`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            {isOnline ? "ONLINE" : "OFFLINE"}
                        </div>
                        <div className="bg-[#2c3a47] py-2 px-4 rounded-full font-bold text-sm text-white">
                            ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </header>
                
                {/* History Bar */}
                <div className="flex items-center p-4 sm:px-5 gap-2">
                    {/* Show only recent 20 in the bar to keep it tidy */}
                    <div className="flex gap-2 overflow-x-auto flex-grow no-scrollbar">
                        {history.slice(0, 20).map((h, i) => (
                            <div key={i} className={`flex-shrink-0 py-1.5 px-4 rounded-full text-sm font-bold ${h >= 2 ? "bg-[#00e700] text-black" : "bg-[#2c3a47] text-[#8a9bad]"}`}>
                                {h.toFixed(2)}x
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowHistoryModal(true)}
                        className="flex-shrink-0 bg-[#2c3a47] border border-[#2d4557] text-[#8a9bad] py-1.5 px-3 rounded-md font-bold text-sm transition-colors hover:bg-[#2d4557]"
                    >
                        See All
                    </button>
                </div>

                {/* Main Content Area */}
                <main className="lg:flex lg:gap-5 lg:p-5">
                    
                    {/* Left Column */}
                    <div className="lg:flex-[1.8] flex flex-col">
                        
                        {/* Chart Area */}
                        <div className={`relative m-4 lg:m-0 h-80 rounded-lg bg-[#1f2933] overflow-hidden p-2.5 transition-shadow duration-500 ${gameState === 'CRASHED' ? 'shadow-[0_0_20px_rgba(255,82,82,0.3)]' : isBetActive && gameState === 'RUNNING' ? 'shadow-[0_0_20px_rgba(0,255,0,0.3)]' : ''}`}>
                            
                            {/* Crash/Multiplier Message */}
                            <div className="absolute inset-0 flex flex-col justify-center items-center z-10 pointer-events-none">
                                {gameState === 'COUNTDOWN' && (
                                    <h2 className="text-2xl sm:text-3xl font-bold text-[#8a9bad]">Next round in {countdownTime.toFixed(0)}s...</h2>
                                )}
                                {gameState === 'RUNNING' && (
                                    <h2 className="text-5xl sm:text-7xl font-black transition-all duration-300 text-[#00ff00] text-shadow-custom">
                                        {multiplier.toFixed(2)}x
                                    </h2>
                                )}
                                {gameState === 'CRASHED' && (
                                    <>
                                        <h2 className="text-5xl sm:text-7xl font-black transition-all duration-300 text-[#ff5252] text-shadow-custom scale-110">CRASHED!</h2>
                                        <p className="text-3xl font-bold mt-2 text-white">{multiplier.toFixed(2)}x</p>
                                    </>
                                )}
                            </div>

                            {/* Cashout Display */}
                            {cashedOut && gameState !== 'CRASHED' && (
                                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[rgba(0,231,0,0.8)] text-white py-2 px-4 rounded-full text-base font-bold z-20 shadow-[0_0_15px_rgba(0,231,0,0.6)] whitespace-nowrap">
                                    Cashed Out ₹{winAmount.toFixed(2)} @ {userCashoutMultiplier.toFixed(2)}x
                                </div>
                            )}

                            <canvas ref={chartRef}></canvas>
                            
                            <div className="absolute bottom-2.5 right-4 text-xs text-[#8a9bad] flex items-center gap-1.5 z-5">
                                <span className={`w-2 h-2 rounded-full shadow-[0_0_5px] ${isOnline ? 'bg-[#00e700] shadow-[#00e700]' : 'bg-[#ff5252] shadow-[#ff5252]'}`}></span>
                                <span>{isOnline ? 'Live' : 'Reconnecting'}</span>
                            </div>
                        </div>

                        {/* Controls Panel */}
                        <div className="m-4 lg:m-0 lg:mt-5 lg:p-5 lg:bg-[#0f212e] lg:rounded-lg">
                            {/* Main Action Button */}
                            {gameState === 'RUNNING' && isBetActive && !cashedOut ? (
                                <button 
                                    onClick={() => triggerCashout(multiplier)}
                                    className="w-full border-none p-4 rounded-lg text-xl font-bold cursor-pointer transition-all duration-300 mb-5 bg-[#ff5252] glow-red text-white"
                                >
                                    CASHOUT ₹{(activeBetAmount * multiplier).toFixed(2)}
                                </button>
                            ) : nextRoundBet ? (
                                // User has queued a bet for next round
                                <button 
                                    onClick={cancelBet}
                                    className="w-full border-none p-4 rounded-lg text-xl font-bold cursor-pointer transition-all duration-300 mb-5 bg-[#fbc02d] glow-yellow text-black"
                                >
                                    CANCEL (Next Round)
                                </button>
                            ) : hasBet && isBetActive ? (
                                // User Cashed Out of current round -> Can Bet Next Round
                                <button 
                                    onClick={placeBet}
                                    className="w-full border-none p-4 rounded-lg text-xl font-bold cursor-pointer transition-all duration-300 mb-5 bg-[#00ff00] glow-green text-black"
                                >
                                    BET (Next Round)
                                </button>
                            ) : hasBet ? (
                                // User has bet (Next Round or Countdown) - NOT Active in current running game
                                <button 
                                    onClick={cancelBet}
                                    className="w-full border-none p-4 rounded-lg text-xl font-bold cursor-pointer transition-all duration-300 mb-5 bg-[#fbc02d] glow-yellow text-black"
                                >
                                    CANCEL {gameState === 'RUNNING' ? "(Next Round)" : ""}
                                </button>
                            ) : (
                                // No bet
                                <button 
                                    onClick={placeBet}
                                    className="w-full border-none p-4 rounded-lg text-xl font-bold cursor-pointer transition-all duration-300 mb-5 bg-[#00ff00] glow-green text-black"
                                >
                                    BET {gameState === 'RUNNING' ? "(Next Round)" : ""}
                                </button>
                            )}

                            {/* Tabs */}
                            <div className="flex mb-6 border-b border-[#2d4557]">
                                <div 
                                    onClick={() => setActiveTab('BET')} 
                                    className={`pb-3 mr-5 cursor-pointer border-b-2 text-base font-medium ${activeTab === 'BET' ? 'border-[#00d8ff] text-gray-200' : 'border-transparent text-[#8a9bad]'}`}
                                >
                                    Bet
                                </div>
                                <div 
                                    onClick={() => setActiveTab('HOW')} 
                                    className={`pb-3 mr-5 cursor-pointer border-b-2 text-base font-medium ${activeTab === 'HOW' ? 'border-[#00d8ff] text-gray-200' : 'border-transparent text-[#8a9bad]'}`}
                                >
                                    How to Play
                                </div>
                            </div>

                            {/* Bet Inputs */}
                            {activeTab === 'BET' && (
                                <div id="betPanel">
                                    <div className="mb-6">
                                        <label className="block mb-2.5 text-sm font-medium text-[#8a9bad]">Bet Amount (Min ₹10)</label>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center bg-[#2c3a47] rounded-md min-h-[50px]">
                                                <span className="text-gray-200 font-bold pl-3.5">₹</span>
                                                <input 
                                                    type="number" 
                                                    value={betAmount} 
                                                    onChange={e => updateBetAmount(Number(e.target.value))}
                                                    className="flex-grow bg-transparent border-none text-white p-3.5 outline-none text-base font-bold w-20"
                                                />
                                                <div className="flex flex-col p-1 border-l border-[#0f212e]">
                                                    <button onClick={() => updateBetAmount(betAmount + 10)} className="text-[#8a9bad] hover:text-white px-2 cursor-pointer">
                                                        <svg className="w-6 h-4.5" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z" fill="currentColor"></path></svg>
                                                    </button>
                                                    <button onClick={() => updateBetAmount(betAmount - 10)} className="text-[#8a9bad] hover:text-white px-2 cursor-pointer">
                                                        <svg className="w-6 h-4.5" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z" fill="currentColor"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => updateBetAmount(Math.floor(betAmount / 2))} className="bg-[#2c3a47] text-gray-200 font-bold py-2 rounded-md hover:bg-[#3f4e5a] transition-colors">½</button>
                                                <button onClick={() => updateBetAmount(betAmount * 2)} className="bg-[#2c3a47] text-gray-200 font-bold py-2 rounded-md hover:bg-[#3f4e5a] transition-colors">2x</button>
                                                <button onClick={() => updateBetAmount(Math.floor(balance + betAmount))} className="bg-[#2c3a47] text-gray-200 font-bold py-2 rounded-md hover:bg-[#3f4e5a] transition-colors">MAX</button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-6">
                                        <label className="block mb-2.5 text-sm font-medium text-[#8a9bad]">Cashout At</label>
                                        <div className="flex items-center bg-[#2c3a47] rounded-md min-h-[50px]">
                                            <input 
                                                type="number" 
                                                value={cashoutAt} 
                                                onChange={e => updateCashoutAt(Number(e.target.value))}
                                                step="0.1" 
                                                className="flex-grow bg-transparent border-none text-white p-3.5 outline-none text-base font-bold w-20"
                                            />
                                            <span className="text-gray-200 font-bold pr-3.5">x</span>
                                            <div className="flex flex-col p-1">
                                                <button onClick={() => updateCashoutAt(cashoutAt + 0.1)} className="text-[#8a9bad] hover:text-white">
                                                    <svg className="w-6 h-4.5" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z" fill="currentColor"></path></svg>
                                                </button>
                                                <button onClick={() => updateCashoutAt(cashoutAt - 0.1)} className="text-[#8a9bad] hover:text-white">
                                                    <svg className="w-6 h-4.5" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z" fill="currentColor"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between text-[#8a9bad] text-sm font-medium -mt-4">
                                        <span>Profit on Win</span>
                                        <span className="font-bold text-[#00e700]">₹{profitOnWin}</span>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'HOW' && (
                                <div className="text-[#8a9bad] text-sm leading-relaxed">
                                    <h4 className="text-gray-200 mt-0 mb-2.5 font-bold">Objective</h4>
                                    <p className="mb-4">The goal is to cash out your bet before the rocket crashes. The longer you wait, the higher the multiplier gets, but so does the risk!</p>
                                    <h4 className="text-gray-200 mt-0 mb-2.5 font-bold">How to Play</h4>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li><strong>Place Your Bet:</strong> Enter your bet amount and an optional "Cashout At" multiplier before the round begins.</li>
                                        <li><strong>Watch the Multiplier:</strong> Once the round starts, the multiplier will begin to increase from 1.00x.</li>
                                        <li><strong>Cash Out:</strong> Click the "CASHOUT" button at any time to lock in your winnings. If the rocket crashes before you cash out, you lose your bet.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Players */}
                    <div className="lg:flex-1 flex flex-col">
                        <div className="m-4 lg:m-0 bg-[#0f212e] rounded-lg flex flex-col overflow-hidden lg:h-full">
                            <div className="flex justify-between p-3 sm:px-4 text-xs font-bold text-[#8a9bad] bg-[#161e25]">
                                <div className="flex-[2]">Player</div>
                                <div className="flex-1 text-right">Bet</div>
                                <div className="flex-1 text-right">Cashout</div>
                                <div className="flex-1 text-right">Profit</div>
                            </div>
                            <div className="overflow-y-auto lg:flex-grow h-[300px] lg:h-auto">
                                {/* Current User */}
                                {(hasBet || isBetActive) && (
                                    <div className={`flex justify-between p-2.5 sm:px-4 text-sm border-b border-[#3f4e5a] transition-all duration-300 ${cashedOut ? "bg-[rgba(0,231,0,0.1)]" : ""}`}>
                                        <div className="flex-[2] font-medium text-white">YOU</div>
                                        {/* Use activeBetAmount if playing/cashed out to show the actual bet, otherwise (waiting) show current input amount */}
                                        <div className="flex-1 text-right text-[#8a9bad]">₹{(isBetActive ? activeBetAmount : betAmount).toFixed(2)}</div>
                                        <div className="flex-1 text-right font-bold text-[#00d8ff]">
                                            {cashedOut ? `${userCashoutMultiplier.toFixed(2)}x` : "-"}
                                        </div>
                                        <div className={`flex-1 text-right font-bold ${cashedOut ? "text-[#00e700]" : "text-[#8a9bad]"}`}>
                                            {cashedOut ? `₹${winAmount.toFixed(2)}` : "-"}
                                        </div>
                                    </div>
                                )}
                                {/* Bots */}
                                {players.map((e, idx) => {
                                    const profit = e.status === "cashed_out" && e.cashedOutMultiplier ? (e.bet * (e.cashedOutMultiplier - 1)).toFixed(2) : `-${e.bet.toFixed(2)}`;
                                    const rowClass = e.status === "cashed_out" ? "bg-[rgba(0,231,0,0.1)]" : e.status === "lost" ? "opacity-50" : "";
                                    const profitColor = e.status === "lost" ? "text-[#ff5252]" : "text-[#00e700]";
                                    return (
                                        <div key={idx} className={`flex justify-between p-2.5 sm:px-4 text-sm border-b border-[#3f4e5a] transition-all duration-300 ${rowClass}`}>
                                            <div className="flex-[2] font-medium text-gray-300">{e.name}</div>
                                            <div className="flex-1 text-right text-[#8a9bad]">₹{e.bet.toFixed(2)}</div>
                                            <div className="flex-1 text-right font-bold text-[#00d8ff]">
                                                {e.status === "cashed_out" && e.cashedOutMultiplier ? `${e.cashedOutMultiplier.toFixed(2)}x` : "-"}
                                            </div>
                                            <div className={`flex-1 text-right font-bold ${e.status !== "active" ? profitColor : "text-[#8a9bad]"}`}>
                                                {e.status !== "active" ? `₹${profit}` : "-"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            
            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-[#0f212e] w-full max-w-lg rounded-xl border border-[#2d4557] flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-[#2d4557] flex justify-between items-center bg-[#1f2933] rounded-t-xl">
                            <h3 className="font-bold text-xl text-white">Round History (Last 100)</h3>
                            <button onClick={() => setShowHistoryModal(false)} className="text-[#8a9bad] hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-2 custom-scrollbar">
                            {history.map((h, i) => (
                                <div key={i} className={`py-2 px-1 rounded text-center text-sm font-bold ${h >= 2 ? "bg-[#00e700] text-black" : "bg-[#2c3a47] text-[#8a9bad]"}`}>
                                    {h.toFixed(2)}x
                                </div>
                            ))}
                            {history.length === 0 && <div className="col-span-full text-center text-gray-500 py-4">No history available yet.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game;