import { useEffect, useRef, useCallback, useState } from "react";
import "./App.css";

const W = 400, H = 600, CHAR_R = 18, PIPE_W = 52, GRAVITY = 0.25, FLAP = -7.5;
const LEVELS = {
  easy: { gap: 260, speed: 3.8, label: "Easy" },
  medium: { gap: 180, speed: 2.8, label: "Medium" },
  hard: { gap: 120, speed: 3.2, label: "Hard" },
};
type Difficulty = keyof typeof LEVELS;
const MAX_CHANCES = 5;

interface Pipe { x: number; gapY: number; scored: boolean }

let isMuted = false;

const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
function playSound(freq: number, dur: number, type: OscillatorType = "sine") {
  if (isMuted) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
const sndFlap = () => playSound(600, 0.1, "triangle");
const sndScore = () => { playSound(880, 0.12); setTimeout(() => playSound(1100, 0.15), 80); };
const sndCrash = () => playSound(200, 0.35, "sawtooth");

const partyNotes = [
  { f: 262, d: 0.25 }, { f: 262, d: 0.25 }, { f: 294, d: 0.5 }, { f: 262, d: 0.5 },
  { f: 349, d: 0.5 }, { f: 330, d: 1 }, { f: 262, d: 0.25 }, { f: 262, d: 0.25 },
  { f: 294, d: 0.5 }, { f: 262, d: 0.5 }, { f: 392, d: 0.5 }, { f: 349, d: 1 },
  { f: 262, d: 0.25 }, { f: 262, d: 0.25 }, { f: 523, d: 0.5 }, { f: 440, d: 0.5 },
  { f: 349, d: 0.5 }, { f: 330, d: 0.5 }, { f: 294, d: 0.5 }, { f: 466, d: 0.25 },
  { f: 466, d: 0.25 }, { f: 440, d: 0.5 }, { f: 349, d: 0.5 }, { f: 392, d: 0.5 }, { f: 349, d: 1 },
];
let partyInterval: ReturnType<typeof setTimeout> | null = null;
function startPartyMusic() {
  stopPartyMusic();
  if (isMuted) return;
  let i = 0;
  const playNext = () => {
    if (isMuted) { stopPartyMusic(); return; }
    const note = partyNotes[i % partyNotes.length];
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "triangle"; o.frequency.value = note.f;
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.d * 0.9);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + note.d);
    i++;
    partyInterval = setTimeout(playNext, note.d * 400);
  };
  playNext();
}
function stopPartyMusic() {
  if (partyInterval) { clearTimeout(partyInterval); partyInterval = null; }
}

function spawnConfetti() {
  const c = document.createElement("canvas");
  c.width = window.innerWidth; c.height = window.innerHeight;
  c.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;z-index:999";
  document.body.appendChild(c);
  const ctx = c.getContext("2d")!;
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * c.width, y: Math.random() * -c.height,
    r: Math.random() * 6 + 3, color: "hsl(" + String(Math.random() * 360) + ",90%,65%)",
    vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4 + 2, spin: Math.random() * 0.2,
  }));
  let frame = 0;
  const animate = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * frame);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 0.8);
      ctx.restore();
    });
    frame++;
    if (frame < 120) requestAnimationFrame(animate); else document.body.removeChild(c);
  };
  animate();
}

