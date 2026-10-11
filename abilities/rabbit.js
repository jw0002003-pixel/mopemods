module.exports = {
  name: 'Нора',
  key: 'Q',
  cooldown: 15000,
  use(player, players, world, helpers) {
    // Создать временную нору под игроком
    const hole = {
      id: 'temp_' + Math.random().toString(36).slice(2),
      x: player.x,
      y: player.y,
      r: 60,
      temp: true,
      expiresAt: Date.now() + 30000 // 30 секунд
    };
    helpers.holes.push(hole);
    return { ok: true, message: '🐰 Кролик создал нору (30 сек)!' };
  }
};
