const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { getAbilityByLevel } = require('./abilities');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const WORLD = { width: 6000, height: 6000 };
const TICK_RATE = 30;
const FOOD_COUNT = 500;
const HOLE_COUNT = 60;
const CRYSTAL_COUNT = 20;

const ADMIN_PASSWORD = '1';

const VOLCANO = { x: 3000, y: 2700, r: 900 };

const DUCK_ISLAND = { x: 1500, y: 3100, r: 250 };
const DUCK_POND = { x: 1500, y: 3100, r: 130 };
const DUCK_COUNT = 15;

function isInVolcano(x, y) {
  return Math.hypot(x - VOLCANO.x, y - VOLCANO.y) < VOLCANO.r;
}

function isInDuckIsland(x, y) {
  return Math.hypot(x - DUCK_ISLAND.x, y - DUCK_ISLAND.y) < DUCK_ISLAND.r;
}

function isInDuckPond(x, y) {
  return Math.hypot(x - DUCK_POND.x, y - DUCK_POND.y) < DUCK_POND.r;
}

const BIOMES = [
  { name: 'water',  x: 0,    y: 0,    w: 1500, h: 1800, color: '#1e3a5f' },
  { name: 'snow',   x: 1500, y: 0,    w: 3000, h: 1800, color: '#c8d8e8' },
  { name: 'water',  x: 4500, y: 0,    w: 1500, h: 1800, color: '#1e3a5f' },
  { name: 'water',  x: 0,    y: 1800, w: 1000, h: 1800, color: '#1e3a5f' },
  { name: 'forest', x: 1000, y: 1800, w: 4000, h: 1800, color: '#2d5a27' },
  { name: 'water',  x: 5000, y: 1800, w: 1000, h: 1800, color: '#1e3a5f' },
  { name: 'river',  x: 0,    y: 3600, w: 6000, h: 600,  color: '#3b7fb0' },
  { name: 'water',  x: 0,    y: 4200, w: 1000, h: 1800, color: '#1e3a5f' },
  { name: 'desert', x: 1000, y: 4200, w: 4000, h: 1800, color: '#c2a56b' },
  { name: 'water',  x: 5000, y: 4200, w: 1000, h: 1800, color: '#1e3a5f' }
];

const RIVER_FLOW = { x: 1, y: 0 };

function getBiomeAt(x, y) {
  if (isInVolcano(x, y)) return { name: 'volcano', color: '#4a1818' };
  if (isInDuckIsland(x, y)) return { name: 'duck', color: '#2d5a27' };
  for (const b of BIOMES) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return BIOMES[0];
}

const HOLE_ENTER_SPEED = 100;
const HOLE_EXIT_SPEED = 80;

function resolveFoodCollision(p, f) {
  if (p.level >= 6) return false;
  const dx = p.x - f.x;
  const dy = p.y - f.y;
  const dist = Math.hypot(dx, dy);
  const minDist = p.r * 0.8 + f.r * 0.8;

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    p.x += nx * overlap * 0.85;
    p.y += ny * overlap * 0.85;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= vn * nx * 0.9; p.vy -= vn * ny * 0.9; }
    return true;
  }
  return false;
}

function resolveCrystalCollision(p, c) {
  if (c.hp <= 0) return false;
  if (p.level >= 6) return false;

  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dist = Math.hypot(dx, dy);
  const minDist = p.r * 0.85 + c.r * 0.85;

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    p.x += nx * overlap * 0.6;
    p.y += ny * overlap * 0.6;

    const pushStrength = 0.25;
    c.vx -= nx * overlap * pushStrength;
    c.vy -= ny * overlap * pushStrength;

    const maxCrystalSpeed = 3.5;
    const cSpeed = Math.hypot(c.vx, c.vy);
    if (cSpeed > maxCrystalSpeed) {
      c.vx = (c.vx / cSpeed) * maxCrystalSpeed;
      c.vy = (c.vy / cSpeed) * maxCrystalSpeed;
    }

    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= vn * nx * 0.85; p.vy -= vn * ny * 0.85; }
    return true;
  }
  return false;
}

