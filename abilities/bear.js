module.exports = {
  name: 'Удар лапой',
  key: 'Q',
  cooldown: 500,
  use(player, players, world, helpers) {
    player.swingActive = true;
    player.swingTime = Date.now();
    player.swingAngle = player.angle || 0;

    // Чередование стороны: left → right → left → right...
    player.nextPawSide = player.nextPawSide === 'left' ? 'right' : 'left';

    setTimeout(() => {
      if (players[player.id]) {
        players[player.id].swingActive = false;
      }
    }, 80);

    // Урон — только в полукруг спереди (радиус 150, угол ±60°)
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
        p.hp -= 60;
        p.stunned = Date.now() + 1500;
        const ang = Math.atan2(dy, dx);
        p.x += Math.cos(ang) * 150;
        p.y += Math.sin(ang) * 150;
        hitCount++;
      }
    }

    if (hitCount > 0) {
      return { ok: true, message: `🐻 Удар! Попало: ${hitCount}` };
    }
    return { ok: true, message: '🐻 Удар!' };
  }
};
