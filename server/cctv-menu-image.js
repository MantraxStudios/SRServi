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

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// ── Tema del mes (figuras alusivas) ─────────────────────────────────────────
// Mapa server-side, alineado con client/src/utils/seasonalTheme.js. Se dibuja un
// encabezado con el texto del mes + figuras vectoriales (se renderizan siempre,
// sin depender de fuentes de emoji en el servidor).
function nationalMonth(country) {
  const c = (country || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (c.includes('argentin') || c.includes('peru') || c.includes('colombia')) return 6; // julio
  return 8; // chile / mexico / default → septiembre
}

export function getSeason(now, country) {
  const m = now.getMonth();
  const nat = nationalMonth(country);
  if (m === nat) return { label: '¡Mes de la Patria!', accent: '#da291c', shape: 'star' };
  switch (m) {
    case 0:  return { label: '¡Mes de vacaciones!',      accent: '#ffb703', shape: 'sun' };
    case 1:  return { label: '¡Mes del amor!',           accent: '#ff5d8f', shape: 'heart' };
    case 3:  return { label: '¡Otoño!',                  accent: '#e07a1f', shape: 'leaf' };
    case 4:  return { label: '¡Mes de la Madre!',        accent: '#ff70a6', shape: 'flower' };
    case 5:  return { label: '¡Mes del Padre!',          accent: '#457b9d', shape: 'star' };
    case 6:  return { label: '¡Vacaciones de invierno!', accent: '#38bdf8', shape: 'snow' };
    case 7:  return { label: '¡Mes del Niño!',           accent: '#f72585', shape: 'balloon' };
    case 9:  return { label: '¡Mes del terror!',         accent: '#ff7518', shape: 'ghost' };
    case 10: return { label: '¡Primavera!',              accent: '#ff70a6', shape: 'flower' };
    case 11: return { label: '¡Feliz Navidad!',          accent: '#c1121f', shape: 'tree' };
    default: return { label: '', accent: '#D4AF37', shape: 'star' };
  }
}

// Dibuja una figura vectorial centrada en (cx, cy) de tamaño s, en color dado.
export function drawShape(ctx, shape, cx, cy, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.translate(cx, cy);
  const r = s / 2;
  switch (shape) {
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.75);
      ctx.bezierCurveTo(r * 1.4, -r * 0.2, r * 0.5, -r * 1.1, 0, -r * 0.35);
      ctx.bezierCurveTo(-r * 0.5, -r * 1.1, -r * 1.4, -r * 0.2, 0, r * 0.75);
      ctx.fill();
      break;
    }
    case 'snow': {
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r);
        ctx.stroke();
        ctx.rotate(Math.PI / 3);
      }
      break;
    }
    case 'flower': {
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(Math.PI / 3);
      }
      ctx.beginPath(); ctx.fillStyle = '#ffd166'; ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'sun': {
      ctx.lineWidth = Math.max(2, s * 0.08);
      for (let k = 0; k < 8; k++) {
        ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, -r); ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'balloon': {
      ctx.beginPath(); ctx.ellipse(0, -r * 0.15, r * 0.6, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.moveTo(0, r * 0.6); ctx.lineTo(0, r); ctx.stroke();
      break;
    }
    case 'ghost': {
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.6, Math.PI, 0);
      ctx.lineTo(r * 0.6, r * 0.7);
      ctx.lineTo(r * 0.3, r * 0.45); ctx.lineTo(0, r * 0.7);
      ctx.lineTo(-r * 0.3, r * 0.45); ctx.lineTo(-r * 0.6, r * 0.7);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'tree': {
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, r * 0.5); ctx.lineTo(-r * 0.7, r * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(-r * 0.12, r * 0.5, r * 0.24, r * 0.35);
      break;
    }
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r, -r * 0.4, r, r * 0.4, 0, r);
      ctx.bezierCurveTo(-r, r * 0.4, -r, -r * 0.4, 0, -r);
      ctx.fill();
      break;
    }
    case 'star':
    default: {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (Math.PI / 5) * (2 * k) - Math.PI / 2;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export async function tryLoadImg(image, serverDir) {
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
 * @param {Array}  opts.products   productos de ESTA página (ya paginados)
 * @param {Object} opts.store      { name, currency_symbol, hide_decimals, country }
 * @param {'landscape'|'portrait'} opts.orientation
 * @param {string} opts.serverDir  dir del server para resolver imágenes locales
 * @param {number} [opts.page]        índice de página (0-based) para el indicador
 * @param {number} [opts.totalPages]  total de páginas para el indicador "1/3"
 * @returns {Promise<Buffer>} PNG
 */
export async function generateMenuImage({ products, store, orientation, serverDir, page = 0, totalPages = 1 }) {
  const landscape = orientation !== 'portrait';
  const W = landscape ? 1920 : 1080;
  const H = landscape ? 1080 : 1920;
  // Columnas fijas por orientación; filas adaptativas para llenar todo el alto.
  const cols = landscape ? 6 : 2;
  const list = products || [];
  const n = list.length;
  const rows = Math.max(1, Math.ceil(n / cols));

  const season = getSeason(new Date(), store?.country);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fondo crema
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Figuras del mes dispersas de fondo (tenues, detrás de las tarjetas)
  if (season && season.label) {
    const count = landscape ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const fx = ((i * 61 + 23) % 100) / 100 * W;
      const fy = ((i * 37 + 11) % 100) / 100 * H;
      const fs = Math.min(W, H) * (0.05 + ((i * 13) % 5) / 100);
      ctx.globalAlpha = 0.08;
      drawShape(ctx, season.shape, fx, fy, fs, season.accent);
    }
    ctx.globalAlpha = 1;
  }

  const symbol = store?.currency_symbol || '$';
  const hideDecimals = store?.hide_decimals;
  const formatPrice = (v) => {
    const n = Number(v || 0);
    if (hideDecimals || Number.isInteger(n)) return Math.round(n).toLocaleString('es-CL');
    return n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const PAD = Math.round(Math.min(W, H) * 0.03);
  const GAP = Math.round(Math.min(W, H) * 0.018);

  // Encabezado con el "mes" (si hay temporada) + indicador de página
  const headerH = (season && season.label) ? Math.round(H * 0.085) : 0;
  if (headerH) {
    const hy = PAD;
    const barH = Math.round(headerH * 0.9);
    // Píldora con el texto del mes
    ctx.save();
    const labelFont = Math.round(barH * 0.44);
    ctx.font = `800 ${labelFont}px Arial, sans-serif`;
    const tw = ctx.measureText(season.label).width;
    const iconS = barH * 0.55;
    const pillPad = barH * 0.5;
    const pillW = tw + iconS + pillPad * 2.4;
    const pillX = (W - pillW) / 2;
    rr(ctx, pillX, hy, pillW, barH, barH / 2);
    ctx.fillStyle = season.accent;
    ctx.fill();
    drawShape(ctx, season.shape, pillX + pillPad + iconS / 2, hy + barH / 2, iconS, '#ffffff');
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(season.label, pillX + pillPad + iconS + pillPad * 0.4, hy + barH / 2 + labelFont * 0.05);
    // Indicador de página (arriba a la derecha) si hay más de una
    if (totalPages > 1) {
      const pg = `${page + 1}/${totalPages}`;
      ctx.font = `800 ${Math.round(barH * 0.4)}px Arial, sans-serif`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'right';
      ctx.fillText(pg, W - PAD, hy + barH / 2 + barH * 0.02);
    }
    ctx.restore();
  }

  const gridTop = PAD + headerH;
  const gridW = W - PAD * 2;
  const gridH = H - gridTop - PAD;
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
    const y = gridTop + row * (cardH + GAP);

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