const FOOD_TYPES = [
  { name: 'berry',    color: '#e63946', r: 25, xp: 3,  sprite: 'berry',  emoji: '🍓', biome: 'forest',  minLevel: 1, bites: 1 },
  { name: 'mushroom', color: '#d4a373', r: 30, xp: 4,  emoji: '🍄', biome: 'forest',  minLevel: 1, bites: 2 },
  { name: 'apple',    color: '#ff0000', r: 30, xp: 4,  emoji: '🍎', biome: 'forest',  minLevel: 1, bites: 2 },
  { name: 'banana',   color: '#ffd60a', r: 32, xp: 5,  sprite: 'banana', emoji: '🍌', biome: 'desert',  minLevel: 2, bites: 2 },
  { name: 'fish',     color: '#00b4d8', r: 32, xp: 5,  emoji: '🐟', biome: 'water',   minLevel: 2, bites: 2 },
  { name: 'carrot',   color: '#ff8c00', r: 35, xp: 6,  sprite: 'carrot', emoji: '🥕', biome: 'forest',  minLevel: 3, bites: 3 },
  { name: 'meat',     color: '#a0522d', r: 38, xp: 8,  sprite: 'meat',   emoji: '🍖', biome: 'snow',    minLevel: 3, bites: 3 },
  { name: 'cactus',   color: '#2d6a4f', r: 36, xp: 7,  sprite: 'cactus', emoji: '🌵', biome: 'desert',  minLevel: 3, bites: 3 },
  { name: 'ice',      color: '#a0e0ff', r: 42, xp: 10, emoji: '🧊', biome: 'snow',    minLevel: 4, bites: 4 },
  { name: 'lava',     color: '#ff4500', r: 45, xp: 12, emoji: '🔥', biome: 'volcano', minLevel: 5, bites: 4 }
];

const ANIMALS = [
  { name: 'Мышка',           r: 15,  speed: 12, color: '#a0a0a0', xpToNext: 10,  hp: 30,  damage: 5,  fov: 500 },
  { name: 'Кролик',          r: 20,  speed: 12, color: '#d4a373', xpToNext: 25,  hp: 50,  damage: 8,  fov: 700 },
  { name: 'Лиса',            r: 28,  speed: 12, color: '#e07a5f', xpToNext: 50,  hp: 80,  damage: 12, fov: 900 },
  { name: 'Волк',            r: 38,  speed: 12, color: '#8d99ae', xpToNext: 100, hp: 120, damage: 18, fov: 1300 },
  { name: 'Медведь',         r: 52,  speed: 10, color: '#6f4e37', xpToNext: 200, hp: 180, damage: 25, fov: 1500 },
  { name: 'Дракон',          r: 300, speed: 8,  color: '#9b2226', xpToNext: 400, hp: 250, damage: 35, fov: 2000 },
  { name: 'Король Драконов', r: 300, speed: 8,  color: '#ff4500', xpToNext: Infinity, hp: 500, damage: 50, fov: 3000 }
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
let ducks = [];
let arena = { x: 3000, y: 2700, r: 500, active: false };
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
    sprite: type.sprite || null,
    emoji: type.emoji, xp: type.xp, minLevel: type.minLevel, biome: type.biome,
    hp: type.bites, maxHp: type.bites, bites: type.bites,
    vx: 0, vy: 0
  };
}
for (let i = 0; i < FOOD_COUNT; i++) food.push(spawnFood());

function spawnDuck() {
  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * (DUCK_POND.r - 30);
  return {
    id: Math.random().toString(36).slice(2),
    x: DUCK_POND.x + Math.cos(a) * d,
    y: DUCK_POND.y + Math.sin(a) * d,
    angle: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.5,
    r: 18,
    hp: 1,
    quackCooldown: Date.now() + Math.random() * 5000
  };
}
for (let i = 0; i < DUCK_COUNT; i++) ducks.push(spawnDuck());

