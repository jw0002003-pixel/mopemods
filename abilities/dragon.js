module.exports = {
  name: 'Огненный шар',
  key: 'Q',
  cooldown: 1000,
  use(player, players, world, helpers) {
    let dx = player.moveDirX || 0;
    let dy = player.moveDirY || 0;
    // Если стоим — стреляем в сторону носа
    if (Math.hypot(dx, dy) < 0.01) {
      dx = Math.cos(player.angle || 0);
      dy = Math.sin(player.angle || 0);
    }
    const d = Math.hypot(dx, dy) || 1;
    helpers.fireballs.push({
      id: Math.random().toString(36).slice(2),
      x: player.x, y: player.y,
      vx: (dx / d) * 15, vy: (dy / d) * 15,
      r: 20, owner: player.id, damage: 40, life: 60
    });
    return { ok: true, message: '🔥 Огонь!' };
  }
};