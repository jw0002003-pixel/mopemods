// === ЗАГРУЗКА PNG-СКИНОВ ===
const SKIN_NAMES = ['mouse', 'rabbit', 'fox', 'wolf', 'bear', 'dragon', 'king'];
const skinImages = {};

SKIN_NAMES.forEach(name => {
  const img = new Image();
  img.src = `skins/${name}.png`;
  skinImages[name] = img;
  img.onload = () => console.log(`✅ Скин загружен: ${name}`);
  img.onerror = () => console.warn(`❌ Не найден: skins/${name}.png`);
});

function drawSkin(ctx, x, y, size, level, angle) {
  let img;
  if (level === 'santa') img = skinImages['king'];
  else img = skinImages[SKIN_NAMES[Math.min(Math.max(0, (level || 1) - 1), 6)]];

  if (!img || !img.complete || img.naturalWidth === 0) {
    // Если PNG нет — рисуем круг
    ctx.beginPath();
    ctx.arc(x, y, size / 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#888';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    return true;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle || 0) - Math.PI / 2);
  const aspect = img.naturalWidth / img.naturalHeight;
let w = size, h = size;
if (aspect > 1) { h = size / aspect; }
else { w = size * aspect; }
ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}