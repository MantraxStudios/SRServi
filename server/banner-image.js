// Genera automáticamente una imagen de banner promocional para el tótem a partir
// de los productos de la tienda. Se usa desde el editor del tótem (botón "Auto").
// Banner 1600×480: fondo con degradado del color de acento del mes, nombre de la
// tienda + gancho, y hasta 4 fotos de productos en círculos a la derecha.
import { createCanvas } from '@napi-rs/canvas';
import { rr, getSeason, drawShape, tryLoadImg } from './cctv-menu-image.js';

function hexToRgb(hex) {
  const h = String(hex || '#D4AF37').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/**
 * @param {Object} opts
 * @param {Array}  opts.products   productos de la tienda (se usan los primeros con imagen)
 * @param {Object} opts.store      { name, country }
 * @param {string} opts.serverDir  dir del server para resolver imágenes locales
 * @returns {Promise<Buffer>} PNG
 */
export async function generateBannerImage({ products, store, serverDir }) {
  const W = 1600, H = 480;
  const season = getSeason(new Date(), store?.country);
  const accent = season?.accent || '#D4AF37';

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fondo: degradado diagonal del acento del mes
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(accent, -30));
  g.addColorStop(1, shade(accent, 45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Figuras del mes tenues de fondo
  if (season?.label) {
    for (let i = 0; i < 9; i++) {
      const fx = ((i * 61 + 20) % 100) / 100 * W;
      const fy = ((i * 43 + 15) % 100) / 100 * H;
      const fs = 60 + ((i * 17) % 5) * 12;
      ctx.globalAlpha = 0.10;
      drawShape(ctx, season.shape, fx, fy, fs, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  // Fotos de productos (círculos) a la derecha
  const withImg = (products || []).filter(p => p && p.image).slice(0, 4);
  const imgs = await Promise.all(withImg.map(p => tryLoadImg(p.image, serverDir)));
  const loaded = imgs.filter(Boolean);
  const D = 250;                 // diámetro círculo
  const startX = W - 90 - D;     // primer círculo (el de más a la derecha)
  loaded.slice(0, 4).forEach((img, i) => {
    const cx = startX - i * (D * 0.62);
    const cy = H / 2 + (i % 2 === 0 ? -18 : 18);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, D / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    const scale = Math.max(D / img.width, D / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    // Borde blanco
    ctx.beginPath();
    ctx.arc(cx, cy, D / 2, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  });

  // Texto a la izquierda
  const padX = 90;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;

  // Píldora con el mes (si hay temporada)
  let ty = 150;
  if (season?.label) {
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.font = '800 34px Arial, sans-serif';
    const tw = ctx.measureText(season.label).width;
    const pillH = 56, pillW = tw + 90;
    rr(ctx, padX, 70, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    drawShape(ctx, season.shape, padX + 34, 70 + pillH / 2, 34, '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(season.label, padX + 60, 70 + pillH / 2 + 2);
    ctx.textBaseline = 'alphabetic';
    ty = 240;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
  }

  // Nombre de la tienda
  const name = (store?.name || 'Nuestro menú').toString();
  let nameFont = 78;
  ctx.font = `900 ${nameFont}px Arial, sans-serif`;
  const maxTextW = startX - D / 2 - padX - 40;
  while (nameFont > 40 && ctx.measureText(name).width > maxTextW) {
    nameFont -= 4; ctx.font = `900 ${nameFont}px Arial, sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, padX, ty);

  // Gancho
  ctx.font = '700 40px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('¡Descubre nuestros productos!', padX, ty + 62);

  return canvas.toBuffer('image/png');
}
