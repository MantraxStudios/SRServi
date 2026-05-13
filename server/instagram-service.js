import { createCanvas, loadImage } from '@napi-rs/canvas';

const S = 1080;
const BASE_URL = 'https://srservi2.srautomatic.com';

// ─── helpers ──────────────────────────────────────────────────────────────────

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function trunc(str, max) {
  return str && str.length > max ? str.slice(0, max - 1) + '…' : (str || '');
}

async function tryLoadImg(url) {
  if (!url) return null;
  try {
    const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    return await loadImage(full);
  } catch { return null; }
}

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex, a) {
  try { const { r, g, b } = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  catch { return `rgba(212,175,55,${a})`; }
}

// Returns black or white depending on which has better contrast against hex
function contrastColor(hex) {
  try {
    const { r, g, b } = hex2rgb(hex);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#111111' : '#ffffff';
  } catch { return '#ffffff'; }
}

function drawCircle(ctx, cx, cy, radius, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draw store logo as circle. cx/cy = center.
async function drawLogo(ctx, store, cx, cy, size, ringColor, bgColor) {
  const name = store.name || store.store_name || '?';
  const img  = store.logo_url ? await tryLoadImg(store.logo_url) : null;
  const r    = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, size, size);
  } else {
    ctx.fillStyle = ringColor;
    ctx.fillRect(cx - r, cy - r, size, size);
    ctx.fillStyle = bgColor || contrastColor(ringColor);
    ctx.font = `bold ${Math.floor(size * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name[0] || '?').toUpperCase(), cx, cy);
  }
  ctx.restore();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// Cover-fit an image inside a rounded rect
async function coverImg(ctx, product, x, y, w, h, radius = 18) {
  const img = await tryLoadImg(product?.image);
  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  if (img) {
    const aspect = img.width / img.height;
    let dw = w, dh = h;
    if (aspect > w / h) { dh = h; dw = dh * aspect; }
    else { dw = w; dh = dw / aspect; }
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.font = `${Math.floor(Math.min(w, h) * 0.32)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillText('🍽', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

// Price pill
function drawPricePill(ctx, text, cx, cy, font, bg, fg) {
  ctx.font = font;
  const m  = ctx.measureText(text);
  const pw = m.width + 36, ph = 54;
  ctx.fillStyle = bg;
  rr(ctx, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// Thin corner brackets (like premium package corners)
function drawCornerBrackets(ctx, x, y, w, h, len, thick, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = 'square';
  const corners = [
    [[x, y + len], [x, y], [x + len, y]],
    [[x + w - len, y], [x + w, y], [x + w, y + len]],
    [[x + w, y + h - len], [x + w, y + h], [x + w - len, y + h]],
    [[x + len, y + h], [x, y + h], [x, y + h - len]],
  ];
  for (const pts of corners) {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.stroke();
  }
}

// ─── Template 0 — PODIO  (white ranking) ─────────────────────────────────────

async function tpl0_podio(ctx, store, products, coupons, sym, accent, primary) {
  const prods = (products || []).slice(0, 3);
  const name  = store.name || store.store_name || 'Mi Tienda';
  const code  = store.code || store.store_code || '';

  // White background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  // Subtle dot texture
  ctx.save(); ctx.globalAlpha = 0.03;
  for (let x = 20; x < S; x += 40)
    for (let y = 20; y < S; y += 40) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();

  drawCircle(ctx, S - 80, 80, 340, accent, 0.06);
  drawCircle(ctx, 80, S - 80, 260, accent, 0.04);

  const topBar = ctx.createLinearGradient(0, 0, S, 0);
  topBar.addColorStop(0, accent);
  topBar.addColorStop(1, 'transparent');
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, S, 8);

  await drawLogo(ctx, store, S / 2, 86, 100, accent, contrastColor(accent));
  ctx.fillStyle = '#111111'; ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 22), S / 2, 208);

  ctx.fillStyle = accent;
  rr(ctx, S / 2 - 210, 226, 420, 44, 22); ctx.fill();
  ctx.fillStyle = contrastColor(accent);
  ctx.font = 'bold 21px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText('🔥  LO MÁS PEDIDO ESTA SEMANA', S / 2, 248);

  const medals = [accent, '#C0C0C0', '#CD7F32'];
  const cards  = [
    { x: 40, y: 294, w: S - 80, h: 200 },
    { x: 40, y: 512, w: S - 80, h: 158 },
    { x: 40, y: 688, w: S - 80, h: 158 },
  ];

  for (let i = 0; i < prods.length; i++) {
    const p = prods[i];
    const { x, y, w, h } = cards[i];
    ctx.save();
    ctx.shadowColor = i === 0 ? rgba(accent, 0.3) : 'rgba(0,0,0,0.1)';
    ctx.shadowBlur  = i === 0 ? 24 : 12;
    ctx.fillStyle   = i === 0 ? rgba(accent, 0.08) : '#f8f8f8';
    rr(ctx, x, y, w, h, 20); ctx.fill(); ctx.restore();
    ctx.strokeStyle = i === 0 ? rgba(accent, 0.6) : '#e5e7eb';
    ctx.lineWidth   = i === 0 ? 2 : 1;
    rr(ctx, x, y, w, h, 20); ctx.stroke();

    const stripW = 62;
    ctx.save(); rr(ctx, x, y, stripW, h, 20); ctx.clip();
    ctx.fillStyle = medals[i]; ctx.globalAlpha = i === 0 ? 1 : 0.85;
    ctx.fillRect(x, y, stripW, h); ctx.restore();
    ctx.fillStyle = contrastColor(medals[i]);
    ctx.font = `bold ${i === 0 ? 30 : 24}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`0${i + 1}`, x + stripW / 2, y + h / 2);

    const imgSz = h - 20;
    await coverImg(ctx, p, x + stripW + 10, y + 10, imgSz, imgSz, 12);

    const tx = x + stripW + imgSz + 22;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111111'; ctx.font = `bold ${i === 0 ? 31 : 25}px sans-serif`;
    ctx.fillText(trunc(p.name, 24), tx, y + (i === 0 ? 54 : 43));
    if (p.description) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = `${i === 0 ? 19 : 16}px sans-serif`;
      ctx.fillText(trunc(p.description, 34), tx, y + (i === 0 ? 82 : 67));
    }
    const price = `${sym}${Number(p.price).toLocaleString('es-CL')}`;
    ctx.font = `bold ${i === 0 ? 36 : 29}px sans-serif`;
    const pm = ctx.measureText(price);
    const pw = pm.width + 22, ph2 = i === 0 ? 48 : 38;
    const py2 = y + h - (i === 0 ? 60 : 50);
    ctx.fillStyle = accent; rr(ctx, tx, py2, pw, ph2, ph2 / 2); ctx.fill();
    ctx.fillStyle = contrastColor(accent); ctx.textBaseline = 'middle';
    ctx.fillText(price, tx + 11, py2 + ph2 / 2);
  }

  ctx.fillStyle = accent; ctx.fillRect(0, S - 8, S, 8);
  ctx.fillStyle = '#888888'; ctx.font = '18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, S - 36);
}

// ─── Template 1 — NEON DEALS  (white promo / grid) ───────────────────────────

async function tpl1_deals(ctx, store, products, coupons, sym, accent, primary) {
  const name   = store.name || store.store_name || 'Mi Tienda';
  const code   = store.code || store.store_code || '';
  const active = (coupons || []).filter(c => c.is_active).slice(0, 2);

  // White background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  // Subtle dot texture
  ctx.save(); ctx.globalAlpha = 0.03;
  for (let x = 20; x < S; x += 40)
    for (let y = 20; y < S; y += 40) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();

  drawCircle(ctx, S / 2, S / 2, 460, accent, 0.05);
  drawCircle(ctx, 100, 200,  280, accent, 0.03);
  drawCircle(ctx, S - 100, S - 200, 300, accent, 0.03);

  const topG = ctx.createLinearGradient(0, 0, S, 0);
  topG.addColorStop(0, 'transparent'); topG.addColorStop(0.5, accent); topG.addColorStop(1, 'transparent');
  ctx.fillStyle = topG; ctx.fillRect(0, 0, S, 10);

  await drawLogo(ctx, store, S / 2, 86, 96, accent, contrastColor(accent));
  ctx.fillStyle = '#111111'; ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 22), S / 2, 206);
  ctx.fillStyle = accent; ctx.font = 'bold 25px sans-serif';
  ctx.fillText(active.length > 0 ? '🎉  OFERTAS EXCLUSIVAS' : '✨  NUESTROS FAVORITOS', S / 2, 250);

  if (active.length > 0) {
    const cardH = active.length === 1 ? 340 : 236;
    const gap = 22, startY = 274;
    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      const y = startY + i * (cardH + gap);
      ctx.save();
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      rr(ctx, 44, y, S - 88, cardH, 24); ctx.stroke(); ctx.restore();
      ctx.fillStyle = rgba(accent, 0.07); rr(ctx, 44, y, S - 88, cardH, 24); ctx.fill();
      ctx.save(); ctx.setLineDash([12, 8]); ctx.strokeStyle = rgba(accent, 0.35); ctx.lineWidth = 1.5;
      rr(ctx, 54, y + 10, S - 108, cardH - 20, 16); ctx.stroke(); ctx.restore();

      const discount = c.discount_type === 'percent' ? `${c.discount_value}%` : `${sym}${c.discount_value}`;
      ctx.fillStyle = accent; ctx.font = `bold ${cardH >= 300 ? 128 : 90}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(discount, S / 2, y + cardH * 0.54);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = 'bold 20px sans-serif';
      ctx.fillText('DE DESCUENTO', S / 2, y + cardH * 0.54 + 28);
      ctx.fillStyle = '#111111'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText(trunc(c.name, 36), S / 2, y + 46);
      const codeText = `CÓDIGO: ${c.code}`;
      ctx.font = 'bold 19px sans-serif';
      const cW = ctx.measureText(codeText).width + 30;
      ctx.fillStyle = '#111'; rr(ctx, S / 2 - cW / 2, y + cardH - 52, cW, 34, 17); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      ctx.fillText(codeText, S / 2, y + cardH - 35);
    }
  } else {
    const prods  = (products || []).slice(0, 4);
    const tileW  = (S - 80 - 16) / 2, tileH = 280, startY = 274;
    for (let i = 0; i < Math.min(prods.length, 4); i++) {
      const p = prods[i], col = i % 2, row = Math.floor(i / 2);
      const tx = 40 + col * (tileW + 16), ty = startY + row * (tileH + 16);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#f8f8f8'; rr(ctx, tx, ty, tileW, tileH, 20); ctx.fill(); ctx.restore();
      ctx.strokeStyle = rgba(accent, 0.4); ctx.lineWidth = 2;
      rr(ctx, tx, ty, tileW, tileH, 20); ctx.stroke();

      await coverImg(ctx, p, tx, ty, tileW, tileH, 20);
      ctx.save(); rr(ctx, tx, ty, tileW, tileH, 20); ctx.clip();
      const ov = ctx.createLinearGradient(0, ty + tileH * 0.5, 0, ty + tileH);
      ov.addColorStop(0, 'rgba(0,0,0,0)'); ov.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = ov; ctx.fillRect(tx, ty, tileW, tileH); ctx.restore();

      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(trunc(p.name, 16), tx + tileW / 2, ty + tileH - 38);
      ctx.fillStyle = accent; ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, tx + tileW / 2, ty + tileH - 10);
    }
  }

  ctx.fillStyle = topG; ctx.fillRect(0, S - 10, S, 10);
  ctx.fillStyle = '#888888'; ctx.font = '17px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, S - 36);
}

// ─── Template 2 — MAGAZINE  (editorial photo grid, white base) ───────────────

async function tpl2_magazine(ctx, store, products, coupons, sym, accent, primary) {
  const prods = (products || []).slice(0, 3);
  const name  = store.name || store.store_name || 'Mi Tienda';
  const code  = store.code || store.store_code || '';
  const onAcc = contrastColor(accent);

  // White background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  const headerH = 130;
  const hg = ctx.createLinearGradient(0, 0, S, 0);
  hg.addColorStop(0, accent); hg.addColorStop(1, rgba(accent, 0.75));
  ctx.fillStyle = hg; ctx.fillRect(0, 0, S, headerH);

  await drawLogo(ctx, store, 66, headerH / 2, 78, onAcc, accent);
  ctx.fillStyle = onAcc; ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(trunc(name, 20), 124, headerH / 2 - 10);
  ctx.globalAlpha = 0.7; ctx.font = '19px sans-serif';
  ctx.fillText(`${BASE_URL}/store/${code}`, 124, headerH / 2 + 26); ctx.globalAlpha = 1;

  const heroH = 468, heroY = headerH + 14;
  if (prods[0]) {
    await coverImg(ctx, prods[0], 14, heroY, S - 28, heroH, 24);
    ctx.save(); rr(ctx, 14, heroY, S - 28, heroH, 24); ctx.clip();
    const ov = ctx.createLinearGradient(0, heroY + heroH * 0.38, 0, heroY + heroH);
    ov.addColorStop(0, 'rgba(0,0,0,0)'); ov.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = ov; ctx.fillRect(14, heroY, S - 28, heroH); ctx.restore();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 43px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(prods[0].name, 26), 40, heroY + heroH - 58);
    const price = `${sym}${Number(prods[0].price).toLocaleString('es-CL')}`;
    ctx.font = 'bold 28px sans-serif';
    const pm = ctx.measureText(price);
    const pW = pm.width + 28, pH = 46;
    ctx.fillStyle = accent; rr(ctx, 40, heroY + heroH - 48, pW, pH, pH / 2); ctx.fill();
    ctx.fillStyle = onAcc; ctx.textBaseline = 'middle';
    ctx.fillText(price, 40 + 14, heroY + heroH - 48 + pH / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const bdgW = 138, bdgH = 30;
    rr(ctx, S - 28 - bdgW - 2, heroY + 16, bdgW, bdgH, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐ DESTACADO', S - 28 - bdgW / 2 - 2, heroY + 16 + bdgH / 2);
  }

  const tileY = heroY + heroH + 14;
  const tileH2 = S - tileY - 60, tileW2 = (S - 28 - 14) / 2;
  for (let i = 1; i <= 2; i++) {
    const p = prods[i]; if (!p) continue;
    const tx = 14 + (i - 1) * (tileW2 + 14), ty = tileY;
    await coverImg(ctx, p, tx, ty, tileW2, tileH2, 20);
    ctx.save(); rr(ctx, tx, ty, tileW2, tileH2, 20); ctx.clip();
    const ov2 = ctx.createLinearGradient(0, ty + tileH2 * 0.44, 0, ty + tileH2);
    ov2.addColorStop(0, 'rgba(0,0,0,0)'); ov2.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = ov2; ctx.fillRect(tx, ty, tileW2, tileH2); ctx.restore();
    ctx.strokeStyle = rgba(accent, 0.4); ctx.lineWidth = 1.5;
    rr(ctx, tx, ty, tileW2, tileH2, 20); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 25px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(p.name, 18), tx + tileW2 / 2, ty + tileH2 - 36);
    ctx.fillStyle = accent; ctx.font = 'bold 27px sans-serif';
    ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, tx + tileW2 / 2, ty + tileH2 - 8);
  }

  ctx.fillStyle = '#999999'; ctx.font = '16px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Powered by SRAutomatic.cl', S / 2, S - 20);
}

