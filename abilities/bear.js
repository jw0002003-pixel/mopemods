module.exports = {
  name: 'Удар лапой',
  key: 'Q',
  cooldown: 6000,
  use(player, players, world, helpers) {
    // Найти ближайшего игрока
    let nearest = null, minD = Infinity;
    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead || p.hidden || p.isSanta) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < minD) { minD = d; nearest = p; }
    }
    if (nearest && minD < 300) {
      nearest.hp -= 60;
      nearest.stunned = Date.now() + 1500;
      const ang = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      nearest.x += Math.cos(ang) * 150;
      nearest.y += Math.sin(ang) * 150;
      return { ok: true, message: `🐻 Удар! ${nearest.name} получил 60 урона!` };
    }
    return { ok: false, message: '❌ Никого рядом' };
  }
};
