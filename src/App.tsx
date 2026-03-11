/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Home, Sparkles, Download } from 'lucide-react';
import { sounds } from './sounds';

// --- Constants ---
const GRAVITY = 0.4;
const JUMP_STRENGTH = -7;
const BASE_OBSTACLE_SPEED = 3;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_GAP = 180;
const OBSTACLE_SPACING = 300;
const BIRD_SIZE = 34;
const POINTS_PER_BIOME = 15;
const POWERUP_DURATION = 3000; // 3 seconds

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface GoldenFeather {
  x: number;
  y: number;
  active: boolean;
  rotation: number;
}

interface Biome {
  name: string;
  skyTop: string;
  skyBottom: string;
  obstacleColor: string;
  obstacleDetail: string;
  particleColor: string;
  bgElementColor: string;
}

const BIOMES: Biome[] = [
  {
    name: 'FLORESTA',
    skyTop: '#22c55e', // green-500
    skyBottom: '#fef3c7', // amber-50
    obstacleColor: '#78350f', // brown-900
    obstacleDetail: '#451a03',
    particleColor: '#166534',
    bgElementColor: 'rgba(21, 128, 61, 0.2)'
  },
  {
    name: 'MONTANHAS',
    skyTop: '#7dd3fc', // sky-300
    skyBottom: '#f8fafc', // slate-50
    obstacleColor: '#475569', // slate-600
    obstacleDetail: '#1e293b',
    particleColor: '#334155',
    bgElementColor: 'rgba(148, 163, 184, 0.3)'
  },
  {
    name: 'NEVE',
    skyTop: '#e0f2fe', // sky-100
    skyBottom: '#ffffff',
    obstacleColor: '#94a3b8', // slate-400
    obstacleDetail: '#cbd5e1',
    particleColor: '#bae6fd',
    bgElementColor: 'rgba(255, 255, 255, 0.8)'
  },
  {
    name: 'DESERTO',
    skyTop: '#fbbf24', // amber-400
    skyBottom: '#fff7ed', // orange-50
    obstacleColor: '#92400e', // amber-800
    obstacleDetail: '#78350f',
    particleColor: '#d97706',
    bgElementColor: 'rgba(251, 191, 36, 0.2)'
  },
  {
    name: 'ESPAÇO',
    skyTop: '#000000',
    skyBottom: '#1e1b4b', // indigo-950
    obstacleColor: '#334155', // slate-700
    obstacleDetail: '#0f172a',
    particleColor: '#818cf8',
    bgElementColor: 'rgba(255, 255, 255, 0.8)'
  }
];