// ─── Template 3 — WHITE CLEAN  (fast food / McDonald's style) ────────────────

async function tpl3_white(ctx, store, products, coupons, sym, accent, primary) {
  const prods  = (products || []).slice(0, 3);
  const name   = store.name || store.store_name || 'Mi Tienda';
  const code   = store.code || store.store_code || '';
  const onAcc  = contrastColor(accent);

  // Pure white bg
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  // Very subtle dot pattern
  ctx.save(); ctx.globalAlpha = 0.03;
  for (let x = 20; x < S; x += 40)
    for (let y = 20; y < S; y += 40) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();

  // Accent header bar
  ctx.fillStyle = accent; ctx.fillRect(0, 0, S, 90);

  // Logo in header
  await drawLogo(ctx, store, 62, 45, 68, onAcc, accent);

  // Store name in header
  ctx.fillStyle = onAcc; ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(trunc(name, 18), 114, 34);
  ctx.globalAlpha = 0.75; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('★ Lo más pedido esta semana ★', 114, 62); ctx.globalAlpha = 1;

  // Hero product
  if (prods[0]) {
    const heroSz = 440, heroX = (S - heroSz) / 2, heroY = 112;

    // Card shadow
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.13)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#f4f4f4'; rr(ctx, heroX, heroY, heroSz, heroSz, 28); ctx.fill(); ctx.restore();

    await coverImg(ctx, prods[0], heroX, heroY, heroSz, heroSz, 28);

    // "DESTACADO" badge
    ctx.fillStyle = accent;
    const bdg = 'N.° 1 🔥'; ctx.font = 'bold 17px sans-serif';
    const bdgW = ctx.measureText(bdg).width + 28, bdgH = 36;
    rr(ctx, heroX + heroSz - bdgW - 12, heroY + 12, bdgW, bdgH, 18); ctx.fill();
    ctx.fillStyle = onAcc; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(bdg, heroX + heroSz - bdgW / 2 - 12, heroY + 12 + bdgH / 2);

    // Product name
    ctx.fillStyle = '#111'; ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(prods[0].name, 22), S / 2, heroY + heroSz + 52);
    if (prods[0].description) {
      ctx.fillStyle = '#666'; ctx.font = '21px sans-serif';
      ctx.fillText(trunc(prods[0].description, 32), S / 2, heroY + heroSz + 80);
    }

    // Price pill
    const price = `${sym}${Number(prods[0].price).toLocaleString('es-CL')}`;
    drawPricePill(ctx, price, S / 2, heroY + heroSz + 116, 'bold 40px sans-serif', accent, onAcc);
  }

  // Thin divider
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(44, 704); ctx.lineTo(S - 44, 704); ctx.stroke();

  // Bottom row: 2 products
  const rowY = 720, tileW = (S - 88 - 16) / 2, tileH = 186;
  for (let i = 1; i <= 2; i++) {
    const p = prods[i]; if (!p) continue;
    const tx = 44 + (i - 1) * (tileW + 16);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.07)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fafafa'; rr(ctx, tx, rowY, tileW, tileH, 18); ctx.fill(); ctx.restore();

    const imgSz = tileH - 16;
    await coverImg(ctx, p, tx + 8, rowY + 8, imgSz, imgSz, 12);
    const textX = tx + imgSz + 16;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(trunc(p.name, 18), textX, rowY + 50);
    if (p.description) {
      ctx.fillStyle = '#888'; ctx.font = '15px sans-serif';
      ctx.fillText(trunc(p.description, 20), textX, rowY + 72);
    }
    ctx.fillStyle = accent; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, textX, rowY + 108);
  }

  // Bottom accent bar + URL
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, S - 56, S, 56);
  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, S - 56); ctx.lineTo(S, S - 56); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(S / 2, S - 28, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = onAcc; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SR', S / 2, S - 28);
  ctx.fillStyle = '#555'; ctx.font = '16px sans-serif';
  ctx.fillText(`${BASE_URL}/store/${code}`, S / 2, S - 56 + 40);
}