function drawBirdOriginal(ctx: CanvasRenderingContext2D, x: number, y: number, vel: number, dead: boolean) {
  const angle = Math.min(Math.max(vel * 3, -30), 70) * Math.PI / 180;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.ellipse(0, 0, CHAR_R, CHAR_R * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#F9A825"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#FFCA28"; ctx.beginPath();
  const wingY = dead ? 4 : Math.sin(Date.now() / 60) * 5;
  ctx.ellipse(-6, wingY, 10, 6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(8, -5, 6, 0, Math.PI * 2); ctx.fill();
  if (dead) {
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(12, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(6, -3); ctx.stroke();
  } else {
    ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(9.5, -5, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#FF7043"; ctx.beginPath(); ctx.moveTo(14, -1); ctx.lineTo(22, 2); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,138,128,0.45)"; ctx.beginPath(); ctx.arc(4, 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTeenGirl(ctx: CanvasRenderingContext2D, x: number, y: number, _vel: number, dead: boolean) {
  const bounce = dead ? 0 : Math.sin(Date.now() / 80) * 3;
  const legKick = dead ? 0 : Math.sin(Date.now() / 100) * 10;
  const armSwing = dead ? 0 : Math.sin(Date.now() / 120) * 15;
  ctx.save(); ctx.translate(x, y + bounce);
  ctx.fillStyle = "#FFDAB9";
  ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#E8C39E"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = "#F0D060";
  ctx.beginPath(); ctx.arc(0, -27, 10, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-10, -18, 4, 12, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -18, 4, 12, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4, -35); ctx.quadraticCurveTo(0, -38, 4, -35);
  ctx.fillStyle = "#9C27B0"; ctx.fill();
  if (dead) {
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-5, -24); ctx.lineTo(-1, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -24); ctx.lineTo(-5, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -24); ctx.lineTo(5, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -24); ctx.lineTo(1, -20); ctx.stroke();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -17, 3, 0, Math.PI); ctx.stroke();
  } else {
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(-4, -22, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -22, 3, 0, Math.PI * 2); ctx.fill();
    const blink = Math.sin(Date.now() / 2000) > 0.95;
    if (blink) {
      ctx.strokeStyle = "#333"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(-2, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -22); ctx.lineTo(6, -22); ctx.stroke();
    } else {
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.arc(-4, -22, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -22, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath(); ctx.arc(-3.5, -22.5, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4.5, -22.5, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#FF8A80"; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(-8, -18, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -18, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#E57373";
    ctx.beginPath(); ctx.arc(0, -17, 2, 0, Math.PI); ctx.fill();
  }
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(9, -2); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#ddd"; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = "#7B1FA2";
  ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(9, -2); ctx.lineTo(10, 2); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5C6BC0";
  ctx.save(); ctx.translate(-4, 2); ctx.rotate(legKick * Math.PI / 180);
  ctx.fillRect(-3, 0, 6, 16); ctx.restore();
  ctx.save(); ctx.translate(4, 2); ctx.rotate(-legKick * Math.PI / 180);
  ctx.fillRect(-3, 0, 6, 16); ctx.restore();
  ctx.fillStyle = "white";
  ctx.save(); ctx.translate(-4, 18); ctx.rotate(legKick * Math.PI / 180);
  ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(4, 18); ctx.rotate(-legKick * Math.PI / 180);
  ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#FFDAB9";
  ctx.save(); ctx.translate(-8, -10); ctx.rotate((-25 + armSwing) * Math.PI / 180);
  ctx.fillRect(-2, 0, 4, 12); ctx.restore();
  ctx.save(); ctx.translate(8, -10); ctx.rotate((25 - armSwing) * Math.PI / 180);
  ctx.fillRect(-2, 0, 4, 12); ctx.restore();
  ctx.restore();
}

function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, vel: number, dead: boolean, party: boolean) {
  if (party) drawTeenGirl(ctx, x, y, vel, dead); else drawBirdOriginal(ctx, x, y, vel, dead);
}

function drawPipeOriginal(ctx: CanvasRenderingContext2D, x: number, gapY: number, gap: number) {
  const topH = gapY - gap / 2, botY = gapY + gap / 2;
  const gTop = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  gTop.addColorStop(0, "#81C784"); gTop.addColorStop(0.5, "#A5D6A7"); gTop.addColorStop(1, "#66BB6A");
  ctx.fillStyle = gTop; ctx.fillRect(x, 0, PIPE_W, topH);
  ctx.fillStyle = "#66BB6A"; ctx.fillRect(x - 4, topH - 20, PIPE_W + 8, 20);
  ctx.strokeStyle = "#388E3C"; ctx.lineWidth = 1.5; ctx.strokeRect(x, 0, PIPE_W, topH);
  ctx.strokeRect(x - 4, topH - 20, PIPE_W + 8, 20);
  const gBot = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  gBot.addColorStop(0, "#81C784"); gBot.addColorStop(0.5, "#A5D6A7"); gBot.addColorStop(1, "#66BB6A");
  ctx.fillStyle = gBot; ctx.fillRect(x, botY, PIPE_W, H - botY);
  ctx.fillStyle = "#66BB6A"; ctx.fillRect(x - 4, botY, PIPE_W + 8, 20);
  ctx.strokeStyle = "#388E3C"; ctx.lineWidth = 1.5; ctx.strokeRect(x, botY, PIPE_W, H - botY);
  ctx.strokeRect(x - 4, botY, PIPE_W + 8, 20);
}

function drawPipeParty(ctx: CanvasRenderingContext2D, x: number, gapY: number, gap: number) {
  const topH = gapY - gap / 2, botY = gapY + gap / 2;
  const gTop = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  gTop.addColorStop(0, "#7B1FA2"); gTop.addColorStop(0.4, "#CE93D8"); gTop.addColorStop(0.6, "#F3E5F5");
  gTop.addColorStop(0.8, "#CE93D8"); gTop.addColorStop(1, "#7B1FA2");
  ctx.fillStyle = gTop; ctx.fillRect(x, 0, PIPE_W, topH);
  ctx.fillStyle = "#DAA520"; ctx.fillRect(x - 4, topH - 20, PIPE_W + 8, 20);
  ctx.strokeStyle = "#4A148C"; ctx.lineWidth = 1.5; ctx.strokeRect(x, 0, PIPE_W, topH);
  ctx.strokeRect(x - 4, topH - 20, PIPE_W + 8, 20);
  for (let sy = 0; sy < topH; sy += 25) {
    ctx.fillStyle = "rgba(255,215,0,0.12)"; ctx.fillRect(x + 6, sy, 3, 12);
  }
  const gBot = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  gBot.addColorStop(0, "#7B1FA2"); gBot.addColorStop(0.4, "#CE93D8"); gBot.addColorStop(0.6, "#F3E5F5");
  gBot.addColorStop(0.8, "#CE93D8"); gBot.addColorStop(1, "#7B1FA2");
  ctx.fillStyle = gBot; ctx.fillRect(x, botY, PIPE_W, H - botY);
  ctx.fillStyle = "#DAA520"; ctx.fillRect(x - 4, botY, PIPE_W + 8, 20);
  ctx.strokeStyle = "#4A148C"; ctx.lineWidth = 1.5; ctx.strokeRect(x, botY, PIPE_W, H - botY);
  ctx.strokeRect(x - 4, botY, PIPE_W + 8, 20);
  for (let sy = botY + 10; sy < H; sy += 25) {
    ctx.fillStyle = "rgba(255,215,0,0.12)"; ctx.fillRect(x + 6, sy, 3, 12);
  }
}

function drawBgOriginal(ctx: CanvasRenderingContext2D, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#87CEEB"); sky.addColorStop(0.7, "#B3E5FC"); sky.addColorStop(1, "#C8E6C9");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 130 + t * 0.3) % (W + 100)) - 50;
    const cy = 50 + i * 40;
    ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.arc(cx + 20, cy - 8, 20, 0, Math.PI * 2);
    ctx.arc(cx + 40, cy, 22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#8BC34A"; ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = "#689F38"; ctx.fillRect(0, H - 40, W, 4);
}

function drawBgParty(ctx: CanvasRenderingContext2D, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#FFF8E1"); sky.addColorStop(0.3, "#F3E5F5"); sky.addColorStop(0.6, "#EDE7F6"); sky.addColorStop(1, "#FFF3E0");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 15; i++) {
    const sx = (i * 31 + 10) % W;
    const sy = (i * 47 + 5) % (H - 80);
    const sparkle = Math.abs(Math.sin(t * 0.02 + i * 1.5));
    ctx.fillStyle = "rgba(218,165,32," + (sparkle * 0.4).toString() + ")";
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillRect(-1, -4, 2, 8); ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();
  }
  const balloonColors = ["#9C27B0", "#FFD700", "#7B1FA2", "#FFC107", "#CE93D8", "#DAA520"];
  for (let i = 0; i < 6; i++) {
    const bx = ((i * 75 + t * 0.35) % (W + 60)) - 30;
    const by = 50 + i * 28 + Math.sin(t * 0.02 + i) * 12;
    ctx.fillStyle = balloonColors[i];
    ctx.beginPath(); ctx.ellipse(bx, by, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx, by + 14); ctx.quadraticCurveTo(bx + 4, by + 25, bx - 2, by + 35); ctx.stroke();
  }
  const ground = ctx.createLinearGradient(0, H - 40, 0, H);
  ground.addColorStop(0, "#DAA520"); ground.addColorStop(1, "#B8860B");
  ctx.fillStyle = ground; ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = "#9C27B0"; ctx.fillRect(0, H - 40, W, 3);
  for (let gx = 0; gx < W; gx += 20) {
    ctx.fillStyle = "rgba(255,215,0,0.2)"; ctx.fillRect(gx, H - 37, 10, 37);
  }
}

function drawPipe(ctx: CanvasRenderingContext2D, x: number, gapY: number, party: boolean, gap: number) {
  if (party) drawPipeParty(ctx, x, gapY, gap); else drawPipeOriginal(ctx, x, gapY, gap);
}
function drawBg(ctx: CanvasRenderingContext2D, t: number, party: boolean) {
  if (party) drawBgParty(ctx, t); else drawBgOriginal(ctx, t);
}

function drawTitle(ctx: CanvasRenderingContext2D, party: boolean) {
  if (!party) return;
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.font = "bold 30px 'Dancing Script', cursive";
  ctx.shadowColor = "rgba(123,31,178,0.4)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#7B1FA2";
  ctx.fillText("Izzy\u2019s Party Fun!", W / 2, 8);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.font = "14px serif"; ctx.fillStyle = "#DAA520";
  ctx.fillText("\u2605", W / 2 - 110, 14);
  ctx.fillText("\u2605", W / 2 + 110, 14);
  ctx.font = "10px serif";
  ctx.fillText("\u2605", W / 2 - 95, 20);
  ctx.fillText("\u2605", W / 2 + 95, 20);
  ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"original" | "party">("party");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameState, setGameState] = useState<"menu" | "playing" | "dead" | "thanks">("menu");
  const [score, setScore] = useState(0);
  const [chancesLeft, setChancesLeft] = useState(MAX_CHANCES);
  const [totalClicks, setTotalClicks] = useState(() => parseInt(localStorage.getItem("flappy-clicks") || "0"));
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem("flappy-hi") || "0"));
  const [newRecord, setNewRecord] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showRestartBtn, setShowRestartBtn] = useState(false);
  const stateRef = useRef({ by: H / 2.5, bv: 0, pipes: [] as Pipe[], score: 0, dead: false, tick: 0 });
  const clicksRef = useRef(totalClicks);
  const party = mode === "party";
  const level = LEVELS[difficulty];

  useEffect(() => { isMuted = muted; if (muted) stopPartyMusic(); }, [muted]);

  const goToMenu = useCallback(() => {
    stopPartyMusic();
    setGameState("menu");
    setShowRestartBtn(false);
  }, []);

  const startGame = useCallback(() => {
    audioCtx.resume();
    stateRef.current = { by: H / 2.5, bv: 0, pipes: [], score: 0, dead: false, tick: 0 };
    setScore(0); setNewRecord(false); setChancesLeft(MAX_CHANCES); setGameState("playing"); setShowRestartBtn(false);
    if (party && !isMuted) startPartyMusic();
  }, [party]);

  const continueGame = useCallback(() => {
    stateRef.current = { ...stateRef.current, by: H / 2.5, bv: 0, pipes: [], dead: false, tick: 0 };
    setGameState("playing");
    if (party && !isMuted) startPartyMusic();
  }, [party]);

  const flap = useCallback(() => {
    clicksRef.current++;
    setTotalClicks(clicksRef.current);
    localStorage.setItem("flappy-clicks", String(clicksRef.current));
    if (gameState === "menu") { startGame(); return; }
    if (gameState === "dead" || gameState === "thanks") return;
    stateRef.current.bv = FLAP;
    sndFlap();
  }, [gameState, startGame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); flap(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const gap = level.gap;
    const speed = level.speed;
    let raf: number;
    const loop = () => {
      const s = stateRef.current;
      s.tick++;
      if (s.pipes.length === 0 || s.pipes[s.pipes.length - 1].x < W - 200) {
        s.pipes.push({ x: W, gapY: 120 + Math.random() * (H - 200 - gap), scored: false });
      }
      s.bv += GRAVITY; s.by += s.bv;
      s.pipes.forEach(p => { p.x -= speed; });
      s.pipes = s.pipes.filter(p => p.x + PIPE_W > -10);
      s.pipes.forEach(p => {
        if (!p.scored && p.x + PIPE_W < 80) { p.scored = true; s.score++; setScore(s.score); sndScore(); }
      });
      const bx = 80;
      const hitGround = s.by + CHAR_R > H - 40 || s.by - CHAR_R < 0;
      const hitPipe = s.pipes.some(p =>
        bx + CHAR_R - 4 > p.x && bx - CHAR_R + 4 < p.x + PIPE_W &&
        (s.by - CHAR_R + 4 < p.gapY - gap / 2 || s.by + CHAR_R - 4 > p.gapY + gap / 2)
      );
      if (hitGround || hitPipe) {
        s.dead = true; sndCrash(); stopPartyMusic();
        const hi = parseInt(localStorage.getItem("flappy-hi") || "0");
        if (s.score > hi) { localStorage.setItem("flappy-hi", String(s.score)); setHighScore(s.score); setNewRecord(true); spawnConfetti(); }
        if (party) {
          setChancesLeft(prev => {
            const next = prev - 1;
            if (next <= 0) {
              setGameState("thanks");
              setShowRestartBtn(false);
              setTimeout(() => setShowRestartBtn(true), 5000);
            } else {
              setGameState("dead");
            }
            return next;
          });
        } else {
          setGameState("dead");
        }
      }
      drawBg(ctx, s.tick, party);
      s.pipes.forEach(p => drawPipe(ctx, p.x, p.gapY, party, gap));
      drawCharacter(ctx, bx, s.by, s.bv, s.dead, party);
      drawTitle(ctx, party);
      if (party) {
        ctx.fillStyle = "#7B1FA2"; ctx.strokeStyle = "#E1BEE7"; ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = "white"; ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
      }
      ctx.font = "bold 36px sans-serif"; ctx.textAlign = "center";
      const scoreY = party ? 65 : 50;
      ctx.strokeText(String(s.score), W / 2, scoreY); ctx.fillText(String(s.score), W / 2, scoreY);
      if (!s.dead) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); stopPartyMusic(); };
  }, [gameState, party, level]);

  useEffect(() => {
    if (gameState === "playing" || gameState === "thanks") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    drawBg(ctx, 0, party);
    drawTitle(ctx, party);
    if (gameState === "menu") {
      drawCharacter(ctx, W / 2, H / 2.5, 0, false, party);
    } else {
      stateRef.current.pipes.forEach(p => drawPipe(ctx, p.x, p.gapY, party, level.gap));
      drawCharacter(ctx, 80, stateRef.current.by, 0, true, party);
    }
  }, [gameState, party, level]);

  const origMessages = ["Oopsie! Try again?", "Bonk! One more time?", "Almost had it!", "Gravity wins again!", "The pipes are sneaky!"];
  const partyMessages = ["Oops! Try again?", "Stumbled! One more?", "So close! Again?", "Keep going!", "Almost there!"];
  const messages = party ? partyMessages : origMessages;
  const deathMsg = messages[score % messages.length];

  return (
    <div className={"flex flex-col items-center justify-center min-h-screen " + (party ? "bg-purple-50" : "bg-sky-100")} onClick={flap} onTouchStart={(e) => { e.preventDefault(); flap(); }}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
          className={"px-3 py-2 rounded-full text-lg shadow-lg transition-all hover:scale-105 " + (party ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700")}>
          {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setMode(m => m === "original" ? "party" : "original"); goToMenu(); }}
          className={"px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-all hover:scale-105 " + (party ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-sky-400 hover:bg-sky-300 text-white")}>
          {party ? "Original Mode" : "Party Mode"}
        </button>
      </div>
      {(gameState === "playing" || gameState === "dead") && (
        <div className="absolute top-4 left-4 z-50">
          <button onClick={(e) => { e.stopPropagation(); goToMenu(); }}
            className={"px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-all hover:scale-105 " + (party ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-sky-100 text-sky-700 hover:bg-sky-200")}>
            Home
          </button>
        </div>
      )}
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className={"rounded-2xl shadow-2xl border-4 " + (party ? "border-purple-300" : "border-white")} />
        {gameState === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 rounded-2xl">
            {!party && <p className="text-5xl font-extrabold text-white drop-shadow-lg mb-2">Flappy Bird</p>}
            {party && <p className="text-3xl font-bold drop-shadow-lg mb-1" style={{ fontFamily: "'Dancing Script', cursive", color: "#7B1FA2", textShadow: "1px 1px 3px rgba(218,165,32,0.5)" }}>Tap to Play!</p>}
            <p className={"text-lg drop-shadow mb-4 " + (party ? "text-purple-800/80" : "text-white/90")}>Tap or press Space to fly!</p>
            {party && (
              <div className="flex gap-2 mb-4">
                {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                  <button key={d} onClick={(e) => { e.stopPropagation(); setDifficulty(d); }}
                    className={"px-4 py-1.5 rounded-full text-sm font-bold transition-all " + (difficulty === d ? "bg-purple-700 text-white shadow-lg scale-105" : "bg-white/70 text-purple-700 hover:bg-purple-100")}>
                    {LEVELS[d].label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); startGame(); }} className={"px-8 py-3 rounded-full text-xl font-bold shadow-lg transition-all hover:scale-105 " + (party ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-amber-400 hover:bg-amber-300 text-amber-900")}>
              {party ? "Let's Party!" : "Play!"}
            </button>
            {highScore > 0 && <p className={"mt-3 text-sm " + (party ? "text-purple-600/70" : "text-white/80")}>Best: {highScore}</p>}
          </div>
        )}
        {gameState === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-2xl">
            <p className={"text-4xl font-extrabold drop-shadow-lg mb-1 " + (party ? "text-purple-200" : "text-white")}>
              {newRecord ? "New Record!" : deathMsg}
            </p>
            {newRecord ? <p className="text-2xl text-amber-300 font-bold drop-shadow mb-1">Score: {score}</p>
              : <p className={"text-xl drop-shadow mb-1 " + (party ? "text-purple-100/90" : "text-white/90")}>Score: {score}</p>}
            <p className={"text-sm mb-2 " + (party ? "text-purple-200/70" : "text-white/70")}>Best: {highScore}</p>
            {party && <p className="text-sm text-amber-300/80 mb-4">Chances left: {chancesLeft}</p>}
            {!party && <div className="mb-4" />}
            <button onClick={(e) => { e.stopPropagation(); party ? continueGame() : startGame(); }} className={"px-8 py-3 rounded-full text-xl font-bold shadow-lg transition-all hover:scale-105 " + (party ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-amber-400 hover:bg-amber-300 text-amber-900")}>
              {party ? "Party Again!" : "Play Again!"}
            </button>
          </div>
        )}
        {gameState === "thanks" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-10" style={{ backgroundColor: "rgba(123,31,178,0.92)" }}>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-300 mb-4" style={{ fontFamily: "'Dancing Script', cursive" }}>
                Thanks for being part of my Birthday Party Fun!
              </p>
              <p className="text-lg text-purple-100 mb-2" style={{ fontFamily: "'Dancing Script', cursive" }}>It means a lot to me.</p>
              <p className="text-lg text-purple-100 mb-4">Keep enjoying the party!</p>
              <p className="text-xl text-amber-200 font-bold" style={{ fontFamily: "'Dancing Script', cursive" }}>- Isabel</p>
              <p className="text-amber-300/60 mt-4 text-sm">Score: {score}</p>
              {showRestartBtn && (
                <button onClick={(e) => { e.stopPropagation(); goToMenu(); }}
                  className="mt-6 px-8 py-3 rounded-full text-xl font-bold shadow-lg transition-all hover:scale-105 bg-amber-400 hover:bg-amber-300 text-purple-900">
                  Party Again!
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="fixed bottom-3 right-4 text-sm font-bold px-3 py-1 rounded-full shadow-md" style={{ background: party ? "rgba(123,31,178,0.1)" : "#E0F7FA", color: party ? "#7B1FA2" : "#006064", border: party ? "1px solid rgba(123,31,178,0.2)" : "none" }}>
        Total Taps: {totalClicks}
      </div>
    </div>
  );
}
