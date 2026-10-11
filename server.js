const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { getAbilityByLevel } = require('./abilities');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const WORLD = { width: 4000, height: 4000 };
const TICK_RATE = 30;
const FOOD_COUNT = 300;
const HOLE_COUNT = 40;
const CRYSTAL_COUNT = 15;

const ADMIN_PASSWORD = 'admin123';

const VOLCANO = { x: 2000, y: 2000, r: 600 };

function isInVolcano(x, y) {
  return Math.hypot(x - VOLCANO.x, y - VOLCANO.y) < VOLCANO.r;
}

const BIOMES = [
  { name: 'forest', x: 0,    y: 0,    w: 2000, h: 2000, color: '#2d5a27' },
  { name: 'water',  x: 2000, y: 0,    w: 2000, h: 2000, color: '#1e3a5f' },
  { name: 'desert', x: 0,    y: 2000, w: 2000, h: 2000, color: '#c2a56b' },
  { name: 'snow',   x: 2000, y: 2000, w: 2000, h: 2000, color: '#c8d8e8' }
];

function getBiomeAt(x, y) {
  if (isInVolcano(x, y)) return { name: 'volcano', color: '#4a1818' };
  for (const b of BIOMES) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return BIOMES[0];
}

const FOOD_TYPES = [
  { name: 'berry',    color: '#e63946', r: 25, xp: 3,  emoji: '🍓', biome: 'forest',  minLevel: 1, bites: 1 },
  { name: 'mushroom', color: '#d4a373', r: 30, xp: 4,  emoji: '🍄', biome: 'forest',  minLevel: 1, bites: 2 },
  { name: 'apple',    color: '#ff0000', r: 30, xp: 4,  emoji: '🍎', biome: 'forest',  minLevel: 1, bites: 2 },
  { name: 'banana',   color: '#ffd60a', r: 32, xp: 5,  emoji: '🍌', biome: 'desert',  minLevel: 2, bites: 2 },
  { name: 'fish',     color: '#00b4d8', r: 32, xp: 5,  emoji: '🐟', biome: 'water',   minLevel: 2, bites: 2 },
  { name: 'carrot',   color: '#ff8c00', r: 35, xp: 6,  emoji: '🥕', biome: 'forest',  minLevel: 3, bites: 3 },
  { name: 'meat',     color: '#a0522d', r: 38, xp: 8,  emoji: '🍖', biome: 'snow',    minLevel: 3, bites: 3 },
  { name: 'cactus',   color: '#2d6a4f', r: 36, xp: 7,  emoji: '🌵', biome: 'desert',  minLevel: 3, bites: 3 },
  { name: 'ice',      color: '#a0e0ff', r: 42, xp: 10, emoji: '🧊', biome: 'snow',    minLevel: 4, bites: 4 },
  { name: 'lava',     color: '#ff4500', r: 45, xp: 12, emoji: '🔥', biome: 'volcano', minLevel: 5, bites: 4 }
];

const ANIMALS = [
  { name: 'Мышка',           r: 15, speed: 15, color: '#a0a0a0', xpToNext: 10,  hp: 30,  damage: 5,  fov: 500 },
  { name: 'Кролик',          r: 20, speed: 15, color: '#d4a373', xpToNext: 25,  hp: 50,  damage: 8,  fov: 700 },
  { name: 'Лиса',            r: 28, speed: 15, color: '#e07a5f', xpToNext: 50,  hp: 80,  damage: 12, fov: 900 },
  { name: 'Волк',            r: 38, speed: 15, color: '#8d99ae', xpToNext: 100, hp: 120, damage: 18, fov: 1300 },
  { name: 'Медведь',         r: 52, speed: 13, color: '#6f4e37', xpToNext: 200, hp: 180, damage: 25, fov: 1500 },
  { name: 'Дракон',          r: 300, speed: 10, color: '#9b2226', xpToNext: 400, hp: 250, damage: 35, fov: 2000 },
  { name: 'Король Драконов', r: 500, speed: 10, color: '#ff4500', xpToNext: Infinity, hp: 500, damage: 50, fov: 2000 }
];

function getAnimalByLevel(level) {
  return ANIMALS[Math.min(level - 1, ANIMALS.length - 1)];
}

