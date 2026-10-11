module.exports = {
  name: 'Рык',
  key: 'Q',
  cooldown: 7000,
  use(player, players, world, helpers) {
    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead || p.hidden) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 400) {
        const ang = Math.atan2(p.y - player.y, p.x - player.x);
        p.x += Math.cos(ang) * 250;
        p.y += Math.sin(ang) * 250;
        p.hp -= 15;
      }
    }
    return { ok: true, message: '🐻 Рык!' };
  }
};
