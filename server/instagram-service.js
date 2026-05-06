import { createCanvas, loadImage } from '@napi-rs/canvas';

const S = 1080;
const BASE_URL = 'https://srservi2.srautomatic.com';

// ─── helpers ─────────────────────────────────────────────────────────────────

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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgba(hex, a) {
  const { r, g, b } = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
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

async function drawLogo(ctx, store, cx, cy, size, accent, primary) {
  const name = store.name || store.store_name || '?';
  const img = store.logo_url ? await tryLoadImg(store.logo_url) : null;
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, size, size);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(cx - r, cy - r, size, size);
    ctx.fillStyle = primary;
    ctx.font = `bold ${Math.floor(size * 0.44)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name[0].toUpperCase(), cx, cy);
  }
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

async function drawProductImg(ctx, product, x, y, size) {
  const img = await tryLoadImg(product?.image);
  ctx.save();
  rr(ctx, x, y, size, size, 16);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `${Math.floor(size * 0.35)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍽', x + size / 2, y + size / 2);
  }
  ctx.restore();
}

// ─── Template 0 — PODIO  (dark luxury ranking) ────────────────────────────────
// Full dark gradient, 3 numbered product cards with rank glow, featured card bigger

async function tpl0_podio(ctx, store, products, coupons, sym, accent, primary) {
  const prods = (products || []).slice(0, 3);
  const name  = store.name || store.store_name || 'Mi Tienda';
  const code  = store.code || store.store_code || '';

  // BG
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#0e0e0e');
  bg.addColorStop(0.5, primary === '#ffffff' || primary === '#FFFFFF' ? '#111111' : primary);
  bg.addColorStop(1, '#060606');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // decorative orbs
  drawCircle(ctx, S - 80, 80, 340, accent, 0.07);
  drawCircle(ctx, 80, S - 80, 260, accent, 0.05);

  // top accent bar
  const topBar = ctx.createLinearGradient(0, 0, S, 0);
  topBar.addColorStop(0, accent);
  topBar.addColorStop(0.5, rgba(accent, 0.6));
  topBar.addColorStop(1, 'transparent');
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, S, 8);

  // logo + store name
  await drawLogo(ctx, store, S / 2, 90, 100, accent, primary);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 22), S / 2, 210);

  // "🔥 LO MÁS PEDIDO" badge
  const badgeW = 420, badgeH = 46, badgeX = S / 2 - badgeW / 2, badgeY = 228;
  ctx.fillStyle = accent;
  rr(ctx, badgeX, badgeY, badgeW, badgeH, 23);
  ctx.fill();
  ctx.fillStyle = primary === '#ffffff' || primary === '#FFFFFF' ? '#111' : '#fff';
  if (/^#[0-9a-f]{6}$/i.test(primary)) {
    const { r, g, b } = hex2rgb(primary);
    ctx.fillStyle = (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#111' : '#fff';
  }
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔥  LO MÁS PEDIDO ESTA SEMANA', S / 2, badgeY + badgeH / 2);

  // rank medals
  const medals = [accent, '#C0C0C0', '#CD7F32'];
  const rankLabels = ['01', '02', '03'];

  // card 0 — featured (big)
  const c0 = { x: 40, y: 298, w: S - 80, h: 200 };
  // card 1, 2 — smaller
  const c1 = { x: 40, y: 518, w: S - 80, h: 158 };
  const c2 = { x: 40, y: 694, w: S - 80, h: 158 };
  const cards = [c0, c1, c2];

  for (let i = 0; i < prods.length; i++) {
    const p = prods[i];
    const { x, y, w, h } = cards[i];

    // card bg
    ctx.save();
    ctx.shadowColor = i === 0 ? rgba(accent, 0.5) : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = i === 0 ? 30 : 16;
    ctx.fillStyle = i === 0 ? rgba(accent, 0.13) : 'rgba(255,255,255,0.06)';
    rr(ctx, x, y, w, h, 20);
    ctx.fill();
    ctx.restore();

    // card border
    ctx.strokeStyle = i === 0 ? rgba(accent, 0.7) : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = i === 0 ? 2 : 1;
    rr(ctx, x, y, w, h, 20);
    ctx.stroke();

    // rank badge (left strip)
    const stripW = 64;
    ctx.save();
    rr(ctx, x, y, stripW, h, 20);
    ctx.clip();
    ctx.fillStyle = medals[i];
    ctx.globalAlpha = i === 0 ? 1 : 0.8;
    ctx.fillRect(x, y, stripW, h);
    ctx.restore();
    ctx.fillStyle = i === 0 ? primary : '#111';
    if (/^#[0-9a-f]{6}$/i.test(primary)) {
      const { r, g, b } = hex2rgb(primary);
      ctx.fillStyle = i === 0 ? ((r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#111' : '#fff') : '#111';
    }
    ctx.font = `bold ${i === 0 ? 32 : 26}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rankLabels[i], x + stripW / 2, y + h / 2);

    // product image
    const imgSize = h - 20;
    await drawProductImg(ctx, p, x + stripW + 10, y + 10, imgSize);

    // text area
    const tx = x + stripW + imgSize + 24;
    const tw = w - stripW - imgSize - 32;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${i === 0 ? 32 : 26}px sans-serif`;
    ctx.fillText(trunc(p.name, 24), tx, y + (i === 0 ? 55 : 44));

    if (p.description) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `${i === 0 ? 20 : 17}px sans-serif`;
      ctx.fillText(trunc(p.description, 34), tx, y + (i === 0 ? 86 : 70));
    }

    // price tag
    const price = `${sym}${Number(p.price).toLocaleString('es-CL')}`;
    const priceFont = i === 0 ? 'bold 38px sans-serif' : 'bold 30px sans-serif';
    ctx.font = priceFont;
    const pm = ctx.measureText(price);
    const pw = pm.width + 24, ph2 = i === 0 ? 50 : 40;
    const px = tx, py2 = y + h - (i === 0 ? 62 : 52);
    ctx.fillStyle = accent;
    rr(ctx, px, py2, pw, ph2, ph2 / 2);
    ctx.fill();
    ctx.fillStyle = i === 0 ? primary : '#111';
    if (/^#[0-9a-f]{6}$/i.test(primary)) {
      const { r, g, b } = hex2rgb(primary);
      ctx.fillStyle = (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#111' : '#fff';
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(price, px + 12, py2 + ph2 / 2);
  }

  // bottom bar + footer
  ctx.fillStyle = accent;
  ctx.fillRect(0, S - 8, S, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '19px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, S - 38);
}

// ─── Template 1 — NEON DEALS  (promo / coupons) ───────────────────────────────
// Very dark with electric glow, big coupon cards OR product grid fallback

async function tpl1_deals(ctx, store, products, coupons, sym, accent, primary) {
  const name   = store.name || store.store_name || 'Mi Tienda';
  const code   = store.code || store.store_code || '';
  const active = (coupons || []).filter(c => c.is_active).slice(0, 2);

  // BG — near black with glow
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, S, S);
  drawCircle(ctx, S / 2, S / 2, 460, accent, 0.06);
  drawCircle(ctx, 100, 200,  280, accent, 0.04);
  drawCircle(ctx, S - 100, S - 200, 300, accent, 0.04);

  // diagonal stripe pattern
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (let d = -S; d < S * 2; d += 48) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + S, S);
    ctx.stroke();
  }
  ctx.restore();

  // top bar
  const topG = ctx.createLinearGradient(0, 0, S, 0);
  topG.addColorStop(0, 'transparent');
  topG.addColorStop(0.5, accent);
  topG.addColorStop(1, 'transparent');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, S, 10);

  // logo + store name
  await drawLogo(ctx, store, S / 2, 88, 96, accent, primary);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 22), S / 2, 208);

  if (active.length > 0) {
    // ── coupon cards
    ctx.fillStyle = accent;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('🎉  OFERTAS EXCLUSIVAS', S / 2, 254);

    const cardH = active.length === 1 ? 340 : 236;
    const gap = 22;
    const startY = 274;

    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      const y = startY + i * (cardH + gap);
      const cx2 = 44, cw = S - 88;

      // glow
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 36;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      rr(ctx, cx2, y, cw, cardH, 24);
      ctx.stroke();
      ctx.restore();

      // card bg
      ctx.fillStyle = rgba(accent, 0.1);
      rr(ctx, cx2, y, cw, cardH, 24);
      ctx.fill();

      // inner dashed border
      ctx.save();
      ctx.setLineDash([12, 8]);
      ctx.strokeStyle = rgba(accent, 0.4);
      ctx.lineWidth = 1.5;
      rr(ctx, cx2 + 10, y + 10, cw - 20, cardH - 20, 16);
      ctx.stroke();
      ctx.restore();

      const discount = c.discount_type === 'percent'
        ? `${c.discount_value}%`
        : `${sym}${c.discount_value}`;
      const label = c.discount_type === 'percent' ? 'DE DESCUENTO' : 'DE DESCUENTO';

      // discount value — giant
      const bigFontSize = cardH >= 300 ? 130 : 90;
      ctx.fillStyle = accent;
      ctx.font = `bold ${bigFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const centerY = y + cardH * 0.52;
      ctx.fillText(discount, S / 2, centerY);

      // "DE DESCUENTO" label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(label, S / 2, centerY + 30);

      // coupon name (top)
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(trunc(c.name, 36), S / 2, y + 48);

      // code badge (bottom)
      const codeText = `CÓDIGO: ${c.code}`;
      ctx.font = 'bold 20px sans-serif';
      const codeW = ctx.measureText(codeText).width + 32;
      ctx.fillStyle = '#fff';
      rr(ctx, S / 2 - codeW / 2, y + cardH - 52, codeW, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 18px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(codeText, S / 2, y + cardH - 34);
    }

  } else {
    // ── no coupons → 2x2 product grid
    ctx.fillStyle = accent;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('✨  NUESTROS FAVORITOS', S / 2, 254);

    const prods = (products || []).slice(0, 4);
    const tileW = (S - 80 - 16) / 2;
    const tileH = 280;
    const startY = 274;

    for (let i = 0; i < Math.min(prods.length, 4); i++) {
      const p = prods[i];
      const col = i % 2, row = Math.floor(i / 2);
      const tx = 40 + col * (tileW + 16);
      const ty = startY + row * (tileH + 16);

      // glow border
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = rgba(accent, 0.6);
      ctx.lineWidth = 2;
      rr(ctx, tx, ty, tileW, tileH, 20);
      ctx.stroke();
      ctx.restore();

      // tile bg
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      rr(ctx, tx, ty, tileW, tileH, 20);
      ctx.fill();

      // product image top 65%
      const imgH = Math.floor(tileH * 0.63);
      await drawProductImg(ctx, p, tx, ty, tileW);

      // gradient overlay on image bottom
      ctx.save();
      rr(ctx, tx, ty, tileW, tileH, 20);
      ctx.clip();
      const ov = ctx.createLinearGradient(0, ty + imgH - 40, 0, ty + tileH);
      ov.addColorStop(0, 'rgba(8,8,8,0)');
      ov.addColorStop(1, 'rgba(8,8,8,0.97)');
      ctx.fillStyle = ov;
      ctx.fillRect(tx, ty + imgH - 40, tileW, tileH - imgH + 40);
      ctx.restore();

      // name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(trunc(p.name, 16), tx + tileW / 2, ty + tileH - 38);

      // price
      ctx.fillStyle = accent;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, tx + tileW / 2, ty + tileH - 10);
    }
  }

  // bottom
  ctx.fillStyle = topG;
  ctx.fillRect(0, S - 10, S, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${BASE_URL}/store/${code}  ·  Powered by SRAutomatic`, S / 2, S - 36);
}

