module.exports = {
  name: 'Норка',
  key: 'Q',
  cooldown: 5000,
  use(player, players, world, helpers) {
    const holes = helpers.holes;
    let nearest = null, minD = Infinity;
    for (const h of holes) {
      const d = Math.hypot(h.x - player.x, h.y - player.y);
      if (d < minD) { minD = d; nearest = h; }
    }
    if (nearest && minD < 800) {
      player.hidden = true;
      player.inHole = nearest.id;
      player.x = nearest.x;
      player.y = nearest.y;
      player.vx = 0; player.vy = 0;
      return { ok: true, message: '🕳 Мышь спряталась!' };
    }
    return { ok: false, message: '❌ Нет норки рядом' };
  }
};
