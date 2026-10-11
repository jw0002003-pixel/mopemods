const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const leaderboard = document.getElementById('leaderboard');
const minimap = document.getElementById('minimap');
const mmCtx = minimap.getContext('2d');
const xpFill = document.getElementById('xp-fill');
const waterFill = document.getElementById('water-fill');
const barLabel = document.getElementById('bar-label');
const bottomBar = document.getElementById('bottom-bar');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

function lerp(a, b, t) { return a + (b - a) * t; }

const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

let myId = null;
let world = { width: 6000, height: 6000 };
let players = {};
let food = [];
let holes = [];
let biomes = [];
let fireballs = [];
let presents = [];
let crystals = [];
let meat = [];
let trees = [];
let volcano = { x: 3000, y: 2700, r: 900 };
let arena = { x: 3000, y: 2700, r: 500, active: false };
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let camera = { x: 0, y: 0, zoom: 1 };
let gameStarted = false;
let isAdmin = false;
let spectating = false;
let spectateTarget = null;

const FOV_RADIUS = [500, 600, 700, 800, 900, 1000, 1200];

const chatInput = document.getElementById('chat-input');
let chatOpen = false;

const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
function safeSend(data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    myId = data.id; world = data.world; isAdmin = data.isAdmin || false;
  }
  else if (data.type === 'state_fast') {
    players = data.players;
    fireballs = data.fireballs || [];

    if (myId && players[myId]) {
      isAdmin = players[myId].isAdmin || false;
    }

    if (myId && players[myId]) {
      const me = players[myId];
      bottomBar.style.display = 'block';

      if (me.dead) {
        barLabel.textContent = '💀 Ты погиб! Нажми «ИГРАТЬ»';
        xpFill.style.width = '0%';
        waterFill.style.width = '0%';
        const menu = document.getElementById('menu');
        if (menu.style.display === 'none' || !menu.style.display) {
          menu.style.display = 'flex';
          gameStarted = false;
          document.getElementById('startBtn').textContent = '▶ ИГРАТЬ';
          hideMobileControls();
        }
      } else {
        const xpToNext = [10, 25, 50, 100, 200, 400, Infinity][Math.min(me.level - 1, 6)];
        const prevXP = me.level > 1 ? [0, 10, 25, 50, 100, 200, 400][me.level - 1] : 0;
        let xpPercent = 0;
        if (me.isSanta) { xpPercent = 100; barLabel.textContent = '🎅 Дед Мороз'; }
        else if (xpToNext === Infinity) { xpPercent = 100; barLabel.textContent = '👑 Король Драконов'; }
        else {
          xpPercent = Math.max(0, Math.min(100, ((me.score - prevXP) / (xpToNext - prevXP)) * 100));
          barLabel.textContent = `${Math.round(me.score)} XP (${xpToNext} XP Next Animal)`;
        }
        xpFill.style.width = xpPercent + '%';
        const waterPercent = Math.max(0, (me.water / me.maxWater) * 100);
        waterFill.style.width = waterPercent + '%';
        if (me.level >= 6) waterFill.style.background = 'linear-gradient(90deg, #8b0000, #ff4500, #ff9500)';
        else if (waterPercent < 30) waterFill.style.background = 'linear-gradient(90deg, #8b0000, #ff0000, #ff6666)';
        else waterFill.style.background = 'linear-gradient(90deg, #0077b6, #00b4d8, #90e0ef)';
      }
    }
  }
  else if (data.type === 'state_slow') {
    food = data.food || [];
    holes = data.holes || [];
    biomes = data.biomes || [];
    presents = data.presents || [];
    crystals = data.crystals || [];
    meat = data.meat || [];
    trees = data.trees || [];
    if (data.volcano) volcano = data.volcano;
    if (data.arena) arena = data.arena;
  }
  else if (data.type === 'chat') {
    if (data.system) showNotification(data.text);
  }
};

canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
});

let lastBoostSent = 0;
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!gameStarted || !myId || !players[myId]) return;
  if (chatOpen) return;
  if (players[myId].dead) return;
  if (players[myId].holeState === 'inside') return;

  const now = Date.now();
  if (now - lastBoostSent >= 300) {
    ws.send(JSON.stringify({ type: 'boost' }));
    lastBoostSent = now;
  }
});