let players = {};
let food = [];
let holes = [];
let fireballs = [];
let presents = [];
let crystals = [];
let meat = [];
let arena = { x: 2000, y: 2000, r: 400, active: false };
let nextId = 1;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function spawnFood() {
  const type = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
  let x, y;
  if (type.biome === 'volcano') {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * VOLCANO.r;
    x = VOLCANO.x + Math.cos(a) * d;
    y = VOLCANO.y + Math.sin(a) * d;
  } else {
    const biome = BIOMES.find(b => b.name === type.biome) || BIOMES[0];
    x = biome.x + Math.random() * biome.w;
    y = biome.y + Math.random() * biome.h;
  }
  return {
    id: Math.random().toString(36).slice(2),
    x, y, r: type.r, color: type.color, type: type.name,
    emoji: type.emoji, xp: type.xp, minLevel: type.minLevel, biome: type.biome,
    hp: type.bites, maxHp: type.bites, bites: type.bites
  };
}
for (let i = 0; i < FOOD_COUNT; i++) food.push(spawnFood());

function spawnCrystal() {
  let x, y;
  do {
    x = 100 + Math.random() * (WORLD.width - 200);
    y = 100 + Math.random() * (WORLD.height - 200);
  } while (isInVolcano(x, y));
  return {
    id: Math.random().toString(36).slice(2),
    x, y, r: 60, hp: 50, maxHp: 50, respawnAt: 0, isMega: false
  };
}
function spawnMegaCrystal() {
  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * (VOLCANO.r - 100);
  const x = VOLCANO.x + Math.cos(a) * d;
  const y = VOLCANO.y + Math.sin(a) * d;
  return {
    id: 'mega_' + Math.random().toString(36).slice(2),
    x, y, r: 150, hp: 200, maxHp: 200, respawnAt: 0, isMega: true
  };
}
for (let i = 0; i < CRYSTAL_COUNT; i++) crystals.push(spawnCrystal());
crystals.push(spawnMegaCrystal());

function spawnHole() {
  let x, y;
  do {
    x = 100 + Math.random() * (WORLD.width - 200);
    y = 100 + Math.random() * (WORLD.height - 200);
  } while (isInVolcano(x, y));
  return { id: Math.random().toString(36).slice(2), x, y, r: 50 };
}
for (let i = 0; i < HOLE_COUNT; i++) holes.push(spawnHole());

