module.exports = {
  name: 'Вой',
  key: 'Q',
  cooldown: 8000,
  use(player, players, world, helpers) {
    let count = 0;
    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead || p.hidden) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 600) { p.hp -= 10; count++; }
    }
    return { ok: true, message: `🐺 Вой! Затронуто: ${count}` };
  }
};
