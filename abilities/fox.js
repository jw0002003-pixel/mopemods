module.exports = {
  name: 'Выгон',
  key: 'Q',
  cooldown: 8000,
  use(player, players, world, helpers) {
    let count = 0;
    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead) continue;
      if (!p.hidden) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 500) {
        // Выгнать из норы
        p.hidden = false;
        p.inHole = null;
        p.holeCooldown = Date.now() + 2000;
        count++;
      }
    }
    if (count > 0) {
      return { ok: true, message: `🦊 Выгнал ${count} из нор!` };
    }
    return { ok: false, message: '❌ Никого нет в норах рядом' };
  }
};
