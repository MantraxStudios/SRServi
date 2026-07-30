// Genera una imagen estática del menú (catálogo) de la tienda para enviarla a la
// cartelería digital (CCTV). Replica el diseño de tarjeta del tótem/Store: fondo
// crema, tarjeta blanca con imagen arriba y nombre + precio abajo.
//   - Landscape 1920×1080  → 6 tarjetas arriba y 6 abajo (6 columnas × 2 filas)
//   - Portrait  1080×1920  → 3 columnas × 4 filas (12 productos, más grandes)
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://srservi2.srautomatic.com';

// Paleta "kiosk" (igual que en styles.css / Store.jsx)
const CREAM = '#FAF4E9';
const CARD = '#ffffff';
const DARK = '#232028';
const MUTED = '#8f8a80';
const BORDER = '#F0E8D9';

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

async function tryLoadImg(image, serverDir) {
  if (!image) return null;
  // 1) URL absoluta
  if (image.startsWith('http')) {
    try { return await loadImage(image); } catch { return null; }
  }
  // 2) Archivo local en el server (más rápido y sin depender de la red)
  try {
    const rel = image.replace(/^\/+/, '');
    const local = path.join(serverDir, rel);
    if (fs.existsSync(local)) return await loadImage(local);
  } catch { /* sigue */ }
  // 3) Fallback: vía URL pública
  try {
    return await loadImage(`${BASE_URL}${image.startsWith('/') ? '' : '/'}${image}`);
  } catch { return null; }
}

// Envuelve el texto en como mucho `maxLines` líneas, con "…" al final si sobra.
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) { i++; break; }
    }
  }
  if (line) lines.push(line);
  // ¿Quedaron palabras fuera? Recortar la última línea y agregar elipsis.
  const truncated = i < words.length;
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  return lines.slice(0, maxLines);
}

/**
 * @param {Object} opts
 * @param {Array}  opts.products   productos (se usan los primeros 12)
 * @param {Object} opts.store      { name, currency_symbol, hide_decimals }
 * @param {'landscape'|'portrait'} opts.orientation
 * @param {string} opts.serverDir  dir del server para resolver imágenes locales
 * @returns {Promise<Buffer>} PNG
 */
export async function generateMenuImage({ products, store, orientation, serverDir }) {
  const landscape = orientation !== 'portrait';
  const W = landscape ? 1920 : 1080;
  const H = landscape ? 1080 : 1920;
  const cols = landscape ? 6 : 3;
  const rows = landscape ? 2 : 4;
  const perPage = cols * rows; // 12

  const list = (products || []).slice(0, perPage);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fondo crema
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  const symbol = store?.currency_symbol || '$';
  const hideDecimals = store?.hide_decimals;
  const formatPrice = (v) => {
    const n = Number(v || 0);
    if (hideDecimals || Number.isInteger(n)) return Math.round(n).toLocaleString('es-CL');
    return n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const PAD = Math.round(W * 0.025);
  const GAP = Math.round(W * 0.014);
  const gridW = W - PAD * 2;
  const gridH = H - PAD * 2;
  const cardW = (gridW - GAP * (cols - 1)) / cols;
  const cardH = (gridH - GAP * (rows - 1)) / rows;

  const nameFont = Math.round(cardW * 0.085);
  const priceFont = Math.round(cardW * 0.11);
  const innerPad = Math.round(cardW * 0.06);

  // Precargar imágenes en paralelo
  const imgs = await Promise.all(list.map(p => tryLoadImg(p.image, serverDir)));

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cardW + GAP);
    const y = PAD + row * (cardH + GAP);
    const radius = Math.round(cardW * 0.07);

    // Sombra + tarjeta blanca
    ctx.save();
    ctx.shadowColor = 'rgba(60,45,20,0.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    rr(ctx, x, y, cardW, cardH, radius);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.restore();

    // Zona de texto (nombre 2 líneas + precio) reservada abajo
    const textBlockH = nameFont * 2 * 1.25 + priceFont * 1.3 + innerPad;
    const imgAreaX = x + innerPad;
    const imgAreaY = y + innerPad;
    const imgAreaW = cardW - innerPad * 2;
    const imgAreaH = cardH - textBlockH - innerPad;

    const img = imgs[i];
    if (img) {
      // object-fit: contain
      const scale = Math.min(imgAreaW / img.width, imgAreaH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = imgAreaX + (imgAreaW - dw) / 2;
      const dy = imgAreaY + (imgAreaH - dh) / 2;
      ctx.save();
      rr(ctx, imgAreaX, imgAreaY, imgAreaW, imgAreaH, Math.round(radius * 0.7));
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } else {
      // Placeholder gris con inicial
      ctx.save();
      rr(ctx, imgAreaX, imgAreaY, imgAreaW, imgAreaH, Math.round(radius * 0.7));
      ctx.fillStyle = '#f1ece1';
      ctx.fill();
      ctx.fillStyle = BORDER;
      ctx.font = `800 ${Math.round(imgAreaH * 0.4)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((p.name || '?').charAt(0).toUpperCase(), imgAreaX + imgAreaW / 2, imgAreaY + imgAreaH / 2);
      ctx.restore();
    }

    // Nombre (máx 2 líneas, izquierda)
    ctx.fillStyle = DARK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${nameFont}px Arial, sans-serif`;
    const nameLines = wrapText(ctx, p.name, imgAreaW, 2);
    let ty = y + cardH - textBlockH + nameFont + innerPad * 0.3;
    for (const ln of nameLines) {
      ctx.fillText(ln, imgAreaX, ty);
      ty += nameFont * 1.25;
    }

    // Precio (abajo, bold, oscuro)
    ctx.font = `800 ${priceFont}px Arial, sans-serif`;
    ctx.fillStyle = DARK;
    ctx.fillText(`${symbol}${formatPrice(p.price)}`, imgAreaX, y + cardH - innerPad * 0.9);
  }

  return canvas.toBuffer('image/png');
}