function showNotification(text) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText = `
    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.85); color: #ffd700; padding: 8px 16px;
    border-radius: 5px; font-family: sans-serif; font-size: 14px;
    z-index: 60; pointer-events: none;
    border: 1px solid #ffd700; max-width: 600px; text-align: center;
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

document.addEventListener('keydown', (e) => {
  if (chatOpen) return;
  if (myId && players[myId] && players[myId].dead) return;
  if (e.key === 'f' || e.key === 'F' || e.key === 'а') {
    if (myId && players[myId] && gameStarted) ws.send(JSON.stringify({ type: 'drink' }));
  }
  if (e.key === 'g' || e.key === 'G' || e.key === 'п') {
    if (myId && players[myId] && players[myId].isSanta) ws.send(JSON.stringify({ type: 'santa_gift' }));
  }
  if (e.key === 'q' || e.key === 'Q' || e.key === 'й') {
    if (myId && players[myId] && gameStarted) ws.send(JSON.stringify({ type: 'ability' }));
  }
  if (e.key === 'e' || e.key === 'E' || e.key === 'у') {
    if (myId && players[myId] && players[myId].level === 7) ws.send(JSON.stringify({ type: 'tail' }));
  }
  if (e.key === 'k' || e.key === 'K' || e.key === 'л') {
    if (myId && players[myId] && players[myId].level === 6) ws.send(JSON.stringify({ type: 'ascend' }));
  }
  if (e.key === 'ArrowUp' && isAdmin && gameStarted) {
    e.preventDefault();
    ws.send(JSON.stringify({ type: 'admin_level', delta: 1 }));
  }
  if (e.key === 'ArrowDown' && isAdmin && gameStarted) {
    e.preventDefault();
    ws.send(JSON.stringify({ type: 'admin_level', delta: -1 }));
  }
});

setInterval(() => {
  if (!gameStarted || !myId || !players[myId]) return;
  if (isMobile) return;
  const me = players[myId];
  if (me.dead) return;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const dx = mouse.x - cx, dy = mouse.y - cy;
  const dist = Math.hypot(dx, dy);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  const maxDist = Math.min(canvas.width, canvas.height) / 2;
  const power = Math.min(1, dist / (maxDist * 0.6));
  ws.send(JSON.stringify({ type: 'move', dirX: nx, dirY: ny, power: power }));
}, 1000 / 30);

let selectedBiome = 'forest';
document.querySelectorAll('.biome-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedBiome = btn.dataset.biome;
    document.querySelectorAll('.biome-buttons button').forEach(b => b.style.borderColor = '#fff');
    btn.style.borderColor = '#ff0';
  });
});

document.getElementById('startBtn').addEventListener('click', () => {
  if (!myId) return;
  const nameInput = document.getElementById('name-input');
  const name = nameInput.value.trim() || ('Игрок ' + myId);
  ws.send(JSON.stringify({ type: 'setName', name }));
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'spawn', biome: selectedBiome }));
  }, 100);
  document.getElementById('menu').style.display = 'none';
  gameStarted = true;
  bottomBar.style.display = 'block';
  showMobileControls();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !chatOpen && gameStarted) {
    e.preventDefault();
    chatOpen = true;
    chatInput.style.display = 'block';
    chatInput.value = '';
    chatInput.focus();
  } else if (e.key === 'Escape' && chatOpen) {
    chatOpen = false;
    chatInput.style.display = 'none';
    chatInput.value = '';
    chatInput.blur();
  }
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text.length > 0 && myId) ws.send(JSON.stringify({ type: 'chat', text }));
    chatInput.value = '';
    chatOpen = false;
    chatInput.style.display = 'none';
    chatInput.blur();
  }
  if (e.key === 'Escape') {
    chatInput.value = '';
    chatOpen = false;
    chatInput.style.display = 'none';
    chatInput.blur();
  }
});

function draw() {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let focusX, focusY;
  if (spectating && myId && players[myId] && players[myId].dead) {
    const sorted = Object.values(players).filter(p => !p.dead && p.id !== myId).sort((a, b) => b.score - a.score);
    if (sorted.length > 0) {
      spectateTarget = sorted[0];
      focusX = spectateTarget.x; focusY = spectateTarget.y;
    }
  } else if (myId && players[myId] && !players[myId].dead) {
    const meP = players[myId];
    focusX = meP.x;
    focusY = meP.y;
  } else {
    focusX = 3000; focusY = 3000;
  }

  const nowMs = performance.now();
  const dt = Math.min(50, nowMs - (window._lastDraw || nowMs)) / 1000;
  window._lastDraw = nowMs;

  for (const id in players) {
    const p = players[id];
    if (!p || p.dead) continue;

    // 🚫 Сброс интерполяции — если сервер пометил skipInterpolation ИЛИ игрок входит в нору
    if (p.skipInterpolation || p.skipInterpolationFrames > 0 || p.holeState === 'entering') {
      p.renderX = p.x;
      p.renderY = p.y;
      p.renderAngle = p.angle || 0;
      p.skipInterpolation = false;
      if (p.skipInterpolationFrames > 0) p.skipInterpolationFrames--;
      continue;
    }

    if (p.renderX === undefined) {
      p.renderX = p.x;
      p.renderY = p.y;
      p.renderAngle = p.angle || 0;
    } else {
      const smooth = 1 - Math.pow(0.001, dt * 30);
      p.renderX = lerp(p.renderX, p.x, smooth);
      p.renderY = lerp(p.renderY, p.y, smooth);
      let angleDiff = (p.angle || 0) - p.renderAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      p.renderAngle += angleDiff * smooth;
    }
  }

  const me = myId ? players[myId] : null;
  let fovLevel = 500;
  if (me) {
    if (me.isSanta) fovLevel = 1500;
    else fovLevel = FOV_RADIUS[Math.min((me.level || 1) - 1, 6)] || 500;
  }
  camera.zoom = (isMobile ? 450 : 700) / fovLevel;
  if (camera.zoom < 0.25) camera.zoom = 0.25;
  if (camera.zoom > 2.5) camera.zoom = 2.5;

  const viewW = canvas.width / camera.zoom;
  const viewH = canvas.height / camera.zoom;
  camera.x = focusX - viewW / 2;
  camera.y = focusY - viewH / 2;
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);

  for (const b of biomes) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
  }

  const vx = volcano.x - camera.x;
  const vy = volcano.y - camera.y;
  ctx.beginPath(); ctx.arc(vx, vy, volcano.r, 0, Math.PI * 2);
  ctx.fillStyle = '#8b4513'; ctx.fill();
  ctx.strokeStyle = '#4a1818'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(vx, vy, volcano.r * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6600'; ctx.fill();
  ctx.beginPath(); ctx.arc(vx, vy, volcano.r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9500'; ctx.fill();
  ctx.beginPath(); ctx.arc(vx, vy, volcano.r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc00'; ctx.fill();
  ctx.beginPath(); ctx.arc(vx, vy, volcano.r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  const t = Date.now() / 1000;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + t * 0.3;
    const dist = volcano.r * (0.3 + 0.5 * Math.abs(Math.sin(t + i)));
    const bx = vx + Math.cos(angle) * dist;
    const by = vy + Math.sin(angle) * dist;
    ctx.beginPath(); ctx.arc(bx, by, 15 + Math.sin(t * 2 + i) * 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 200, 0, 0.6)'; ctx.fill();
  }

  if (arena.active) {
    const ax = arena.x - camera.x;
    const ay = arena.y - camera.y;
    ctx.beginPath(); ctx.arc(ax, ay, arena.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 15]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('⚔️ АРЕНА ⚔️', ax, ay - arena.r - 10);
  }

  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.strokeRect(-camera.x, -camera.y, world.width, world.height);

  for (const tr of trees) {
    const tx = tr.x - camera.x;
    const ty = tr.y - camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(tx, ty + tr.r * 0.7, tr.r * 0.9, tr.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2c17';
    ctx.fillRect(tx - 6, ty - 4, 12, tr.r * 0.8);
    ctx.beginPath();
    ctx.arc(tx, ty, tr.r, 0, Math.PI * 2);
    ctx.fillStyle = '#1e4d1a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx - tr.r * 0.3, ty - tr.r * 0.3, tr.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2d6a27';
    ctx.fill();
  }

  for (const h of holes) {
    const hx = h.x - camera.x, hy = h.y - camera.y;
    const grad = ctx.createRadialGradient(hx, hy, h.r * 0.4, hx, hy, h.r * 1.5);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(hx, hy, h.r * 1.5, 0, Math.PI * 2); ctx.fill();

    const innerGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, h.r);
    innerGrad.addColorStop(0, '#2a1a0a');
    innerGrad.addColorStop(0.8, '#1a0f05');
    innerGrad.addColorStop(1, '#000');
    ctx.fillStyle = innerGrad;
    ctx.beginPath(); ctx.arc(hx, hy, h.r, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#8b6f47'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx, hy, h.r * 0.8, 0, Math.PI * 2); ctx.stroke();
  }

  for (const c of crystals) {
    if (c.hp <= 0) continue;
    const cx = c.x - camera.x, cy = c.y - camera.y;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r * 1.5);
    if (c.isMega) {
      glow.addColorStop(0, 'rgba(255, 100, 0, 0.7)');
      glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
    } else {
      glow.addColorStop(0, 'rgba(0, 100, 255, 0.6)');
      glow.addColorStop(1, 'rgba(0, 100, 255, 0)');
    }
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, c.r * 1.5, 0, Math.PI * 2); ctx.fill();
    const grad = ctx.createRadialGradient(cx - c.r * 0.3, cy - c.r * 0.3, c.r * 0.1, cx, cy, c.r);
    if (c.isMega) {
      grad.addColorStop(0, '#ffdd55'); grad.addColorStop(0.5, '#ff6600'); grad.addColorStop(1, '#8b0000');
    } else {
      grad.addColorStop(0, '#5bc0ff'); grad.addColorStop(0.6, '#0066cc'); grad.addColorStop(1, '#003d80');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = cx + Math.cos(angle) * c.r;
      const py = cy + Math.sin(angle) * c.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.isMega ? '#ffdd00' : '#00ff88';
    ctx.lineWidth = c.isMega ? 6 : 3;
    ctx.stroke();
    const w = c.r * 1.5, h = c.isMega ? 6 : 3;
    const barY = cy - c.r - (c.isMega ? 18 : 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(cx - w / 2, barY, w, h);
    ctx.fillStyle = c.isMega ? '#ffdd00' : '#00ff88';
    ctx.fillRect(cx - w / 2, barY, w * (c.hp / c.maxHp), h);
  }

  for (const f of food) {
    const fx = f.x - camera.x, fy = f.y - camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(fx, fy + f.r * 0.7, f.r * 0.9, f.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (f.maxHp && f.maxHp > 1) {
      const w = f.r * 1.6, h = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(fx - w / 2, fy - f.r - 6, w, h);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(fx - w / 2, fy - f.r - 6, w * (f.hp / f.maxHp), h);
    }
    ctx.font = `${f.r * 1.1}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.emoji || '🍓', fx, fy + 1);
  }

  for (const m of meat) {
    const mx = m.x - camera.x;
    const my = m.y - camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(mx, my + m.r * 0.7, m.r * 0.9, m.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, m.r, 0, Math.PI * 2);
    ctx.fillStyle = m.color; ctx.fill();
    ctx.strokeStyle = '#4a0000'; ctx.lineWidth = 2; ctx.stroke();
    if (m.maxHp > 1) {
      const w = m.r * 1.6, h = 4;
      const barY = my - m.r - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(mx - w / 2, barY, w, h);
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(mx - w / 2, barY, w * (m.hp / m.maxHp), h);
    }
    ctx.font = `${m.r * 1.2}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍖', mx, my + 1);
  }

  for (const pr of presents) {
    ctx.font = '40px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎁', pr.x - camera.x, pr.y - camera.y);
  }

  for (const fb of fireballs) {
    const fx = fb.x - camera.x, fy = fb.y - camera.y;
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, fb.r * 2);
    glow.addColorStop(0, 'rgba(255, 255, 0, 0.9)');
    glow.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(fx, fy, fb.r * 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx, fy, fb.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6600'; ctx.fill();
  }

  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  for (const p of sorted) {
    if (p.dead) continue;
    const x = (p.renderX !== undefined ? p.renderX : p.x) - camera.x;
    const y = (p.renderY !== undefined ? p.renderY : p.y) - camera.y;
    if (p.hidden && p.id != myId) continue;

    // ✨ АУРА
    if (p.auraColor && p.auraUntil && Date.now() < p.auraUntil) {
      const remain = p.auraUntil - Date.now();
      const alpha = Math.min(1, remain / 500);
      const pulse = 1 + Math.sin(Date.now() / 100) * 0.15;
      const auraR = p.r * 2.5 * pulse;

      const gradient = ctx.createRadialGradient(x, y, p.r * 0.5, x, y, auraR);
      if (p.auraColor === 'orange') {
        gradient.addColorStop(0, `rgba(255, 150, 50, ${0.7 * alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 0, ${0.4 * alpha})`);
        gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
      } else {
        gradient.addColorStop(0, `rgba(100, 200, 255, ${0.7 * alpha})`);
        gradient.addColorStop(0.5, `rgba(50, 150, 255, ${0.4 * alpha})`);
        gradient.addColorStop(1, `rgba(0, 100, 255, 0)`);
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 🕳 В НОРЕ (своя отрисовка для себя и чужих)
    if (p.holeState === 'inside' || p.holeState === 'entering' || p.holeState === 'exiting') {
      if (p.id == myId) {
        ctx.globalAlpha = 0.85;
        const hiddenSize = p.level === 7 ? p.r * 4.0 : p.r * 2.6;
        if (p.isSanta) drawSkin(ctx, x, y, hiddenSize, 'santa', p.renderAngle !== undefined ? p.renderAngle : p.angle);
        else drawSkin(ctx, x, y, hiddenSize, p.level, p.renderAngle !== undefined ? p.renderAngle : p.angle);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.35;
        const hiddenSize = p.level === 7 ? p.r * 4.0 : p.r * 2.6;
        if (p.isSanta) drawSkin(ctx, x, y, hiddenSize, 'santa', p.renderAngle !== undefined ? p.renderAngle : p.angle);
        else drawSkin(ctx, x, y, hiddenSize, p.level, p.renderAngle !== undefined ? p.renderAngle : p.angle);
        ctx.globalAlpha = 1;
      }
      if (p.id == myId && p.hp !== undefined && p.maxHp !== undefined) {
        const barWidth = p.r * 2, barHeight = 5;
        const barX = x - barWidth / 2, barY = y - p.r - 18;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        const hpPercent = Math.max(0, p.hp / p.maxHp);
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
      }
      continue;
    }

    const skinSize = p.level === 7 ? p.r * 4.0 : p.r * 2.6;
    if (p.isSanta) drawSkin(ctx, x, y, skinSize, 'santa', p.renderAngle !== undefined ? p.renderAngle : p.angle);
    else drawSkin(ctx, x, y, skinSize, p.level, p.renderAngle !== undefined ? p.renderAngle : p.angle);

    if (p.level === 5 && p.swingActive) {
      const PR = Math.max(0.1, Math.abs(p.r || 1));
      const angle = p.renderAngle !== undefined ? p.renderAngle : (p.angle || 0);
      const DURATION = 150;
      const elapsed = Date.now() - (p.swingTime || 0);
      const tt = Math.max(0, Math.min(1, elapsed / DURATION));
      const side = p.nextPawSide || 'left';
      const sideMul = side === 'left' ? -1 : 1;
      const pawAngle = angle + sideMul * (Math.PI / 3.2);
      const reach = PR * (0.9 + tt * 0.7);
      const alpha = tt < 0.7 ? 1 : 1 - (tt - 0.7) / 0.3;
      const pawX = x + Math.cos(pawAngle) * reach;
      const pawY = y + Math.sin(pawAngle) * reach;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (tt < 0.5) {
        const waveProgress = tt / 0.5;
        const waveR = PR * (0.6 + waveProgress * 1.2);
        ctx.beginPath();
        ctx.arc(pawX, pawY, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 220, 100, ${1 - waveProgress})`;
        ctx.lineWidth = 5 * (1 - waveProgress);
        ctx.stroke();
      }
      ctx.translate(pawX, pawY);
      ctx.rotate(pawAngle);
      ctx.beginPath();
      ctx.arc(3, 3, PR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, PR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#6f4e37';
      ctx.fill();
      ctx.strokeStyle = '#3d2a1a';
      ctx.lineWidth = 4;
      ctx.stroke();
      for (let c = -1; c <= 1; c++) {
        ctx.beginPath();
        ctx.arc(PR * 0.42, c * PR * 0.3, PR * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#3d2a1a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    if (p.isAdmin) {
      const hue = (Date.now() / 20) % 360;
      const gradient = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
      gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 180) % 360}, 100%, 60%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 60%)`);
      ctx.fillStyle = '#ff0000';
      ctx.fillText('[DEV]', x - 30, y - p.r - 24);
      ctx.fillStyle = gradient;
      ctx.fillText(p.name, x + 15, y - p.r - 24);
    } else {
      ctx.fillStyle = '#fff';
      ctx.strokeText(p.name, x, y - p.r - 24);
      ctx.fillText(p.name, x, y - p.r - 24);
    }

    if (p.hp !== undefined && p.maxHp !== undefined) {
      const barWidth = p.r * 2, barHeight = 5;
      const barX = x - barWidth / 2, barY = y - p.r - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      const hpPercent = Math.max(0, p.hp / p.maxHp);
      const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    if (p.chatText) {
      const tx = x, ty = y - p.r - 45;
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const metrics = ctx.measureText(p.chatText);
      const textWidth = metrics.width + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(tx - textWidth / 2, ty - 12, textWidth, 24);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(tx - textWidth / 2, ty - 12, textWidth, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.chatText, tx, ty);
    }
  }

  ctx.restore();

  if (myId && players[myId] && !players[myId].dead && !spectating) {
    const p = players[myId];
    const animalNames = ['Мышка', 'Кролик', 'Лиса', 'Волк', 'Медведь', 'Дракон', 'Король Драконов'];
    const animalName = p.isSanta ? '🎅 Дед Мороз' : animalNames[Math.min(p.level - 1, animalNames.length - 1)];
    const boostCd = p.lastBoost ? Math.max(0, 500 - (Date.now() - p.lastBoost)) : 0;
    const boostStatus = boostCd > 0 ? `⏳ ${(boostCd / 1000).toFixed(1)}s` : '⚡ READY';
    const adminTag = isAdmin ? ' 👑ADMIN (↑↓ уровень)' : '';
    let quest = '';
    if (p.level === 6) quest = ` | 🐉 Драконы: ${p.dragonsKilled || 0}/3 (K)`;
    else if (p.level === 7) quest = ' | Q=Огонь E=Хвост';
    else if (p.isSanta) quest = ' | G=Подарок';
    const abilityNames = ['🕳 Норка', '🐰 Прыжок', '🦊 Рывок', '🐺 Вой', '🐻 Рык', '🔥 Огонь', '👑 Хвост'];
    const abilityName = p.isSanta ? '🎁 Подарок' : (abilityNames[Math.min(p.level - 1, abilityNames.length - 1)] || '');
    hud.textContent = `Ур: ${p.isSanta ? '🎅' : p.level} (${animalName}) | HP: ${Math.max(0, Math.round(p.hp))}/${p.maxHp} | Q: ${abilityName} | ЛКМ: ${boostStatus} | F=Пить${adminTag}${quest}`;
  }

  if (spectating && spectateTarget) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff00ff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(`👁 SPECTATOR: ${spectateTarget.name}`, canvas.width / 2, 40);
    ctx.fillText(`👁 SPECTATOR: ${spectateTarget.name}`, canvas.width / 2, 40);
  }

  leaderboard.innerHTML = '<b>Топ:</b><br>' +
    sorted.slice(0, 5).map((p, i) =>
      `${i + 1}. ${p.isSanta ? '🎅' : ''} ${p.name} — ${p.score}`
    ).join('<br>');

  mmCtx.clearRect(0, 0, 160, 160);
  for (const b of biomes) {
    mmCtx.fillStyle = b.color;
    mmCtx.fillRect(b.x / world.width * 160, b.y / world.height * 160, b.w / world.width * 160, b.h / world.height * 160);
  }
  mmCtx.beginPath();
  mmCtx.arc(volcano.x / world.width * 160, volcano.y / world.height * 160, volcano.r / world.width * 160, 0, Math.PI * 2);
  mmCtx.fillStyle = '#ff6600'; mmCtx.fill();
  mmCtx.fillStyle = '#000';
  for (const h of holes) {
    mmCtx.beginPath();
    mmCtx.arc(h.x / world.width * 160, h.y / world.height * 160, 2, 0, Math.PI * 2);
    mmCtx.fill();
  }
  for (const c of crystals) {
    if (c.hp <= 0) continue;
    mmCtx.fillStyle = c.isMega ? '#ffdd00' : '#00b4ff';
    mmCtx.beginPath();
    mmCtx.arc(c.x / world.width * 160, c.y / world.height * 160, c.isMega ? 5 : 3, 0, Math.PI * 2);
    mmCtx.fill();
  }
  for (const id in players) {
    const p = players[id];
    if (p.hidden && id != myId) continue;
    if (p.dead) continue;
    mmCtx.beginPath();
    mmCtx.arc(p.x / world.width * 160, p.y / world.height * 160, id == myId ? 4 : 3, 0, Math.PI * 2);
    mmCtx.fillStyle = id == myId ? '#fff' : p.color;
    mmCtx.fill();
  }

  requestAnimationFrame(draw);
}

function showMobileControls() {
  if (isMobile) {
    document.getElementById('joystick').style.display = 'block';
    document.getElementById('mobile-buttons').style.display = 'flex';
  }
}
function hideMobileControls() {
  document.getElementById('joystick').style.display = 'none';
  document.getElementById('mobile-buttons').style.display = 'none';
}

const joystickEl = document.getElementById('joystick-base');
const stickEl = document.getElementById('joystick-stick');
let joyActive = false;
let joyDir = { x: 0, y: 0, power: 0 };

function getJoyCenter() {
  const r = joystickEl.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

joystickEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joyActive = true;
  updateJoystick(e.touches[0]);
}, { passive: false });

joystickEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!joyActive) return;
  updateJoystick(e.touches[0]);
}, { passive: false });

joystickEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  joyActive = false;
  joyDir = { x: 0, y: 0, power: 0 };
  stickEl.style.transform = 'translate(0, 0)';
}, { passive: false });

function updateJoystick(touch) {
  const center = getJoyCenter();
  let dx = touch.clientX - center.x;
  let dy = touch.clientY - center.y;
  const dist = Math.hypot(dx, dy);
  const maxDist = 55;
  const clamped = Math.min(dist, maxDist);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  stickEl.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
  joyDir.x = nx;
  joyDir.y = ny;
  joyDir.power = clamped / maxDist;
}

setInterval(() => {
  if (!isMobile || !gameStarted || !myId || !players[myId]) return;
  if (joyDir.power < 0.05) return;
  ws.send(JSON.stringify({ type: 'move', dirX: joyDir.x, dirY: joyDir.y, power: joyDir.power }));
}, 1000 / 30);

document.getElementById('btn-ability').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (myId && players[myId] && gameStarted) ws.send(JSON.stringify({ type: 'ability' }));
}, { passive: false });

document.getElementById('btn-boost').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (myId && players[myId] && gameStarted) ws.send(JSON.stringify({ type: 'boost' }));
}, { passive: false });

document.getElementById('btn-drink').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (myId && players[myId] && gameStarted) ws.send(JSON.stringify({ type: 'drink' }));
}, { passive: false });

draw();
