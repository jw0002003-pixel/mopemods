const abilities = {
  mouse:  require('./mouse'),
  rabbit: require('./rabbit'),
  fox:    require('./fox'),
  wolf:   require('./wolf'),
  bear:   require('./bear'),
  dragon: require('./dragon'),
  king:   require('./king')
};

function getAbilityByLevel(level) {
  const order = ['mouse', 'rabbit', 'fox', 'wolf', 'bear', 'dragon', 'king'];
  const name = order[Math.min(Math.max(0, level - 1), order.length - 1)];
  return abilities[name];
}

module.exports = { abilities, getAbilityByLevel };
