module.exports = {
  name: 'Рывок',
  key: 'Q',
  cooldown: 4000,
  use(player, players, world, helpers) {
    let dx = player.moveDirX || 0;
    let dy = player.moveDirY || 0;
    // Если стоим — рывок в сторону носа
    if (Math.hypot(dx, dy) < 0.01) {
      dx = Math.cos(player.angle || 0);
      dy = Math.sin(player.angle || 0);
    }
    const d = Math.hypot(dx, dy) || 1;
    player.x += (dx / d) * 300;
    player.y += (dy / d) * 300;
    player.x = Math.max(player.r, Math.min(world.width - player.r, player.x));
    player.y = Math.max(player.r, Math.min(world.height - player.r, player.y));
    player.boostActive = true;
    setTimeout(() => { if (players[player.id]) players[player.id].boostActive = false; }, 400);
    return { ok: true, message: '🦊 Рывок!' };
  }
};