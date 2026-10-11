module.exports = {
  name: 'Вой',
  key: 'Q',
  cooldown: 8000,
  use(player, players, world, helpers) {
    let dx = player.moveDirX || 0;
    let dy = player.moveDirY || 0;
    if (Math.hypot(dx, dy) < 0.01) {
      dx = Math.cos(player.angle || 0);
      dy = Math.sin(player.angle || 0);
    }
    const d = Math.hypot(dx, dy) || 1;
    // Создать оглушающий шар
    helpers.stunBalls = helpers.stunBalls || [];
    helpers.stunBalls.push({
      id: Math.random().toString(36).slice(2),
      x: player.x, y: player.y,
      vx: (dx / d) * 12, vy: (dy / d) * 12,
      r: 25, owner: player.id, life: 100, stunDuration: 2000
    });
    return { ok: true, message: '🐺 Вой + шар!' };
  }
};