function spawnCrystal() {
  let x, y;
  do {
    x = 200 + Math.random() * (WORLD.width - 400);
    y = 200 + Math.random() * (WORLD.height - 400);
  } while (isInVolcano(x, y));
  return {
    id: Math.random().toString(36).slice(2),
    x, y, r: 60, hp: 50, maxHp: 50, respawnAt: 0, isMega: false,
    vx: 0, vy: 0
  };
}
function spawnMegaCrystal() {
  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * (VOLCANO.r - 100);
  const x = VOLCANO.x + Math.cos(a) * d;
  const y = VOLCANO.y + Math.sin(a) * d;
  return {
    id: 'mega_' + Math.random().toString(36).slice(2),
    x, y, r: 150, hp: 200, maxHp: 200, respawnAt: 0, isMega: true,
    vx: 0, vy: 0
  };
}
for (let i = 0; i < CRYSTAL_COUNT; i++) crystals.push(spawnCrystal());
crystals.push(spawnMegaCrystal());

function spawnHole() {
  let x, y;
  do {
    x = 200 + Math.random() * (WORLD.width - 400);
    y = 200 + Math.random() * (WORLD.height - 400);
  } while (isInVolcano(x, y));
  return { id: Math.random().toString(36).slice(2), x, y, r: 50 };
}
for (let i = 0; i < HOLE_COUNT; i++) holes.push(spawnHole());

