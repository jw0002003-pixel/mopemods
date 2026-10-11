module.exports = {
  name: 'Удар лапой',
  key: 'Q',
  cooldown: 500,
  use(player, players, world, helpers) {
    const now = Date.now();
    player.swingActive = true;
    player.swingTime = now;
    player.swingAngle = player.angle || 0;

    player.nextPawSide = player.nextPawSide === 'left' ? 'right' : 'left';
    const side = player.nextPawSide;

    // ⏱️ Длительность анимации — синхронизирована с клиентом
    setTimeout(() => {
      if (players[player.id]) players[player.id].swingActive = false;
    }, 150);

    const hitRange = 150;
    const hitAngle = Math.PI / 3;
    let hitCount = 0;

    for (const id in players) {
      const p = players[id];
      if (p.id === player.id || p.dead || p.hidden || p.isSanta) continue;

      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > hitRange + p.r) continue;

      const angleToTarget = Math.atan2(dy, dx);
      let angleDiff = angleToTarget - player.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) < hitAngle) {
        p.hp -= player.damage * 2;
        p.stunned = now + 1500;

        p.x = Math.max(p.r, Math.min(world.width - p.r,
          p.x + Math.cos(angleToTarget) * 150));
        p.y = Math.max(p.r, Math.min(world.height - p.r,
          p.y + Math.sin(angleToTarget) * 150));

        hitCount++;
      }
    }

    return {
      ok: true,
      message: hitCount > 0 ? `🐻 Удар! Попало: ${hitCount}` : '🐻 Удар!'
    };
  }
};
