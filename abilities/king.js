module.exports = {
  name: 'Хвост',
  key: 'E',
  cooldown: 3000,
  use(player, players, world, helpers) {
    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead || p.hidden) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < player.r + 150) {
        p.hp -= 25;
        const ang = Math.atan2(p.y - player.y, p.x - player.x);
        p.x += Math.cos(ang) * 200;
        p.y += Math.sin(ang) * 200;
      }
    }
    return { ok: true, message: '👑 Хвост!' };
  }
};