wss.on('connection', (ws) => {
  const id = nextId++;
  players[id] = {
    id, name: 'Игрок ' + id,
    x: Math.random() * WORLD.width,
    y: Math.random() * WORLD.height,
    vx: 0, vy: 0, angle: 0, r: 15, color: '#a0a0a0',
    targetX: 0, targetY: 0,
    moveDirX: 0, moveDirY: 0, movePower: 0,
    score: 0, level: 1,
    hp: 30, maxHp: 30, damage: 5,
    water: 100, maxWater: 100,
    lastBoost: 0, boostActive: false, boostAngle: 0,
    dashVx: 0, dashVy: 0,
    isAdmin: false, isSanta: false, santaSpeed: 8,
    chatText: '', chatTime: 0,
    eatenLevels: [], dragonsKilled: 0,
    lastFire: 0, lastTail: 0, lastHit: 0,
    lastFoodBite: 0, lastCrystalBite: 0,
    lastVolcanoDamage: 0, lastSantaGift: 0, lastWaterDrink: 0,
    inHole: false, hidden: false, burning: 0, dead: false,
    spectating: false, inArena: false,
        previousScore: 0,
    holeCooldown: 0,
    lastAbility: 0
  };
  players[id].biome = getBiomeAt(players[id].x, players[id].y).name;

  console.log(`Игрок ${id} подключился`);
  ws.send(JSON.stringify({ type: 'init', id, world: WORLD, isAdmin: players[id].isAdmin }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'setName' && players[id]) {
        const name = String(data.name || '').slice(0, 16).trim();
        if (name.length > 0) players[id].name = name;
      }
      if (data.type === 'move' && players[id]) {
        const p = players[id];
        if (data.dirX !== undefined) {
          p.moveDirX = data.dirX || 0;
          p.moveDirY = data.dirY || 0;
          p.movePower = data.power || 0;
        } else {
          p.targetX = data.x;
          p.targetY = data.y;
          p.moveDirX = null;
        }
      }
      if (data.type === 'boost' && players[id]) {
        const p = players[id];
        if (p.dead) return;

        if (p.hidden) {
          p.hidden = false;
          p.inHole = null;
          const dirX = p.moveDirX || 1;
          const dirY = p.moveDirY || 0;
          const dist = Math.hypot(dirX, dirY) || 1;
          p.x += (dirX / dist) * 120;
          p.y += (dirY / dist) * 120;
          p.x = Math.max(p.r, Math.min(WORLD.width - p.r, p.x));
          p.y = Math.max(p.r, Math.min(WORLD.height - p.r, p.y));
          p.holeCooldown = Date.now() + 1500;
          return;
        }

        const now = Date.now();
        if (now - p.lastBoost < 800) return;
        p.lastBoost = now;
        p.boostActive = true;
        setTimeout(() => { if (players[id]) players[id].boostActive = false; }, 500);

        let dx = p.moveDirX || 0, dy = p.moveDirY || 0;
        if (Math.hypot(dx, dy) < 0.01) {
          dx = p.targetX - p.x; dy = p.targetY - p.y;
        }
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
          const power = 35;
          p.dashVx = (dx / dist) * power;
          p.dashVy = (dy / dist) * power;
          p.boostAngle = Math.atan2(dy, dx);
        }
        p.score = Math.max(0, p.score - 1);
      }
      if (data.type === 'santa_gift' && players[id] && players[id].isSanta) {
        const p = players[id];
        const now = Date.now();
        if (now - p.lastSantaGift < 500) return;
        p.lastSantaGift = now;
        presents.push({
          id: Math.random().toString(36).slice(2),
          x: p.x + (Math.random() - 0.5) * 200,
          y: p.y + (Math.random() - 0.5) * 200,
          r: 20, xp: 25 + Math.floor(Math.random() * 25)
        });
      }
      if (data.type === 'santa_speed' && players[id] && players[id].isSanta) {
        players[id].santaSpeed = Math.max(2, Math.min(30, parseFloat(data.value) || 8));
      }
      if (data.type === 'drink' && players[id]) {
        const p = players[id];
        if (p.dead) return;
        const now = Date.now();
        if (now - p.lastWaterDrink < 500) return;
        const biome = getBiomeAt(p.x, p.y);
        if (p.level >= 6) {
          if (isInVolcano(p.x, p.y)) {
            p.water = Math.min(p.maxWater, p.water + 30);
            p.lastWaterDrink = now;
          }
        } else {
          if (biome.name === 'water') {
            p.water = Math.min(p.maxWater, p.water + 30);
            p.lastWaterDrink = now;
          }
        }
      }
            if (data.type === 'ability' && players[id]) {
        const p = players[id];
        if (p.dead || p.hidden || p.isSanta) return;
        const ability = getAbilityByLevel(p.level);
        if (!ability) return;
        const now = Date.now();
        if (now - (p.lastAbility || 0) < ability.cooldown) return;
        p.lastAbility = now;

        const helpers = { fireballs, holes };
        const result = ability.use(p, players, WORLD, helpers);

        if (result && result.message) {
          ws.send(JSON.stringify({ type: 'chat', system: true, text: result.message }));
        }
      }
      if (data.type === 'fire' && players[id]) {
        const p = players[id];
        if (p.level < 7 || p.hidden || p.dead) return;
        const now = Date.now();
        if (now - p.lastFire < 1000) return;
        p.lastFire = now;
        let dx = p.moveDirX || 0, dy = p.moveDirY || 0;
        if (Math.hypot(dx, dy) < 0.01) { dx = p.targetX - p.x; dy = p.targetY - p.y; }
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
          fireballs.push({
            id: Math.random().toString(36).slice(2),
            x: p.x, y: p.y,
            vx: (dx / dist) * 15, vy: (dy / dist) * 15,
            r: 20, owner: id, damage: 40, life: 60
          });
        }
      }
      if (data.type === 'tail' && players[id]) {
        const p = players[id];
        if (p.level < 7 || p.hidden || p.dead) return;
        const now = Date.now();
        if (now - p.lastTail < 3000) return;
        p.lastTail = now;
        for (const tid of Object.keys(players)) {
          const t = players[tid];
          if (!t || t.id === id || t.hidden || t.dead) continue;
          const d = Math.hypot(t.x - p.x, t.y - p.y);
          if (d < p.r + 150) {
            t.hp -= 25;
            const ang = Math.atan2(t.y - p.y, t.x - p.x);
            t.x += Math.cos(ang) * 200;
            t.y += Math.sin(ang) * 200;
            if (t.hp <= 0) {
              t.dead = true;
              broadcast({ type: 'chat', system: true, text: `💀 Король убил ${t.name}` });
            }
          }
        }
      }
      if (data.type === 'ascend' && players[id]) {
        const p = players[id];
        if (p.level === 6 && p.dragonsKilled >= 3) {
          p.level = 7;
          const king = ANIMALS[6];
          p.r = king.r; p.color = king.color;
          p.hp = king.hp; p.maxHp = king.hp; p.damage = king.damage;
          p.score = 500;
          broadcast({ type: 'chat', system: true, text: `👑 ${p.name} СТАЛ КОРОЛЁМ ДРАКОНОВ!` });
        } else {
          ws.send(JSON.stringify({ type: 'chat', system: true, text: `❌ Убей 3 драконов (у тебя ${p.dragonsKilled}/3)` }));
        }
      }
      if (data.type === 'spawn' && players[id]) {
        const p = players[id];
        const biomeName = data.biome;
        const biome = BIOMES.find(b => b.name === biomeName) || BIOMES[0];
        p.x = biome.x + Math.random() * biome.w;
        p.y = biome.y + Math.random() * biome.h;
        p.level = 1;
        const animal = ANIMALS[0];
        p.r = animal.r; p.color = animal.color;
        p.hp = animal.hp; p.maxHp = animal.hp; p.damage = animal.damage;
        p.score = 0;
        p.water = p.maxWater;
        p.burning = 0;
        p.dead = false;
        p.spectating = false;
        p.isSanta = false;
        p.hidden = false;
        p.inHole = null;
        p.vx = 0; p.vy = 0;
        p.dashVx = 0; p.dashVy = 0;
        p.eatenLevels = [];
        p.dragonsKilled = 0;
      }
      if (data.type === 'respawn' && players[id]) {
        const p = players[id];
        p.dead = false;
        p.spectating = false;
        p.hp = 30; p.maxHp = 30;
        p.water = 100; p.maxWater = 100;
        p.score = 0; p.level = 1; p.r = 15;
        p.color = '#a0a0a0'; p.damage = 5;
        p.isSanta = false;
        p.hidden = false;
        p.inHole = null;
        p.vx = 0; p.vy = 0;
        p.dashVx = 0; p.dashVy = 0;
        const biome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
        p.x = biome.x + Math.random() * biome.w;
        p.y = biome.y + Math.random() * biome.h;
      }
      if (data.type === 'spectate' && players[id]) {
        players[id].spectating = true;
        players[id].dead = true;
      }
      if (data.type === 'chat' && players[id]) {
        const p = players[id];
        const text = String(data.text || '').slice(0, 80).trim();
        if (text.length === 0) return;

        if (text === '/admin ' + ADMIN_PASSWORD) {
          p.isAdmin = true;
          ws.send(JSON.stringify({ type: 'chat', system: true, text: '👑 Ты теперь админ! /santa — стать Дедом Морозом.' }));
          return;
        }
        if (text === '/santa') {
          if (!p.isAdmin) {
            ws.send(JSON.stringify({ type: 'chat', system: true, text: '❌ Только админ' }));
            return;
          }
          p.isSanta = true; p.level = 0;
          p.r = 60; p.color = '#c0392b';
          p.hp = 500; p.maxHp = 500;
          broadcast({ type: 'chat', system: true, text: `🎅 АДМИН СТАЛ ДЕДОМ МОРОЗОМ!` });
          return;
        }
        if (text.startsWith('/santaspeed ')) {
          if (!p.isSanta) return;
          const val = parseFloat(text.split(' ')[1]) || 8;
          p.santaSpeed = Math.max(2, Math.min(30, val));
          ws.send(JSON.stringify({ type: 'chat', system: true, text: `🎅 Скорость: ${p.santaSpeed}` }));
          return;
        }
        if (text.startsWith('/')) {
          const parts = text.split(' ');
          const cmd = parts[0].toLowerCase();
          if (!p.isAdmin) {
            ws.send(JSON.stringify({ type: 'chat', system: true, text: '❌ Нет прав' }));
            return;
          }
          if (cmd === '/help') ws.send(JSON.stringify({ type: 'chat', system: true, text: '👑 /kill /tp X Y /size N /level N /score N /clear /santa /santaspeed N' }));
          else if (cmd === '/kill') { delete players[id]; }
          else if (cmd === '/tp' && parts.length === 3) { p.x = parseFloat(parts[1]) || 0; p.y = parseFloat(parts[2]) || 0; }
          else if (cmd === '/size' && parts.length === 2) p.r = Math.max(5, Math.min(200, parseFloat(parts[1]) || 15));
          else if (cmd === '/level' && parts.length === 2) {
            const lvl = Math.max(1, Math.min(ANIMALS.length, parseInt(parts[1]) || 1));
            p.level = lvl;
            const a = ANIMALS[lvl - 1];
            p.r = a.r; p.color = a.color; p.hp = a.hp; p.maxHp = a.hp; p.damage = a.damage;
          }
          else if (cmd === '/score' && parts.length === 2) p.score = Math.max(0, parseInt(parts[1]) || 0);
          else if (cmd === '/clear') broadcast({ type: 'clear-chat' });
          return;
        }
        p.chatText = text;
        p.chatTime = Date.now();
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    delete players[id];
    console.log(`Игрок ${id} отключился`);
  });
});