// Helper to interpolate colors
const lerpColor = (a: string, b: string, amount: number) => {
  const ah = parseInt(a.replace(/#/g, ''), 16),
    ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff,
    bh = parseInt(b.replace(/#/g, ''), 16),
    br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff,
    rr = ar + amount * (br - ar),
    rg = ag + amount * (bg - ag),
    rb = ab + amount * (bb - ab);
  return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('pardal_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isLegendaryUnlocked, setIsLegendaryUnlocked] = useState(() => {
    return localStorage.getItem('pardal_legendary_unlocked') === 'true';
  });
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const [currentBiomeIndex, setCurrentBiomeIndex] = useState(0);
  const [showBiomeNotice, setShowBiomeNotice] = useState(false);
  const [isInvincible, setIsInvincible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Game Refs
  const birdY = useRef(0);
  const birdVelocity = useRef(0);
  const birdRotation = useRef(0);
  const obstacles = useRef<{ x: number; gapTop: number; passed: boolean }[]>([]);
  const bgElements = useRef<{ x: number; y: number; speed: number; scale: number; type: number }[]>([]);
  const particles = useRef<Particle[]>([]);
  const goldenFeather = useRef<GoldenFeather | null>(null);
  const obstacleCount = useRef(0);
  const nextFeatherAt = useRef(Math.floor(Math.random() * 6) + 10); // 10 to 15
  const powerupTimer = useRef<number | null>(null);
  const frameId = useRef<number>(0);
  const lastTime = useRef<number>(0);
  const wingPhase = useRef(0);
  
  // Interpolation Refs
  const transitionProgress = useRef(1); // 0 to 1
  const targetBiomeIndex = useRef(0);
  const prevBiomeIndex = useRef(0);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const initGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    birdY.current = canvas.height / 2;
    birdVelocity.current = 0;
    birdRotation.current = 0;
    setScore(0);
    setCurrentBiomeIndex(0);
    targetBiomeIndex.current = 0;
    prevBiomeIndex.current = 0;
    transitionProgress.current = 1;
    obstacles.current = [];
    particles.current = [];
    goldenFeather.current = null;
    obstacleCount.current = 0;
    nextFeatherAt.current = Math.floor(Math.random() * 6) + 10;
    setIsInvincible(false);
    if (powerupTimer.current) clearTimeout(powerupTimer.current);
    powerupTimer.current = null;
    
    // Initial obstacles
    for (let i = 0; i < 3; i++) {
      addObstacle(canvas.width + i * OBSTACLE_SPACING + 400);
    }
  };

  const addObstacle = (x: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const minGapTop = 100;
    const maxGapTop = canvas.height - OBSTACLE_GAP - 100;
    const gapTop = Math.random() * (maxGapTop - minGapTop) + minGapTop;
    obstacles.current.push({ x, gapTop, passed: false });
    
    obstacleCount.current++;
    if (obstacleCount.current >= nextFeatherAt.current) {
      spawnFeather(x);
      obstacleCount.current = 0;
      nextFeatherAt.current = Math.floor(Math.random() * 6) + 10;
    }
  };

  const spawnFeather = (x: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    goldenFeather.current = {
      x: x + OBSTACLE_SPACING / 2,
      y: Math.random() * (canvas.height - 200) + 100,
      active: true,
      rotation: 0
    };
  };

  const collectFeather = () => {
    if (!goldenFeather.current) return;
    goldenFeather.current.active = false;
    setIsInvincible(true);
    sounds.playPowerUp();
    addParticles(canvasRef.current!.width / 3, birdY.current, '#fbbf24');
    
    if (powerupTimer.current) clearTimeout(powerupTimer.current);
    powerupTimer.current = window.setTimeout(() => {
      setIsInvincible(false);
      powerupTimer.current = null;
    }, POWERUP_DURATION);
  };

  const addParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color
      });
    }
  };

  const jump = () => {
    if (gameState === 'PLAYING') {
      birdVelocity.current = JUMP_STRENGTH;
      sounds.playFlap();
    } else if (gameState === 'START') {
      setGameState('PLAYING');
      initGame();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Init background elements
      if (bgElements.current.length === 0) {
        for (let i = 0; i < 15; i++) {
          bgElements.current.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 0.1 + Math.random() * 0.8,
            scale: 0.5 + Math.random() * 1.5,
            type: Math.floor(Math.random() * 3)
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    initGame();

    const ctx = canvas.getContext('2d')!;

    const update = (time: number) => {
      lastTime.current = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Biome Transition Logic ---
      if (transitionProgress.current < 1) {
        transitionProgress.current += 0.01;
      }

      const currentBiome = BIOMES[prevBiomeIndex.current];
      const targetBiome = BIOMES[targetBiomeIndex.current];
      const p = transitionProgress.current;

      const skyTop = lerpColor(currentBiome.skyTop, targetBiome.skyTop, p);
      const skyBottom = lerpColor(currentBiome.skyBottom, targetBiome.skyBottom, p);
      const obstacleColor = lerpColor(currentBiome.obstacleColor, targetBiome.obstacleColor, p);
      const obstacleDetail = lerpColor(currentBiome.obstacleDetail, targetBiome.obstacleDetail, p);

      // --- Background: Sky ---
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGradient.addColorStop(0, skyTop);
      skyGradient.addColorStop(1, skyBottom);
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- Background Elements (Dynamic per Biome) ---
      ctx.fillStyle = targetBiome.bgElementColor;
      bgElements.current.forEach(el => {
        el.x -= el.speed;
        if (el.x < -100 * el.scale) {
          el.x = canvas.width + 100;
          el.y = Math.random() * canvas.height;
        }
        
        ctx.save();
        ctx.globalAlpha = p * 0.5;
        
        if (targetBiomeIndex.current === 0) { // Forest: Leaves/Trees
          ctx.beginPath();
          ctx.ellipse(el.x, el.y, 10 * el.scale, 5 * el.scale, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (targetBiomeIndex.current === 1) { // Mountains: Peaks
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + 40 * el.scale, el.y - 60 * el.scale);
          ctx.lineTo(el.x + 80 * el.scale, el.y);
          ctx.fill();
        } else if (targetBiomeIndex.current === 2) { // Snow: Flakes
          ctx.beginPath();
          ctx.arc(el.x, el.y, 3 * el.scale, 0, Math.PI * 2);
          ctx.fill();
        } else if (targetBiomeIndex.current === 3) { // Desert: Cacti/Dunes
          ctx.fillRect(el.x, el.y, 10 * el.scale, 30 * el.scale);
        } else if (targetBiomeIndex.current === 4) { // Space: Stars
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(el.x, el.y, 1.5 * el.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (gameState === 'PLAYING') {
        const currentSpeed = BASE_OBSTACLE_SPEED + (targetBiomeIndex.current * 0.5);
        const currentGravity = isInvincible ? GRAVITY * 0.6 : GRAVITY;
        
        // --- Physics ---
        birdVelocity.current += currentGravity;
        birdY.current += birdVelocity.current;
        birdRotation.current = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, birdVelocity.current * 0.1));
        wingPhase.current += 0.2;

        // --- Golden Feather Logic ---
        if (goldenFeather.current && goldenFeather.current.active) {
          goldenFeather.current.x -= currentSpeed;
          goldenFeather.current.rotation += 0.05;
          
          // Collision with Feather
          const birdX = canvas.width / 3;
          const dx = birdX - goldenFeather.current.x;
          const dy = birdY.current - goldenFeather.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < BIRD_SIZE) {
            collectFeather();
          }
          
          if (goldenFeather.current.x < -50) {
            goldenFeather.current = null;
          }
        }

        // --- Obstacles ---
        obstacles.current.forEach((obs) => {
          obs.x -= currentSpeed;

          // Collision Detection
          const birdX = canvas.width / 3;
          const birdR = BIRD_SIZE / 2 - 4;

          if (!isInvincible && birdX + birdR > obs.x && birdX - birdR < obs.x + OBSTACLE_WIDTH) {
            if (birdY.current - birdR < obs.gapTop || birdY.current + birdR > obs.gapTop + OBSTACLE_GAP) {
              setGameState('GAME_OVER');
              sounds.playHit();
              addParticles(birdX, birdY.current, targetBiome.particleColor);
            }
          }

          // Score
          if (!obs.passed && obs.x + OBSTACLE_WIDTH < birdX) {
            obs.passed = true;
            setScore(s => {
              const newScore = s + 1;
              sounds.playScore();
              
              // Legendary Unlock Check
              if (newScore === 50 && !isLegendaryUnlocked) {
                setIsLegendaryUnlocked(true);
                localStorage.setItem('pardal_legendary_unlocked', 'true');
                setShowUnlockCelebration(true);
                addParticles(birdX, birdY.current, '#fbbf24');
                setTimeout(() => setShowUnlockCelebration(false), 4000);
              }

              // Biome Change Check
              if (newScore > 0 && newScore % POINTS_PER_BIOME === 0) {
                const nextIndex = (targetBiomeIndex.current + 1) % BIOMES.length;
                prevBiomeIndex.current = targetBiomeIndex.current;
                targetBiomeIndex.current = nextIndex;
                transitionProgress.current = 0;
                setCurrentBiomeIndex(nextIndex);
                setShowBiomeNotice(true);
                setTimeout(() => setShowBiomeNotice(false), 2000);
              }
              
              return newScore;
            });
          }
        });

        if (obstacles.current[0] && obstacles.current[0].x < -OBSTACLE_WIDTH) {
          obstacles.current.shift();
          const lastObsX = obstacles.current[obstacles.current.length - 1].x;
          addObstacle(lastObsX + OBSTACLE_SPACING);
        }

        if (birdY.current + BIRD_SIZE / 2 > canvas.height || birdY.current - BIRD_SIZE / 2 < 0) {
          setGameState('GAME_OVER');
          sounds.playHit();
          addParticles(canvas.width / 3, birdY.current, targetBiome.particleColor);
        }
      }

      // --- Draw Obstacles ---
      obstacles.current.forEach(obs => {
        ctx.fillStyle = obstacleColor;
        ctx.fillRect(obs.x, 0, OBSTACLE_WIDTH, obs.gapTop);
        ctx.fillRect(obs.x, obs.gapTop + OBSTACLE_GAP, OBSTACLE_WIDTH, canvas.height - (obs.gapTop + OBSTACLE_GAP));
        
        ctx.strokeStyle = obstacleDetail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 10, 0); ctx.lineTo(obs.x + 10, obs.gapTop);
        ctx.moveTo(obs.x + OBSTACLE_WIDTH - 10, 0); ctx.lineTo(obs.x + OBSTACLE_WIDTH - 10, obs.gapTop);
        ctx.moveTo(obs.x + 10, obs.gapTop + OBSTACLE_GAP); ctx.lineTo(obs.x + 10, canvas.height);
        ctx.stroke();
      });

      // --- Draw Particles ---
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
      });
      ctx.globalAlpha = 1.0;

      // --- Draw Golden Feather ---
      if (goldenFeather.current && goldenFeather.current.active) {
        ctx.save();
        ctx.translate(goldenFeather.current.x, goldenFeather.current.y);
        ctx.rotate(goldenFeather.current.rotation);
        
        // Glow
        const glow = Math.sin(time * 0.005) * 5 + 15;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#fbbf24';
        
        // Feather Shape
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
      }

      // --- Draw Bird ---
      const birdX = canvas.width / 3;
      ctx.save();
      ctx.translate(birdX, birdY.current);
      ctx.rotate(birdRotation.current);

      // Invincibility Glow
      if (isInvincible) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fbbf24';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_SIZE / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Sparkle particles around bird
        if (Math.random() > 0.7) {
          addParticles(birdX + (Math.random() - 0.5) * 40, birdY.current + (Math.random() - 0.5) * 40, '#fbbf24');
        }
      }

      // Body
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(0, 5, BIRD_SIZE / 3, BIRD_SIZE / 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      const wingY = Math.sin(wingPhase.current) * 8;
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(-5, wingY, 12, 6, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(10, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(12, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(24, 2);
      ctx.lineTo(16, 4);
      ctx.fill();

      // --- Legendary Accessory: Aviator Goggles ---
      if (isLegendaryUnlocked) {
        // Strap
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(10, -6);
        ctx.stroke();

        // Goggle Frames
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(6, -10, 10, 8, 2);
        ctx.roundRect(14, -10, 10, 8, 2);
        ctx.fill();

        // Lenses
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(8, -8, 6, 4, 1);
        ctx.roundRect(16, -8, 6, 4, 1);
        ctx.fill();
        
        // Shine
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(9, -7, 2, 1);
        ctx.fillRect(17, -7, 2, 1);
        ctx.globalAlpha = 1.0;
      }

      // --- Special Space Gear ---
      if (targetBiomeIndex.current === 4) {
        // Space Helmet
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(10, -4, 12, 0, Math.PI * 2);
        ctx.stroke();
        
        // Rocket Backpack
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-20, -10, 10, 20);
        if (birdVelocity.current < 0) { // Thrusting
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-20, 10);
          ctx.lineTo(-25, 25);
          ctx.lineTo(-15, 25);
          ctx.fill();
        }
      }

      ctx.restore();

      frameId.current = requestAnimationFrame(update);
    };

    frameId.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'GAME_OVER') {
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('pardal_high_score', score.toString());
      }
    }
  }, [gameState, score, highScore]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).code !== 'Space') return;
    e.preventDefault();
    jump();
  };

  return (
    <div 
      className="relative w-full h-screen font-sans select-none overflow-hidden"
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      tabIndex={0}
      onKeyDown={handleInteraction}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* --- UI Overlays --- */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <motion.h1 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="text-6xl font-black text-white drop-shadow-lg mb-2 italic text-center px-4"
            >
              PARDAL WINS
            </motion.h1>
            <p className="text-amber-100 text-lg mb-8 font-medium uppercase tracking-widest">Toque para voar</p>
            
            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); setGameState('PLAYING'); initGame(); }}
                className="bg-amber-500 hover:bg-amber-400 text-white px-12 py-4 rounded-full font-bold text-2xl shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <Play fill="currentColor" /> COMEÇAR
              </button>
              
              <div className="flex items-center gap-2 text-white/80 font-bold bg-black/30 px-4 py-2 rounded-lg">
                <Trophy size={20} className="text-yellow-400" />
                RECORDE: {highScore}
              </div>

              {showInstallBtn && (
                <button 
                  onClick={handleInstallClick}
                  className="mt-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-sm font-bold backdrop-blur-sm border border-white/20 transition-all"
                >
                  <Download size={16} /> INSTALAR APP
                </button>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <>
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-12 left-0 right-0 flex justify-center pointer-events-none"
            >
              <div className="text-7xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                {score}
              </div>
            </motion.div>

            {/* Biome Notice */}
            <AnimatePresence>
              {showBiomeNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="absolute top-32 left-0 right-0 flex justify-center pointer-events-none"
                >
                  <div className="bg-white/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/30 flex items-center gap-2">
                    <Sparkles size={18} className="text-yellow-300" />
                    <span className="text-white font-black tracking-widest uppercase">
                      NOVO CENÁRIO: {BIOMES[currentBiomeIndex].name}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legendary Unlock Celebration */}
            <AnimatePresence>
              {showUnlockCelebration && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50"
                >
                  <motion.div 
                    animate={{ 
                      rotate: [0, -5, 5, -5, 5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="bg-gradient-to-b from-yellow-400 to-amber-600 p-8 rounded-3xl shadow-[0_0_50px_rgba(251,191,36,0.5)] border-4 border-yellow-200 flex flex-col items-center gap-4"
                  >
                    <Trophy size={64} className="text-white drop-shadow-lg" />
                    <div className="text-center">
                      <h3 className="text-white font-black text-3xl italic tracking-tighter">🏆 PARDAL LENDÁRIO</h3>
                      <p className="text-yellow-100 font-bold uppercase text-sm tracking-widest mt-2">DESBLOQUEADO!</p>
                    </div>
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 text-white font-black text-xl bg-black/40 px-6 py-2 rounded-full backdrop-blur-sm"
                  >
                    ÓCULOS DE AVIADOR OBTIDOS
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <motion.h2 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="text-5xl font-black text-red-500 mb-8 drop-shadow-lg"
            >
              GAME OVER
            </motion.h2>
            
            <div className="bg-white/10 p-8 rounded-3xl border border-white/20 mb-8 flex flex-col items-center gap-4 w-64">
              <div className="text-center">
                <p className="text-white/60 uppercase text-xs font-bold tracking-widest">Pontuação</p>
                <p className="text-5xl font-black text-white">{score}</p>
              </div>
              <div className="w-full h-px bg-white/10" />
              <div className="text-center">
                <p className="text-amber-400/60 uppercase text-xs font-bold tracking-widest">Melhor</p>
                <p className="text-3xl font-black text-amber-400">{highScore}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-64">
              <button 
                onClick={(e) => { e.stopPropagation(); setGameState('PLAYING'); initGame(); }}
                className="bg-amber-500 hover:bg-amber-400 text-white w-full py-4 rounded-2xl font-bold text-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={24} /> JOGAR NOVAMENTE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setGameState('START'); }}
                className="bg-white/10 hover:bg-white/20 text-white w-full py-4 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-2"
              >
                <Home size={24} /> MENU
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
