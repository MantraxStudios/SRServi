import { createCanvas, loadImage } from '@napi-rs/canvas';

const IMG_SIZE = 1080;
const BASE_URL = 'https://srservi2.srautomatic.com';

function roundRect(ctx, x, y, w, h, r) {
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
  } catch {
    return null;
  }
}

function drawPlaceholder(ctx, x, y, size, accent) {
  ctx.fillStyle = `${accent}30`;
  roundRect(ctx, x, y, size, size, 14);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = `${Math.floor(size * 0.4)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍽', x + size / 2, y + size / 2);
}

function drawInitial(ctx, x, y, size, accent, primary, name) {
  ctx.fillStyle = accent;
  roundRect(ctx, x, y, size, size, 20);
  ctx.fill();
  ctx.fillStyle = primary;
  ctx.font = `bold 44px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || '?')[0].toUpperCase(), x + size / 2, y + size / 2);
}

async function drawProductCard(ctx, product, x, y, w, h, sym, accent) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `${accent}44`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 22);
  ctx.stroke();

  const imgSize = h - 24;
  const imgX = x + 14;
  const imgY = y + 12;

  const img = await tryLoadImg(product.image);
  if (img) {
    ctx.save();
    roundRect(ctx, imgX, imgY, imgSize, imgSize, 12);
    ctx.clip();
    ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
    ctx.restore();
  } else {
    drawPlaceholder(ctx, imgX, imgY, imgSize, accent);
  }

  const tx = imgX + imgSize + 18;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(product.name, 22), tx, y + 48);

  if (product.description) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '20px sans-serif';
    ctx.fillText(trunc(product.description, 32), tx, y + 78);
  }

  ctx.fillStyle = accent;
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`${sym}${Number(product.price).toLocaleString('es-CL')}`, tx, y + h - 22);
}

async function templateProducts(ctx, products, startY, sym, accent) {
  const prods = (products || []).slice(0, 3);
  const cardH = 162;
  const gap = 20;
  const cardW = IMG_SIZE - 80;
  for (let i = 0; i < prods.length; i++) {
    await drawProductCard(ctx, prods[i], 40, startY + i * (cardH + gap), cardW, cardH, sym, accent);
  }
}

async function templatePromos(ctx, products, coupons, startY, sym, accent, primary) {
  const active = (coupons || []).filter(c => c.is_active).slice(0, 3);
  if (active.length === 0) {
    await templateProducts(ctx, products, startY, sym, accent);
    return;
  }
  const cardH = active.length === 1 ? 300 : active.length === 2 ? 210 : 156;
  const gap = 20;
  const cardW = IMG_SIZE - 80;

  for (let i = 0; i < active.length; i++) {
    const c = active[i];
    const y = startY + i * (cardH + gap);

    ctx.save();
    ctx.shadowColor = `${accent}88`;
    ctx.shadowBlur = 28;
    ctx.fillStyle = accent;
    roundRect(ctx, 40, y, cardW, cardH, 22);
    ctx.fill();
    ctx.restore();

    ctx.setLineDash([14, 8]);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    roundRect(ctx, 54, y + 12, cardW - 28, cardH - 24, 14);
    ctx.stroke();
    ctx.setLineDash([]);

    const discount = c.discount_type === 'percent'
      ? `${c.discount_value}% OFF`
      : `${sym}${c.discount_value} OFF`;

    ctx.fillStyle = primary || '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (cardH >= 200) {
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(trunc(c.name, 38), IMG_SIZE / 2, y + 50);
      ctx.font = `bold ${cardH >= 280 ? 88 : 64}px sans-serif`;
      ctx.fillText(discount, IMG_SIZE / 2, y + cardH / 2 + 26);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`CÓDIGO: ${c.code}`, IMG_SIZE / 2, y + cardH - 30);
    } else {
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`${discount}  ·  CÓDIGO: ${c.code}`, IMG_SIZE / 2, y + cardH / 2 + 14);
      ctx.font = '22px sans-serif';
      ctx.fillText(trunc(c.name, 40), IMG_SIZE / 2, y + cardH / 2 + 48);
    }
  }
}

