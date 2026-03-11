/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Home, Sparkles, Download } from 'lucide-react';
import { sounds } from './sounds';

// --- Constants ---
const GRAVITY = 0.35;
const JUMP_STRENGTH = -6.5;
const BASE_OBSTACLE_SPEED = 3.5;
const OBSTACLE_WIDTH = 80;
const OBSTACLE_GAP = 160;
const OBSTACLE_SPACING = 350;
const BIRD_SIZE = 40;
const POINTS_PER_BIOME = 10;
const POWERUP_DURATION = 5000; 

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
    name: 'YOSHI ISLAND',
    skyTop: '#5c94fc', // Classic Mario Blue
    skyBottom: '#b0e0ff',
    obstacleColor: '#2ecc71', // Green Pipe
    obstacleDetail: '#27ae60',
    particleColor: '#f1c40f',
    bgElementColor: 'rgba(255, 255, 255, 0.6)'
  },
  {
    name: 'DONUT PLAINS',
    skyTop: '#2980b9',
    skyBottom: '#6dd5fa',
    obstacleColor: '#2ecc71',
    obstacleDetail: '#27ae60',
    particleColor: '#e67e22',
    bgElementColor: 'rgba(46, 204, 113, 0.3)'
  },
  {
    name: 'VANILLA DOME',
    skyTop: '#2c3e50',
    skyBottom: '#000000',
    obstacleColor: '#3498db', // Blue Pipe for underground
    obstacleDetail: '#2980b9',
    particleColor: '#ecf0f1',
    bgElementColor: 'rgba(52, 152, 219, 0.2)'
  },
  {
    name: 'FOREST OF ILLUSION',
    skyTop: '#16a085',
    skyBottom: '#1abc9c',
    obstacleColor: '#e67e22', // Orange Pipe
    obstacleDetail: '#d35400',
    particleColor: '#2ecc71',
    bgElementColor: 'rgba(22, 160, 133, 0.3)'
  },
  {
    name: 'BOWSER CASTLE',
    skyTop: '#c0392b',
    skyBottom: '#000000',
    obstacleColor: '#7f8c8d', // Grey Pipe
    obstacleDetail: '#2c3e50',
    particleColor: '#f1c40f',
    bgElementColor: 'rgba(192, 57, 43, 0.4)'
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
      bgElements.current.forEach(el => {
        el.x -= el.speed;
        if (el.x < -200 * el.scale) {
          el.x = canvas.width + 200;
          el.y = Math.random() * canvas.height;
        }
        
        ctx.save();
        ctx.globalAlpha = p * 0.8;
        
        if (targetBiomeIndex.current === 0 || targetBiomeIndex.current === 1) { 
          // Hills with eyes
          const hillWidth = 150 * el.scale;
          const hillHeight = 100 * el.scale;
          ctx.fillStyle = targetBiome.bgElementColor;
          ctx.beginPath();
          ctx.ellipse(el.x, canvas.height - 50, hillWidth, hillHeight, 0, Math.PI, 0);
          ctx.fill();
          
          // Eyes on hill
          if (el.scale > 1) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(el.x - 10, canvas.height - 80, 4, 8, 0, 0, Math.PI * 2);
            ctx.ellipse(el.x + 10, canvas.height - 80, 4, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.ellipse(el.x - 10, canvas.height - 82, 2, 4, 0, 0, Math.PI * 2);
            ctx.ellipse(el.x + 10, canvas.height - 82, 2, 4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (targetBiomeIndex.current === 4) { // Space: Stars
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(el.x, el.y, 1.5 * el.scale, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Clouds with eyes
          const cloudW = 60 * el.scale;
          const cloudH = 30 * el.scale;
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.roundRect(el.x - cloudW/2, el.y - cloudH/2, cloudW, cloudH, 20);
          ctx.fill();
          
          // Eyes on cloud
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.ellipse(el.x - 5, el.y, 2, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(el.x + 5, el.y, 2, 4, 0, 0, Math.PI * 2);
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
          const birdR = BIRD_SIZE / 2 - 8; // More forgiving hitbox

          if (!isInvincible && birdX + birdR > obs.x && birdX - birdR < obs.x + OBSTACLE_WIDTH) {
            if (birdY.current - birdR < obs.gapTop || birdY.current + birdR > obs.gapTop + OBSTACLE_GAP) {
              setGameState('GAME_OVER');
              sounds.playHit();
              addParticles(birdX, birdY.current, targetBiome.particleColor);
            }
          }

          // Score - Trigger only when the WHOLE bird has passed the pipe
          if (!obs.passed && obs.x + OBSTACLE_WIDTH < birdX - birdR) {
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
                sounds.playTransition();
                sounds.playDialogue();
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

        if (birdY.current + BIRD_SIZE / 2 > canvas.height + 20 || birdY.current - BIRD_SIZE / 2 < -20) {
          setGameState('GAME_OVER');
          sounds.playHit();
          addParticles(canvas.width / 3, birdY.current, targetBiome.particleColor);
        }
      }

      // --- Draw Obstacles (Mario Pipes) ---
      obstacles.current.forEach(obs => {
        const pipeColor = obstacleColor;
        const pipeDetail = obstacleDetail;
        const lipHeight = 30;
        const lipWidth = OBSTACLE_WIDTH + 10;

        // Top Pipe
        ctx.fillStyle = pipeColor;
        ctx.fillRect(obs.x, 0, OBSTACLE_WIDTH, obs.gapTop - lipHeight);
        // Top Pipe Lip
        ctx.fillRect(obs.x - 5, obs.gapTop - lipHeight, lipWidth, lipHeight);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, 0, OBSTACLE_WIDTH, obs.gapTop - lipHeight);
        ctx.strokeRect(obs.x - 5, obs.gapTop - lipHeight, lipWidth, lipHeight);
        
        // Highlights for Top Pipe
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obs.x + 5, 0, 10, obs.gapTop - lipHeight);
        ctx.fillRect(obs.x, obs.gapTop - lipHeight + 5, 10, lipHeight - 10);

        // Bottom Pipe
        ctx.fillStyle = pipeColor;
        ctx.fillRect(obs.x, obs.gapTop + OBSTACLE_GAP + lipHeight, OBSTACLE_WIDTH, canvas.height - (obs.gapTop + OBSTACLE_GAP + lipHeight));
        // Bottom Pipe Lip
        ctx.fillRect(obs.x - 5, obs.gapTop + OBSTACLE_GAP, lipWidth, lipHeight);
        ctx.strokeRect(obs.x, obs.gapTop + OBSTACLE_GAP + lipHeight, OBSTACLE_WIDTH, canvas.height - (obs.gapTop + OBSTACLE_GAP + lipHeight));
        ctx.strokeRect(obs.x - 5, obs.gapTop + OBSTACLE_GAP, lipWidth, lipHeight);

        // Highlights for Bottom Pipe
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obs.x + 5, obs.gapTop + OBSTACLE_GAP + lipHeight, 10, canvas.height);
        ctx.fillRect(obs.x, obs.gapTop + OBSTACLE_GAP + 5, 10, lipHeight - 10);
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

      // Body (Mario Bird Style)
      ctx.fillStyle = isInvincible ? `hsl(${time % 360}, 70%, 60%)` : '#2ecc71'; // Yoshi Green
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_SIZE / 2, BIRD_SIZE / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Belly
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(5, 5, BIRD_SIZE / 3, BIRD_SIZE / 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      const wingY = Math.sin(wingPhase.current) * 10;
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.ellipse(-10, wingY, 15, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(12, -8, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.ellipse(14, -10, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Beak/Nose
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.ellipse(20, 5, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

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
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: -50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl border-8 border-black shadow-[12px_12px_0_0_rgba(0,0,0,0.3)] flex flex-col items-center"
            >
              <h1 className="text-4xl md:text-6xl font-pixel text-amber-500 mb-8 text-center leading-tight drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
                SUPER<br/>PARDAL
              </h1>
              
              <p className="text-black font-pixel text-xs mb-8 animate-pulse">TOQUE PARA VOAR</p>
              
              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={(e) => { e.stopPropagation(); sounds.playClick(); setGameState('PLAYING'); initGame(); }}
                  className="bg-green-500 hover:bg-green-400 text-white px-10 py-4 rounded-xl font-pixel text-lg border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center gap-3"
                >
                  <Play fill="currentColor" size={20} /> START
                </button>
                
                <div className="flex items-center gap-3 text-black font-pixel text-sm bg-amber-100 px-6 py-3 rounded-xl border-4 border-black">
                  <Trophy size={18} className="text-amber-600" />
                  HI-SCORE: {highScore}
                </div>

                {showInstallBtn && (
                  <button 
                    onClick={(e) => { sounds.playClick(); handleInstallClick(e); }}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-6 py-2 rounded-xl text-xs font-pixel border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    <Download size={14} /> INSTALL
                  </button>
                )}
              </div>
            </motion.div>

            {/* Signature */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <p className="text-white font-pixel text-[10px] tracking-widest uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
                By: Leonardo Assunção
              </p>
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
              <div className="text-5xl font-pixel text-white drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
                {score}
              </div>
            </motion.div>

            {/* Biome Notice */}
            <AnimatePresence>
              {showBiomeNotice && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute top-32 left-0 right-0 flex justify-center pointer-events-none"
                >
                  <div className="bg-white p-4 rounded-xl border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex items-center gap-3">
                    <Sparkles size={20} className="text-amber-500" />
                    <span className="text-black font-pixel text-xs">
                      WORLD: {BIOMES[currentBiomeIndex].name}
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
                    className="bg-white p-8 rounded-3xl shadow-[12px_12px_0_0_rgba(0,0,0,0.3)] border-8 border-black flex flex-col items-center gap-4"
                  >
                    <Trophy size={64} className="text-amber-500 drop-shadow-[4px_4px_0_rgba(0,0,0,1)]" />
                    <div className="text-center">
                      <h3 className="text-black font-pixel text-xl leading-tight">LEGENDARY<br/>UNLOCKED!</h3>
                      <p className="text-amber-600 font-pixel text-[10px] mt-4">AVIATOR GOGGLES OBTAINED</p>
                    </div>
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
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white p-8 rounded-3xl border-8 border-black shadow-[12px_12px_0_0_rgba(0,0,0,0.3)] flex flex-col items-center"
            >
              <h2 className="text-3xl font-pixel text-red-500 mb-8 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] text-center">
                GAME OVER
              </h2>
              
              <div className="bg-amber-100 p-6 rounded-xl border-4 border-black mb-8 flex flex-col items-center gap-4 w-64">
                <div className="text-center">
                  <p className="text-black font-pixel text-[10px] mb-2">SCORE</p>
                  <p className="text-4xl font-pixel text-black">{score}</p>
                </div>
                <div className="w-full h-1 bg-black" />
                <div className="text-center">
                  <p className="text-amber-600 font-pixel text-[10px] mb-2">HI-SCORE</p>
                  <p className="text-2xl font-pixel text-amber-600">{highScore}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-64">
                <button 
                  onClick={(e) => { e.stopPropagation(); sounds.playClick(); setGameState('PLAYING'); initGame(); }}
                  className="bg-green-500 hover:bg-green-400 text-white w-full py-4 rounded-xl font-pixel text-sm border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} /> RETRY
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); sounds.playClick(); setGameState('START'); }}
                  className="bg-blue-500 hover:bg-blue-400 text-white w-full py-4 rounded-xl font-pixel text-sm border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                >
                  <Home size={20} /> MENU
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
