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
  // 2) Archivo local: probar varias rutas (el cwd del proceso puede no coincidir
  //    con la carpeta del server según cómo se levante — pm2, systemd, etc.).
  const rel = image.replace(/^\/+/, '');
  const candidates = [
    path.join(serverDir, rel),
    path.join(process.cwd(), rel),
    path.isAbsolute(image) ? image : null,
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return await loadImage(p); } catch { /* sigue */ }
  }
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
  // Columnas fijas por orientación; filas adaptativas para llenar todo el alto.
  //   Landscape: 6 columnas (6 arriba / 6 abajo con 12 productos).
  //   Portrait: 2 columnas → los productos se apilan hacia abajo (hasta 6 filas).
  const cols = landscape ? 6 : 2;
  const list = (products || []).slice(0, 12);
  const n = list.length;
  const rows = Math.max(1, Math.ceil(n / cols));

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

  const PAD = Math.round(Math.min(W, H) * 0.03);
  const GAP = Math.round(Math.min(W, H) * 0.018);
  const gridW = W - PAD * 2;
  const gridH = H - PAD * 2;
  const cardW = (gridW - GAP * (cols - 1)) / cols;
  const cardH = (gridH - GAP * (rows - 1)) / rows;

  // Tarjeta horizontal (imagen a la izquierda) si es ancha y baja; si no, vertical.
  const horizontal = cardW / cardH > 1.35;
  const radius = Math.round(Math.min(cardW, cardH) * 0.09);

  // Precargar imágenes en paralelo
  const imgs = await Promise.all(list.map(p => tryLoadImg(p.image, serverDir)));

  // object-fit: cover dentro de un rectángulo redondeado
  const drawCover = (img, ax, ay, aw, ah, r, name) => {
    ctx.save();
    rr(ctx, ax, ay, aw, ah, r);
    ctx.clip();
    if (img) {
      const scale = Math.max(aw / img.width, ah / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, ax + (aw - dw) / 2, ay + (ah - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#f1ece1';
      ctx.fill();
      ctx.fillStyle = BORDER;
      ctx.font = `800 ${Math.round(Math.min(aw, ah) * 0.5)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((name || '?').charAt(0).toUpperCase(), ax + aw / 2, ay + ah / 2);
    }
    ctx.restore();
  };

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cardW + GAP);
    const y = PAD + row * (cardH + GAP);

    // Sombra + tarjeta blanca
    ctx.save();
    ctx.shadowColor = 'rgba(60,45,20,0.10)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    rr(ctx, x, y, cardW, cardH, radius);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.restore();

    const pad = Math.round(Math.min(cardW, cardH) * 0.07);
    const img = imgs[i];
    ctx.fillStyle = DARK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (horizontal) {
      // Imagen cuadrada a la izquierda (acotada para dejar sitio al texto),
      // nombre + precio a la derecha.
      const imgSize = Math.min(cardH - pad * 2, Math.round(cardW * 0.4));
      const ix = x + pad, iy = y + (cardH - imgSize) / 2;
      drawCover(img, ix, iy, imgSize, imgSize, Math.round(radius * 0.7), p.name);

      const tx = ix + imgSize + pad;
      const tw = x + cardW - pad - tx;
      const nameFont = Math.round(cardH * 0.135);
      let priceFont = Math.round(cardH * 0.17);
      ctx.font = `800 ${nameFont}px Arial, sans-serif`;
      const lines = wrapText(ctx, p.name, tw, 2);
      // Ajustar el precio para que nunca se salga del ancho disponible
      const priceStr = `${symbol}${formatPrice(p.price)}`;
      ctx.font = `800 ${priceFont}px Arial, sans-serif`;
      while (priceFont > 14 && ctx.measureText(priceStr).width > tw) {
        priceFont -= 2; ctx.font = `800 ${priceFont}px Arial, sans-serif`;
      }
      const blockH = lines.length * nameFont * 1.2 + priceFont * 1.4;
      let ty = y + (cardH - blockH) / 2 + nameFont;
      ctx.font = `800 ${nameFont}px Arial, sans-serif`;
      for (const ln of lines) { ctx.fillText(ln, tx, ty); ty += nameFont * 1.2; }
      ctx.font = `800 ${priceFont}px Arial, sans-serif`;
      ctx.fillText(priceStr, tx, ty + priceFont * 0.6);
    } else {
      // Imagen arriba, nombre + precio abajo (estilo tótem)
      const nameFont = Math.round(cardW * 0.085);
      const priceFont = Math.round(cardW * 0.11);
      const textBlockH = nameFont * 2 * 1.25 + priceFont * 1.3 + pad;
      const ix = x + pad, iy = y + pad;
      const iw = cardW - pad * 2;
      const ih = cardH - textBlockH - pad;
      drawCover(img, ix, iy, iw, ih, Math.round(radius * 0.7), p.name);

      ctx.font = `800 ${nameFont}px Arial, sans-serif`;
      const lines = wrapText(ctx, p.name, iw, 2);
      let ty = y + cardH - textBlockH + nameFont + pad * 0.3;
      for (const ln of lines) { ctx.fillText(ln, ix, ty); ty += nameFont * 1.25; }
      ctx.font = `800 ${priceFont}px Arial, sans-serif`;
      ctx.fillText(`${symbol}${formatPrice(p.price)}`, ix, y + cardH - pad * 0.9);
    }
  }

  return canvas.toBuffer('image/png');
}