// ─── Template 2 — MAGAZINE  (editorial photo-grid) ────────────────────────────
// Hero product full-width top, two product tiles bottom row, clean editorial feel

async function tpl2_magazine(ctx, store, products, coupons, sym, accent, primary) {
  const prods = (products || []).slice(0, 3);
  const name  = store.name || store.store_name || 'Mi Tienda';
  const code  = store.code || store.store_code || '';

  // BG — solid very dark
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, S, S);

  // ── Top accent header strip
  const headerH = 130;
  const hg = ctx.createLinearGradient(0, 0, S, 0);
  hg.addColorStop(0, accent);
  hg.addColorStop(0.6, rgba(accent, 0.85));
  hg.addColorStop(1, primary === '#ffffff' || primary === '#FFFFFF' ? '#e0e0e0' : primary);
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, S, headerH);

  // Logo in header
  await drawLogo(ctx, store, 70, headerH / 2, 80, '#fff', accent);

  // Store name in header
  const isDarkAccent = (() => {
    if (!/^#[0-9a-f]{6}$/i.test(accent)) return false;
    const { r, g, b } = hex2rgb(accent);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  })();
  ctx.fillStyle = isDarkAccent ? '#fff' : '#111';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(trunc(name, 20), 130, headerH / 2 - 10);
  ctx.font = '20px sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText(`${BASE_URL}/store/${code}`, 130, headerH / 2 + 26);
  ctx.globalAlpha = 1;

  // ── Hero product (full width, tall)
  const heroH = 468;
  const heroY = headerH + 14;
  if (prods[0]) {
    const img = await tryLoadImg(prods[0].image);
    ctx.save();
    rr(ctx, 14, heroY, S - 28, heroH, 24);
    ctx.clip();
    if (img) {
      // cover fit
      const aspect = img.width / img.height;
      let dw = S - 28, dh = heroH;
      if (aspect > dw / dh) { dh = heroH; dw = dh * aspect; }
      else { dw = S - 28; dh = dw / aspect; }
      ctx.drawImage(img, 14 + ((S - 28) - dw) / 2, heroY + (heroH - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = rgba(accent, 0.15);
      ctx.fillRect(14, heroY, S - 28, heroH);
      ctx.font = '120px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(accent, 0.4);
      ctx.fillText('🍽', S / 2, heroY + heroH / 2);
    }
    // gradient overlay bottom
    const ov = ctx.createLinearGradient(0, heroY + heroH * 0.4, 0, heroY + heroH);
    ov.addColorStop(0, 'rgba(0,0,0,0)');
    ov.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = ov;
    ctx.fillRect(14, heroY + heroH * 0.4, S - 28, heroH * 0.6);
    ctx.restore();

    // hero text overlay
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(prods[0].name, 26), 40, heroY + heroH - 54);

    const priceText = `${sym}${Number(prods[0].price).toLocaleString('es-CL')}`;
    ctx.fillStyle = accent;
    ctx.font = 'bold 40px sans-serif';
    const pm = ctx.measureText(priceText);
    const pW = pm.width + 28, pH = 52;
    const pX = 40, pY = heroY + heroH - 44;
    ctx.fillStyle = accent;
    rr(ctx, pX, pY, pW, pH, 26);
    ctx.fill();
    ctx.fillStyle = isDarkAccent ? '#fff' : '#111';
    ctx.font = 'bold 30px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, pX + 14, pY + pH / 2);

    // "DESTACADO" badge
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const badgeW2 = 140, badgeH2 = 32;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    rr(ctx, S - 28 - badgeW2, heroY + 18, badgeW2, badgeH2, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('⭐ DESTACADO', S - 28 - badgeW2 / 2, heroY + 18 + badgeH2 / 2);
  }

  // ── Two smaller tiles bottom row
  const tileY = heroY + heroH + 14;
  const tileH2 = S - tileY - 60;
  const tileW2 = (S - 28 - 14) / 2;

  for (let i = 1; i <= 2; i++) {
    const p = prods[i];
    const tx = 14 + (i - 1) * (tileW2 + 14);
    const ty = tileY;

    if (!p) continue;

    const img = await tryLoadImg(p.image);
    ctx.save();
    rr(ctx, tx, ty, tileW2, tileH2, 20);
    ctx.clip();
    if (img) {
      const aspect = img.width / img.height;
      let dw = tileW2, dh = tileH2;
      if (aspect > dw / dh) { dh = tileH2; dw = dh * aspect; }
      else { dw = tileW2; dh = dw / aspect; }
      ctx.drawImage(img, tx + (tileW2 - dw) / 2, ty + (tileH2 - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = rgba(accent, 0.12);
      ctx.fillRect(tx, ty, tileW2, tileH2);
      ctx.font = '60px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(accent, 0.35);
      ctx.fillText('🍽', tx + tileW2 / 2, ty + tileH2 / 2);
    }
    const ov2 = ctx.createLinearGradient(0, ty + tileH2 * 0.45, 0, ty + tileH2);
    ov2.addColorStop(0, 'rgba(0,0,0,0)');
    ov2.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = ov2;
    ctx.fillRect(tx, ty + tileH2 * 0.45, tileW2, tileH2 * 0.55);
    ctx.restore();

    // tile border
    ctx.strokeStyle = rgba(accent, 0.3);
    ctx.lineWidth = 1.5;
    rr(ctx, tx, ty, tileW2, tileH2, 20);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(trunc(p.name, 18), tx + tileW2 / 2, ty + tileH2 - 36);

    ctx.fillStyle = accent;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${sym}${Number(p.price).toLocaleString('es-CL')}`, tx + tileW2 / 2, ty + tileH2 - 8);
  }

  // bottom footer
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Powered by SRAutomatic.cl`, S / 2, S - 20);
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function generatePromoImage({ store, topProducts, coupons, templateCounter, currencySymbol }) {
  const canvas = createCanvas(S, S);
  const ctx    = canvas.getContext('2d');

  const primary = store.primary_color || '#000000';
  const accent  = store.accent_color  || '#D4AF37';
  const sym     = currencySymbol || '$';
  const tpl     = (templateCounter || 0) % 3;

  if (tpl === 0) await tpl0_podio(ctx, store, topProducts, coupons, sym, accent, primary);
  else if (tpl === 1) await tpl1_deals(ctx, store, topProducts, coupons, sym, accent, primary);
  else await tpl2_magazine(ctx, store, topProducts, coupons, sym, accent, primary);

  return canvas.toBuffer('image/jpeg', { quality: 92 });
}

export async function postToInstagram({ username, password, imageBuffer, caption }) {
  const { IgApiClient } = await import('instagram-private-api');
  const ig = new IgApiClient();
  ig.state.generateDevice(username);
  await ig.simulate.preLoginFlow();
  await ig.account.login(username, password);
  await ig.simulate.postLoginFlow();
  await ig.publish.photo({ file: imageBuffer, caption });
}