// === ИГРОВОЙ ЦИКЛ ===
let tickCount = 0;
setInterval(() => {
  tickCount++;

  // Регенерация + вода + вулкан
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.dead) continue;

    if (p.hidden) p.hp = Math.min(p.maxHp, p.hp + 2);
    else if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.3);

    if (p.level >= 6 || p.isSanta) {
      p.water = p.maxWater;
    } else {
      const biome = getBiomeAt(p.x, p.y);
      if (biome.name === 'water') p.water = Math.min(p.maxWater, p.water + 0.5);
      else p.water -= 0.1;
      if (p.water <= 0) { p.hp -= 1; p.water = 0; }
      p.water = Math.max(0, Math.min(p.maxWater, p.water));
    }

    if (isInVolcano(p.x, p.y) && !p.hidden && p.level < 6 && !p.isSanta) {
      const now = Date.now();
      if (!p.lastVolcanoDamage || now - p.lastVolcanoDamage >= 1000) {
        p.lastVolcanoDamage = now;
        p.hp -= 10;
        p.burning = 3;
      }
    }
    if (p.burning > 0 && p.level < 6 && !p.isSanta) {
      p.burning -= 1 / TICK_RATE;
      if (Math.random() < 0.1) p.hp -= 1;
    }
    if (p.hp <= 0) {
      p.dead = true; p.hp = 0;

      const lostMass = Math.floor(p.score / 3);
      p.score -= lostMass;

      const meatCount = Math.min(10, Math.max(3, Math.floor(p.score / 30)));
      const meatPerDrop = Math.max(1, Math.floor(p.score / meatCount));

      for (let i = 0; i < meatCount; i++) {
        const angle = (i / meatCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 60;
        meat.push({
          id: Math.random().toString(36).slice(2),
          x: p.x + Math.cos(angle) * dist,
          y: p.y + Math.sin(angle) * dist,
          r: 15 + Math.random() * 10,
          xp: meatPerDrop,
          hp: 2, maxHp: 2,
          color: ['#8B0000', '#A52A2A', '#B22222', '#DC143C'][Math.floor(Math.random() * 4)],
          emoji: '🍖'
        });
      }

      broadcast({ type: 'chat', system: true, text: `💀 ${p.name} погиб! Выпало мяса: ${meatCount}` });
    }
  }

  // Движение (только НЕ в норке)
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.hidden || p.dead) continue;

    let maxSpeed;
    if (p.isSanta) maxSpeed = p.santaSpeed * 1.5;
    else {
      const animal = getAnimalByLevel(p.level);
      maxSpeed = animal.speed * 1.05;
      if (p.boostActive) maxSpeed *= 1.8;
      if (p.biome === 'water') maxSpeed *= 0.6;
      if (p.biome === 'snow') maxSpeed *= 0.8;
    }

    if (p.moveDirX !== null && p.moveDirX !== undefined) {
      const power = p.movePower || 0;
      if (power < 0.05) { p.vx *= 0.85; p.vy *= 0.85; }
      else {
        const targetVx = p.moveDirX * maxSpeed * power;
        const targetVy = p.moveDirY * maxSpeed * power;
        p.vx += (targetVx - p.vx) * 0.18;
        p.vy += (targetVy - p.vy) * 0.18;
      }
    } else {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        const targetVx = (dx / dist) * maxSpeed;
        const targetVy = (dy / dist) * maxSpeed;
        p.vx += (targetVx - p.vx) * 0.18;
        p.vy += (targetVy - p.vy) * 0.18;
      } else {
        p.vx *= 0.85;
        p.vy *= 0.85;
      }
    }

    p.vx += p.dashVx; p.vy += p.dashVy;
    p.dashVx *= 0.75; p.dashVy *= 0.75;
    if (Math.abs(p.dashVx) < 0.05) p.dashVx = 0;
    if (Math.abs(p.dashVy) < 0.05) p.dashVy = 0;

    const v = Math.hypot(p.vx, p.vy);
    const maxAllowed = maxSpeed * 2.5;
    if (v > maxAllowed) {
      p.vx = (p.vx / v) * maxAllowed;
      p.vy = (p.vy / v) * maxAllowed;
    }

    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(p.r, Math.min(WORLD.width - p.r, p.x));
    p.y = Math.max(p.r, Math.min(WORLD.height - p.r, p.y));

    // Поворот
    let aimDx, aimDy;
    if (p.moveDirX !== null && p.moveDirX !== undefined && (Math.abs(p.moveDirX) > 0.01 || Math.abs(p.moveDirY) > 0.01)) {
      aimDx = p.moveDirX; aimDy = p.moveDirY;
    } else {
      aimDx = p.vx; aimDy = p.vy;
    }
    const aimDist = Math.hypot(aimDx, aimDy);
    if (aimDist > 0.01) {
      const targetAngle = Math.atan2(aimDy, aimDx);
      let diff = targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpeed = 0.15;
      const maxTurn = 0.25;
      const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, diff * turnSpeed));
      p.angle += turnAmount;
    }
  }

  // АВТОЗАХОД В НОРКУ
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.dead || p.hidden) continue;
    if (p.level >= 6) continue;
    if (p.r > 60) continue;
    if (p.holeCooldown && Date.now() < p.holeCooldown) continue;

    for (const h of holes) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < h.r * 0.5) {
        p.hidden = true;
        p.inHole = h.id;
        p.x = h.x; p.y = h.y;
        p.vx = 0; p.vy = 0;
        p.dashVx = 0; p.dashVy = 0;
        break;
      }
    }
  }

  // ДВИЖЕНИЕ ВНУТРИ НОРКИ
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (!p.hidden || p.dead) continue;

    const hole = holes.find(h => h.id === p.inHole);
    if (!hole) { p.hidden = false; continue; }

    const dirX = p.moveDirX || 0;
    const dirY = p.moveDirY || 0;
    const dirDist = Math.hypot(dirX, dirY);

    if (dirDist > 0.01) {
      const targetAngle = Math.atan2(dirY, dirX);
      let diff = targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * 0.3;
    }

    if (dirDist > 0.1 && p.movePower > 0.05) {
      const speed = 50;
      p.x += (dirX / dirDist) * speed * p.movePower;
      p.y += (dirY / dirDist) * speed * p.movePower;

      const dx = p.x - hole.x;
      const dy = p.y - hole.y;
      const distFromCenter = Math.hypot(dx, dy);
      const innerRadius = hole.r * 0.7;

      if (distFromCenter > innerRadius) {
        const ang = Math.atan2(dy, dx);
        p.x = hole.x + Math.cos(ang) * innerRadius;
        p.y = hole.y + Math.sin(ang) * innerRadius;
      }
    }
  }

  // Еда
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.hidden || p.isSanta || p.dead) continue;
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i];
      if (Math.hypot(p.x - f.x, p.y - f.y) < p.r + f.r * 0.5) {
        if (p.level < f.minLevel) continue;
        const now = Date.now();
        if (!p.lastFoodBite || now - p.lastFoodBite >= 400) {
          p.lastFoodBite = now;
          f.hp -= 1;
          p.score += f.xp || 1;
          p.hp = Math.min(p.maxHp, p.hp + 1);
          if (f.hp <= 0) { food.splice(i, 1); food.push(spawnFood()); }
          const currentAnimal = getAnimalByLevel(p.level);
          if (p.score >= currentAnimal.xpToNext && p.level < 6) {
            p.level += 1;
            const nextAnimal = getAnimalByLevel(p.level);
            p.r = nextAnimal.r; p.color = nextAnimal.color;
            p.hp = nextAnimal.hp; p.maxHp = nextAnimal.hp; p.damage = nextAnimal.damage;
            broadcast({ type: 'chat', system: true, text: `🎉 ${p.name} стал ${nextAnimal.name}!` });
          }
        }
      }
    }

    for (let i = meat.length - 1; i >= 0; i--) {
      const m = meat[i];
      if (Math.hypot(p.x - m.x, p.y - m.y) < p.r + m.r * 0.5) {
        const now = Date.now();
        if (!p.lastFoodBite || now - p.lastFoodBite >= 300) {
          p.lastFoodBite = now;
          m.hp -= 1;
          p.score += Math.ceil(m.xp / m.maxHp);
          p.hp = Math.min(p.maxHp, p.hp + 2);
          if (m.hp <= 0) { meat.splice(i, 1); }
          const currentAnimal = getAnimalByLevel(p.level);
          if (p.score >= currentAnimal.xpToNext && p.level < 6) {
            p.level += 1;
            const nextAnimal = getAnimalByLevel(p.level);
            p.r = nextAnimal.r; p.color = nextAnimal.color;
            p.hp = nextAnimal.hp; p.maxHp = nextAnimal.hp; p.damage = nextAnimal.damage;
            broadcast({ type: 'chat', system: true, text: `🎉 ${p.name} стал ${nextAnimal.name}!` });
          }
        }
      }
    }

    for (let i = presents.length - 1; i >= 0; i--) {
      const pr = presents[i];
      if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) {
        p.score += pr.xp;
        p.hp = Math.min(p.maxHp, p.hp + 5);
        presents.splice(i, 1);
        broadcast({ type: 'chat', system: true, text: `🎁 ${p.name} получил подарок (+${pr.xp} XP)!` });
      }
    }
  }

  // Кристаллы
  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.hidden || p.dead) continue;
    for (const c of crystals) {
      if (c.hp <= 0) continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + c.r * 0.5) {
        const now = Date.now();
        if (!p.lastCrystalBite || now - p.lastCrystalBite >= 500) {
          p.lastCrystalBite = now;
          c.hp -= 1;
          if (c.isMega) {
            p.hp = Math.min(p.maxHp, p.hp + 50);
            p.water = Math.min(p.maxWater, p.water + 100);
            p.score += 50;
          } else {
            p.hp = Math.min(p.maxHp, p.hp + 15);
            p.water = Math.min(p.maxWater, p.water + 20);
            p.score += 5;
          }
          if (c.hp <= 0) {
            if (c.isMega) {
              const a = Math.random() * Math.PI * 2;
              const d = Math.random() * (VOLCANO.r - 100);
              c.x = VOLCANO.x + Math.cos(a) * d;
              c.y = VOLCANO.y + Math.sin(a) * d;
              c.hp = c.maxHp; c.respawnAt = 0;
              broadcast({ type: 'chat', system: true, text: `💎 ${p.name} СЪЕЛ МЕГА-КРИСТАЛЛ!` });
            } else {
              c.respawnAt = Date.now() + 15000;
            }
          }
        }
      }
    }
  }

  // Респавн кристаллов
  const now = Date.now();
  for (const c of crystals) {
    if (c.hp <= 0 && c.respawnAt && now >= c.respawnAt) {
      if (c.isMega) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (VOLCANO.r - 100);
        c.x = VOLCANO.x + Math.cos(a) * d;
        c.y = VOLCANO.y + Math.sin(a) * d;
        c.hp = c.maxHp; c.respawnAt = 0;
      } else {
        let x, y;
        do {
          x = 100 + Math.random() * (WORLD.width - 200);
          y = 100 + Math.random() * (WORLD.height - 200);
        } while (isInVolcano(x, y));
        c.x = x; c.y = y; c.hp = c.maxHp; c.respawnAt = 0;
      }
    }
  }

  // PvP
  const ids = Object.keys(players);
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      const p1 = players[ids[a]];
      const p2 = players[ids[b]];
      if (!p1 || !p2 || p1.hidden || p2.hidden || p1.dead || p2.dead) continue;
      if (p1.isSanta || p2.isSanta) continue;
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const bigger = p1.r > p2.r ? p1 : p2;
      const smaller = p1.r > p2.r ? p2 : p1;
      if (bigger.r / smaller.r >= 1.2 && dist < bigger.r) {
        const tnow = Date.now();
        if (!smaller.lastHit || tnow - smaller.lastHit >= 500) {
          smaller.lastHit = tnow;
          smaller.hp -= bigger.damage;
          if (smaller.hp <= 0) {
            bigger.r = Math.sqrt(bigger.r * bigger.r + smaller.r * smaller.r);
            bigger.score += Math.floor(smaller.score / 2);
            if (!bigger.eatenLevels.includes(smaller.level)) bigger.eatenLevels.push(smaller.level);
            if (smaller.level === 6 && bigger.level === 6) {
              bigger.dragonsKilled = (bigger.dragonsKilled || 0) + 1;
              broadcast({ type: 'chat', system: true, text: `🐉 ${bigger.name} убил дракона! (${bigger.dragonsKilled}/3)` });
            }
            broadcast({ type: 'chat', system: true, text: `⚔️ ${bigger.name} съел ${smaller.name}` });
            delete players[smaller.id];
          }
        }
      }
    }
  }

  // Огненные шары
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    fb.x += fb.vx; fb.y += fb.vy; fb.life -= 1;
    for (const id in players) {
      const p = players[id];
      if (!p || p.id === fb.owner || p.hidden || p.isSanta || p.dead) continue;
      if (Math.hypot(p.x - fb.x, p.y - fb.y) < p.r + fb.r) {
        p.hp -= fb.damage;
        const ang = Math.atan2(p.y - fb.y, p.x - fb.x);
        p.x += Math.cos(ang) * 100; p.y += Math.sin(ang) * 100;
        fireballs.splice(i, 1);
        if (p.hp <= 0) { p.dead = true; broadcast({ type: 'chat', system: true, text: `🔥 ${p.name} сгорел!` }); }
        break;
      }
    }
    if (fb.life <= 0) fireballs.splice(i, 1);
    if (fb.x < 0 || fb.x > WORLD.width || fb.y < 0 || fb.y > WORLD.height) fireballs.splice(i, 1);
  }

  const now2 = Date.now();
  for (const id in players) {
    if (players[id].chatTime && now2 - players[id].chatTime > 3000) {
      players[id].chatText = '';
      players[id].chatTime = 0;
    }
  }

  // === FAST: игроки + фаерболы (30 раз/сек) ===
  const fastState = JSON.stringify({ type: 'state_fast', players, fireballs });
  wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(fastState); });

  // === SLOW: статика (5 раз/сек = каждый 6-й тик) ===
  if (tickCount % 6 === 0) {
    const slowState = JSON.stringify({
      type: 'state_slow',
      food, holes, biomes: BIOMES, presents, crystals, meat,
      volcano: VOLCANO, arena
    });
    wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(slowState); });
  }
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`👑 Админ-пароль: ${ADMIN_PASSWORD}`);
});