wss.on('connection', (ws) => {
  const id = nextId++;
  ws._playerId = id;
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
    air: 100, maxAir: 100,
    lastBoost: 0, boostActive: false, boostAngle: 0,
    dashVx: 0, dashVy: 0,
    isAdmin: false, isSanta: false, santaSpeed: 8,
    chatText: '', chatTime: 0,
    eatenLevels: [], dragonsKilled: 0,
    lastFire: 0, lastTail: 0, lastHit: 0,
    lastFoodBite: 0, lastCrystalBite: 0,
    auraColor: null, auraUntil: 0,
    lastVolcanoDamage: 0, lastSantaGift: 0, lastWaterDrink: 0,
    inHole: false, hidden: false, burning: 0, dead: false,
    underwater: false,
    swingActive: false, swingTime: 0, swingAngle: 0, stunned: 0, nextPawSide: 'left',
    spectating: false, inArena: false,
    previousScore: 0,
    holeCooldown: 0,
    lastAbility: 0,
    holeState: 'outside',
    holeTargetX: 0,
    holeTargetY: 0,
    inDuckIsland: false
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
      if (data.type === 'dive' && players[id]) {
        const p = players[id];
        if (p.dead) return;
        if (p.level >= 6) return;
        if (p.isSanta) return;
        const biome = getBiomeAt(p.x, p.y);
        if (biome.name !== 'water' && biome.name !== 'river' && biome.name !== 'duck') return;
        if (p.air > 0) p.underwater = true;
      }
      if (data.type === 'diveRelease' && players[id]) {
        const p = players[id];
        p.underwater = false;
      }
      if (data.type === 'boost' && players[id]) {
        const p = players[id];
        if (p.dead) return;
        if (p.holeState === 'inside') return;

        const now = Date.now();
        if (now - p.lastBoost < 1000) return;
        p.lastBoost = now;
        p.boostActive = true;
        setTimeout(() => { if (players[id]) players[id].boostActive = false; }, 500);

        let dx = p.moveDirX || 0, dy = p.moveDirY || 0;
        if (Math.hypot(dx, dy) < 0.01) {
          dx = p.targetX - p.x; dy = p.targetY - p.y;
        }
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01) {
          const power = 1.75;
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
          if (biome.name === 'water' || biome.name === 'river' || biome.name === 'duck') {
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
        const helpers = { fireballs, holes, stunBalls: [] };
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
      if (data.type === 'admin_level' && players[id]) {
        const p = players[id];
        if (!p.isAdmin) {
          ws.send(JSON.stringify({ type: 'chat', system: true, text: '❌ Только админ' }));
          return;
        }
        if (p.dead || p.hidden || p.isSanta) return;

        const delta = parseInt(data.delta) || 0;
        if (delta === 0) return;

        const currentLvl = p.level || 1;
        let newLvl = currentLvl + delta;
        if (newLvl < 1) newLvl = 1;
        if (newLvl > 6) newLvl = 6;
        if (newLvl === currentLvl) return;

        p.level = newLvl;
        const a = ANIMALS[newLvl - 1];
        p.r = a.r; p.color = a.color;
        p.hp = a.hp; p.maxHp = a.hp; p.damage = a.damage;
        p.score = [10, 25, 50, 100, 200, 400][newLvl - 1] || 0;

        broadcast({ type: 'chat', system: true, text: `👑 ${p.name} переключился: ${a.name} (${newLvl} ур.)` });
      }
      if (data.type === 'spawn' && players[id]) {
        const p = players[id];
        let x, y, biome, tries = 0;
        do {
          x = 200 + Math.random() * (WORLD.width - 400);
          y = 200 + Math.random() * (WORLD.height - 400);
          biome = getBiomeAt(x, y);
          tries++;
        } while ((biome.name === 'volcano' || biome.name === 'water' || biome.name === 'river') && tries < 100);

        p.x = x; p.y = y;
        p.level = 1;
        const animal = ANIMALS[0];
        p.r = animal.r; p.color = animal.color;
        p.hp = animal.hp; p.maxHp = animal.hp; p.damage = animal.damage;
        p.score = 0;
        p.water = p.maxWater;
        p.air = p.maxAir;
        p.burning = 0;
        p.dead = false;
        p.spectating = false;
        p.isSanta = false;
        p.hidden = false;
        p.inHole = null;
        p.holeState = 'outside';
        p.vx = 0; p.vy = 0;
        p.dashVx = 0; p.dashVy = 0;
        p.eatenLevels = [];
        p.dragonsKilled = 0;
        p.underwater = false;
        p.inDuckIsland = false;
      }
      if (data.type === 'respawn' && players[id]) {
        const p = players[id];
        p.dead = false;
        p.spectating = false;
        p.hp = 30; p.maxHp = 30;
        p.water = 100; p.maxWater = 100;
        p.air = 100; p.maxAir = 100;
        p.score = 0; p.level = 1; p.r = 15;
        p.color = '#a0a0a0'; p.damage = 5;
        p.isSanta = false;
        p.hidden = false;
        p.inHole = null;
        p.holeState = 'outside';
        p.vx = 0; p.vy = 0;
        p.dashVx = 0; p.dashVy = 0;
        p.underwater = false;
        p.inDuckIsland = false;
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

        if (text === '/a ' + ADMIN_PASSWORD) {
          p.isAdmin = true;
          ws.send(JSON.stringify({ type: 'chat', system: true, text: '👑 Ты теперь админ! Стрелки ↑ ↓ — смена уровня.' }));
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
          if (cmd === '/help') ws.send(JSON.stringify({ type: 'chat', system: true, text: '👑 /a 1 | /kill /tp X Y /size N /level N /score N /clear /santa /santaspeed N | Стрелки ↑↓' }));
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

  // 🦆 УТКИ
  for (const d of ducks) {
    d.angle += (Math.random() - 0.5) * 0.3;
    d.x += Math.cos(d.angle) * d.speed;
    d.y += Math.sin(d.angle) * d.speed;

    const distFromPond = Math.hypot(d.x - DUCK_POND.x, d.y - DUCK_POND.y);
    if (distFromPond > DUCK_POND.r - 20) {
      const angToCenter = Math.atan2(DUCK_POND.y - d.y, DUCK_POND.x - d.x);
      d.angle = angToCenter + (Math.random() - 0.5) * 0.5;
      d.x += Math.cos(d.angle) * d.speed;
      d.y += Math.sin(d.angle) * d.speed;
    }

    const nowQ = Date.now();
    if (nowQ > d.quackCooldown) {
      d.quackCooldown = nowQ + 5000 + Math.random() * 10000;
      const msg = JSON.stringify({ type: 'quack', x: d.x, y: d.y });
      wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
      });
    }
  }

  for (const id in players) {
    if (!players[id]) continue;
    const p = players[id];
    if (p.dead) continue;

    const inDuckNow = isInDuckIsland(p.x, p.y);
    if (inDuckNow && !p.inDuckIsland)