// ─── Template 4 — NOIR GOLD  (white luxury / premium) ────────────────────────

async function tpl4_noir(ctx, store, products, coupons, sym, accent, primary) {
  const prods = (products || []).slice(0, 3);
  const name  = store.name || store.store_name || 'Mi Tienda';
  const code  = store.code || store.store_code || '';

  // White background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  // Very subtle texture
  ctx.save(); ctx.globalAlpha = 0.02;
  for (let x = 20; x < S; x += 40)
    for (let y = 20; y < S; y += 40) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();

  // Corner brackets (accent color)
  drawCornerBrackets(ctx, 24, 24, S - 48, S - 48, 60, 2.5, rgba(accent, 0.7));

  // Thin top/bottom accent lines
  ctx.fillStyle = accent; ctx.fillRect(0, 0, S, 3);
  ctx.fillRect(0, S - 3, S, 3);

  // Logo at top center
  await drawLogo(ctx, store, S / 2, 94, 96, accent, contrastColor(accent));

  // Store name
  ctx.fillStyle = '#111111'; ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 20), S / 2, 210);

  // "MENÚ DE LA SEMANA" in small accent
  ctx.fillStyle = rgba(accent, 0.85); ctx.font = '500 20px sans-serif';
  ctx.fillText('— MENÚ DE LA SEMANA —', S / 2, 244);

  // Accent horizontal rule
  ctx.strokeStyle = accent; ctx.lineWidth = 1;
  const ruleY = 262;
  ctx.beginPath(); ctx.moveTo(S / 2 - 160, ruleY); ctx.lineTo(S / 2 + 160, ruleY); ctx.stroke();

  // Hero product — circular with accent ring
  if (prods[0]) {
    const heroR = 198, heroCX = S / 2, heroCY = 480;

    // Soft shadow ring
    ctx.save();
    for (let i = 3; i >= 1; i--) {
      ctx.strokeStyle = rgba(accent, 0.08 * i); ctx.lineWidth = i * 4;
      ctx.beginPath(); ctx.arc(heroCX, heroCY, heroR + 14, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // Accent ring
    ctx.strokeStyle = accent; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(heroCX, heroCY, heroR + 8, 0, Math.PI * 2); ctx.stroke();

    // Circular image clip
    ctx.save();
    ctx.beginPath(); ctx.arc(heroCX, heroCY, heroR, 0, Math.PI * 2); ctx.clip();
    const img = await tryLoadImg(prods[0]?.image);
    if (img) {
      const sz = heroR * 2;
      const aspect = img.width / img.height;
      let dw = sz, dh = sz;
      if (aspect > 1) { dh = sz; dw = dh * aspect; }
      else { dw = sz; dh = dw / aspect; }
      ctx.drawImage(img, heroCX - dw / 2, heroCY - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = rgba(accent, 0.1); ctx.fillRect(heroCX - heroR, heroCY - heroR, heroR * 2, heroR * 2);
      ctx.font = '100px serif'; ctx.fillStyle = rgba(accent, 0.35);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🍽', heroCX, heroCY);
    }
    ctx.restore();

    // Diamond accent top of circle
    ctx.save(); ctx.fillStyle = accent;
    ctx.translate(heroCX, heroCY - heroR - 8); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14); ctx.restore();

    // Product name
    ctx.fillStyle = '#111111'; ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(prods[0].name, 22), S / 2, heroCY + heroR + 58);

    // Price
    ctx.fillStyle = accent; ctx.font = 'bold 52px sans-serif';
    ctx.fillText(`${sym}${Number(prods[0].price).toLocaleString('es-CL')}`, S / 2, heroCY + heroR + 122);

    // Accent rule below price
    ctx.strokeStyle = rgba(accent, 0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(S / 2 - 200, heroCY + heroR + 140); ctx.lineTo(S / 2 + 200, heroCY + heroR + 140); ctx.stroke();
  }

  // Two small secondary products at bottom
  const secY = 950, secH = 80, secW = (S - 88 - 16) / 2;
  for (let i = 1; i <= 2; i++) {
    const p = prods[i]; if (!p) continue;
    const tx = 44 + (i - 1) * (secW + 16);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#f8f8f8'; rr(ctx, tx, secY, secW, secH, 12); ctx.fill(); ctx.restore();
    ctx.strokeStyle = rgba(accent, 0.4); ctx.lineWidth = 1.5;
    rr(ctx, tx, secY, secW, secH, 12); ctx.stroke();
    const imgSz = secH - 12;
    await coverImg(ctx, p, tx + 6, secY + 6, imgSz, imgSz, 8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111111'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(trunc(p.name, 18), tx + imgSz + 12, secY + 34);
    ctx.fillStyle = accent; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, tx + imgSz + 12, secY + 60);
  }

  // Footer
  ctx.fillStyle = '#888888'; ctx.font = '17px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, S - 24);
}

// ─── Template 5 — BOLD SPLIT  (white poster with accent diagonal) ─────────────

async function tpl5_split(ctx, store, products, coupons, sym, accent, primary) {
  const prods  = (products || []).slice(0, 3);
  const name   = store.name || store.store_name || 'Mi Tienda';
  const code   = store.code || store.store_code || '';
  const onAcc  = contrastColor(accent);
  const splitY = 420;

  // White background throughout
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);

  // Light gray top section
  ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, S, splitY);

  // Subtle dot texture on top section
  ctx.save(); ctx.globalAlpha = 0.04;
  for (let x = 20; x < splitY; x += 40)
    for (let y = 20; y < splitY; y += 40) {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  ctx.restore();

  // Diagonal accent cut
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, splitY - 30);
  ctx.lineTo(S, splitY + 30);
  ctx.lineTo(S, splitY + 30 + 16);
  ctx.lineTo(0, splitY - 30 + 16);
  ctx.closePath();
  ctx.fill();

  // Decorative accent circles on top section
  drawCircle(ctx, S - 60, 60, 220, accent, 0.06);
  drawCircle(ctx, 60,  splitY - 40, 160, accent, 0.05);

  // ── Top (light) section
  await drawLogo(ctx, store, 70, 64, 84, accent, contrastColor(accent));

  ctx.fillStyle = '#111111'; ctx.font = 'bold 62px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 14), 138, 72);
  ctx.fillStyle = rgba(accent, 0.85); ctx.font = '500 22px sans-serif';
  ctx.fillText('Lo mejor de la semana 👇', 138, 102);

  // Big product card on top section
  if (prods[0]) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff'; rr(ctx, 44, 130, S - 88, 230, 20); ctx.fill(); ctx.restore();
    ctx.strokeStyle = rgba(accent, 0.25); ctx.lineWidth = 1.5;
    rr(ctx, 44, 130, S - 88, 230, 20); ctx.stroke();

    const heroImgSz = 206;
    await coverImg(ctx, prods[0], 60, 142, heroImgSz, heroImgSz, 16);

    const textX = 60 + heroImgSz + 22;
    ctx.fillStyle = '#111111'; ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(prods[0].name, 18), textX, 195);
    if (prods[0].description) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = '19px sans-serif';
      ctx.fillText(trunc(prods[0].description, 28), textX, 224);
    }
    const price = `${sym}${Number(prods[0].price).toLocaleString('es-CL')}`;
    drawPricePill(ctx, price, textX + 80, 308, 'bold 38px sans-serif', accent, onAcc);
  }

  // ── White section (below split accent line)
  const whiteStart = splitY + 46;

  ctx.fillStyle = '#111'; ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('TAMBIÉN TE VA A GUSTAR', S / 2, whiteStart + 34);
  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(44, whiteStart + 48); ctx.lineTo(S - 44, whiteStart + 48); ctx.stroke();

  // 2 secondary products on white
  const tileW = (S - 88 - 16) / 2, tileH = 200;
  const tilesY = whiteStart + 62;
  for (let i = 1; i <= 2; i++) {
    const p = prods[i]; if (!p) continue;
    const tx = 44 + (i - 1) * (tileW + 16);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fafafa'; rr(ctx, tx, tilesY, tileW, tileH, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1;
    rr(ctx, tx, tilesY, tileW, tileH, 16); ctx.stroke();

    const imgSz = tileH - 14;
    await coverImg(ctx, p, tx + 7, tilesY + 7, imgSz, imgSz, 12);
    const textX = tx + imgSz + 14;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(trunc(p.name, 17), textX, tilesY + 52);
    if (p.description) {
      ctx.fillStyle = '#888'; ctx.font = '15px sans-serif';
      ctx.fillText(trunc(p.description, 20), textX, tilesY + 74);
    }
    ctx.fillStyle = accent; ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, textX, tilesY + 110);
  }

  // Footer
  const footY = tilesY + tileH + 30;
  ctx.fillStyle = accent; ctx.fillRect(0, footY, S, 6);
  ctx.fillStyle = '#555'; ctx.font = '16px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, footY + 28);
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function generatePromoImage({ store, topProducts, coupons, templateCounter, currencySymbol }) {
  const canvas = createCanvas(S, S);
  const ctx    = canvas.getContext('2d');

  const primary = store.primary_color || '#000000';
  const accent  = store.accent_color  || '#D4AF37';
  const sym     = currencySymbol || '$';
  const tpl     = (templateCounter || 0) % 6;

  if      (tpl === 0) await tpl0_podio(ctx, store, topProducts, coupons, sym, accent, primary);
  else if (tpl === 1) await tpl1_deals(ctx, store, topProducts, coupons, sym, accent, primary);
  else if (tpl === 2) await tpl2_magazine(ctx, store, topProducts, coupons, sym, accent, primary);
  else if (tpl === 3) await tpl3_white(ctx, store, topProducts, coupons, sym, accent, primary);
  else if (tpl === 4) await tpl4_noir(ctx, store, topProducts, coupons, sym, accent, primary);
  else                await tpl5_split(ctx, store, topProducts, coupons, sym, accent, primary);

  return canvas.toBuffer('image/jpeg', { quality: 92 });
}