async function templateMix(ctx, products, coupons, startY, sym, accent, primary) {
  const prods = (products || []).slice(0, 2);
  const coupon = (coupons || []).find(c => c.is_active);
  const cardH = 152;
  const gap = 18;
  const cardW = IMG_SIZE - 80;

  for (let i = 0; i < prods.length; i++) {
    await drawProductCard(ctx, prods[i], 40, startY + i * (cardH + gap), cardW, cardH, sym, accent);
  }

  if (coupon) {
    const py = startY + 2 * (cardH + gap) + gap;
    const ph = 148;

    ctx.save();
    ctx.shadowColor = `${accent}88`;
    ctx.shadowBlur = 24;
    ctx.fillStyle = accent;
    roundRect(ctx, 40, py, cardW, ph, 22);
    ctx.fill();
    ctx.restore();

    const discount = coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% OFF`
      : `${sym}${coupon.discount_value} OFF`;

    ctx.fillStyle = primary || '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(discount, IMG_SIZE / 2, py + 66);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`CÓDIGO: ${coupon.code}  ·  ${trunc(coupon.name, 28)}`, IMG_SIZE / 2, py + 112);
  }
}

export async function generatePromoImage({ store, topProducts, coupons, templateCounter, currencySymbol }) {
  const canvas = createCanvas(IMG_SIZE, IMG_SIZE);
  const ctx = canvas.getContext('2d');

  const primary = store.primary_color || '#000000';
  const accent  = store.accent_color  || '#D4AF37';
  const name    = store.name || store.store_name || 'Mi Tienda';
  const sym     = currencySymbol || '$';
  const tpl     = (templateCounter || 0) % 3;

  // Background
  const grad = ctx.createLinearGradient(0, 0, IMG_SIZE, IMG_SIZE);
  grad.addColorStop(0, primary);
  grad.addColorStop(0.65, '#111111');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);

  // Decorative circles
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(920, 160, 300, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.05;
  ctx.beginPath(); ctx.arc(120, 960, 240, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Top gold line
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, IMG_SIZE, 10);

  // Logo
  const logoSize = 100;
  const logoX = IMG_SIZE / 2 - logoSize / 2;
  const logoY = 30;
  const logoUrl = store.logo_url;

  if (logoUrl) {
    const img = await tryLoadImg(logoUrl);
    if (img) {
      ctx.save();
      roundRect(ctx, logoX, logoY, logoSize, logoSize, 20);
      ctx.clip();
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      roundRect(ctx, logoX, logoY, logoSize, logoSize, 20);
      ctx.stroke();
    } else {
      drawInitial(ctx, logoX, logoY, logoSize, accent, primary, name);
    }
  } else {
    drawInitial(ctx, logoX, logoY, logoSize, accent, primary, name);
  }

  // Store name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(trunc(name, 24), IMG_SIZE / 2, logoY + logoSize + 58);

  // Subtitle
  const subtitles = [
    '🔥  Lo más pedido esta semana',
    '🎉  Ofertas especiales para vos',
    '✨  Descubrí lo mejor de la semana',
  ];
  ctx.font = '500 28px sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(subtitles[tpl], IMG_SIZE / 2, logoY + logoSize + 100);

  ctx.font = '26px serif';
  ctx.fillText('★  ★  ★  ★  ★', IMG_SIZE / 2, logoY + logoSize + 142);

  // Content
  const contentY = 340;
  if (tpl === 0)      await templateProducts(ctx, topProducts, contentY, sym, accent);
  else if (tpl === 1) await templatePromos(ctx, topProducts, coupons, contentY, sym, accent, primary);
  else                await templateMix(ctx, topProducts, coupons, contentY, sym, accent, primary);

  // Bottom gold line
  ctx.fillStyle = accent;
  ctx.fillRect(0, IMG_SIZE - 10, IMG_SIZE, 10);

  // Footer
  const storeCode = store.code || store.store_code || '';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${BASE_URL}/store/${storeCode}  ·  Powered by SRAutomatic.cl`,
    IMG_SIZE / 2, IMG_SIZE - 32
  );

  return canvas.toBuffer('image/jpeg', { quality: 90 });
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