// ─── Instagram auth helpers ───────────────────────────────────────────────────

async function buildIg(username) {
  const { IgApiClient } = await import('instagram-private-api');
  const ig = new IgApiClient();
  ig.state.generateDevice(username);
  return ig;
}

async function serializeIg(ig) {
  try {
    const s = await ig.state.serialize();
    delete s.constants;
    return JSON.stringify(s);
  } catch { return '{}'; }
}

// Detect Instagram error type by name (instanceof fails with dynamic imports)
function igErrorType(e) {
  const name = e.name || e.constructor?.name || '';
  const body = e.response?.body || {};
  const msg  = body.message || body.error_type || '';

  if (
    name === 'IgLoginTwoFactorRequiredError' ||
    body.two_factor_required ||
    body.two_factor_info
  ) return 'twoFactor';

  if (
    name === 'IgCheckpointError' ||
    body.checkpoint_url ||
    msg === 'checkpoint_required' ||
    msg.includes('checkpoint')
  ) return 'challenge';

  return null;
}

// Start login. Returns:
//   { ok: true, igState }                       — success
//   { needsTwoFactor: true, info, igState }      — TOTP / SMS 2FA needed
//   { needsChallenge: true, hint, igState }      — checkpoint / 401 / rate-limit
export async function startInstagramLogin(username, password, verificationCode = '') {
  const ig = await buildIg(username);
  const code = (verificationCode || '').replace(/\s/g, '');

  // preLoginFlow makes optional warm-up requests — skip if Instagram rejects them
  try { await ig.simulate.preLoginFlow(); } catch (_) {}

  let loginErr = null;
  try {
    await ig.account.login(username, password);
    try { await ig.simulate.postLoginFlow(); } catch (_) {}
    return { ok: true, igState: await serializeIg(ig) };
  } catch (e) { loginErr = e; }

  const type = igErrorType(loginErr);
  const body = loginErr.response?.body || {};
  const msg  = loginErr.message || body.message || '';

  if (type === 'twoFactor') {
    if (code) {
      const info = body.two_factor_info || {};
      await ig.account.twoFactorLogin({
        username,
        verificationCode: code,
        twoFactorIdentifier: info.two_factor_identifier,
        verificationMethod: '0',
        trustThisDevice: '1',
      });
      try { await ig.simulate.postLoginFlow(); } catch (_) {}
      return { ok: true, igState: await serializeIg(ig) };
    }
    return { needsTwoFactor: true, info: body.two_factor_info || {}, igState: await serializeIg(ig) };
  }

  if (type === 'challenge') {
    try { await ig.challenge.auto(true); } catch (_) {}
    if (code) {
      await ig.challenge.sendSecurityCode(code);
      try { await ig.simulate.postLoginFlow(); } catch (_) {}
      return { ok: true, igState: await serializeIg(ig) };
    }
    return { needsChallenge: true, igState: await serializeIg(ig) };
  }

  // For wrong-password errors throw immediately — no point showing a code modal
  const isHardError =
    loginErr.name === 'IgLoginBadPasswordError' ||
    msg.toLowerCase().includes('password') ||
    msg.toLowerCase().includes('invalid user') ||
    msg.toLowerCase().includes('contraseña') ||
    msg.toLowerCase().includes('incorrect');

  if (isHardError) throw new Error(msg || 'Usuario o contraseña incorrectos');

  // Any other error (401, rate-limit, qe/sync blocked, etc.) → show verification modal
  // so the user can enter a code if Instagram sent one
  try { await ig.challenge.auto(true); } catch (_) {}
  return { needsChallenge: true, hint: msg || 'Instagram requiere verificación', igState: await serializeIg(ig) };
}

// Complete TOTP / SMS two-factor login
export async function completeInstagramTwoFactor(igState, { username, identifier, code, verificationMethod = '0' }) {
  const ig = await buildIg(username);
  await ig.state.deserialize(JSON.parse(igState));
  await ig.account.twoFactorLogin({
    username,
    verificationCode: code.replace(/\s/g, ''),
    twoFactorIdentifier: identifier,
    verificationMethod,
    trustThisDevice: '1',
  });
  try { await ig.simulate.postLoginFlow(); } catch (_) {}
  return { ok: true, igState: await serializeIg(ig) };
}

// Complete checkpoint / challenge verification
export async function completeInstagramChallenge(igState, code, username) {
  const { IgApiClient } = await import('instagram-private-api');
  const ig = new IgApiClient();
  const parsed = JSON.parse(igState);
  await ig.state.deserialize(parsed);
  const cleanCode = (code || '').replace(/\s/g, '');
  try {
    await ig.challenge.sendSecurityCode(cleanCode);
  } catch (err) {
    if (err.message?.includes('No checkpoint data') || err.message?.includes('no_checkpoint')) {
      // No real checkpoint URL in state — Instagram may have needed a TOTP/SMS code before login.
      // Try submitting the code via the two-factor path as a fallback.
      const uname = username || parsed?.account?.username || '';
      if (!uname) throw new Error('Instagram no envió un código de verificación. Esperá unos minutos e intentá conectar de nuevo.');
      try {
        await ig.account.twoFactorLogin({
          username: uname,
          verificationCode: cleanCode,
          twoFactorIdentifier: '',
          verificationMethod: '0',
          trustThisDevice: '1',
        });
      } catch (_) {
        throw new Error('Código inválido o ya expirado. Esperá unos minutos e intentá conectar de nuevo.');
      }
    } else {
      throw err;
    }
  }
  try { await ig.simulate.postLoginFlow(); } catch (_) {}
  return { ok: true, igState: await serializeIg(ig) };
}

// Post a photo. Prefers saved igSession; falls back to fresh login (no 2FA support).
export async function postToInstagram({ username, password, imageBuffer, caption, igSession }) {
  const ig = await buildIg(username);
  if (igSession) {
    try {
      await ig.state.deserialize(JSON.parse(igSession));
    } catch (_) {
      igSession = null;
    }
  }
  if (!igSession) {
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    await ig.simulate.postLoginFlow();
  }
  await ig.publish.photo({ file: imageBuffer, caption });
  return { igState: await serializeIg(ig) };
}
