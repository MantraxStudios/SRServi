import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP   = join(__dir, 'tmp-tiktok');

async function ensureTmp() {
  if (!existsSync(TMP)) await mkdir(TMP, { recursive: true });
}

function imageToVideo(imgPath, vidPath) {
  execSync(
    `ffmpeg -y -loop 1 -i "${imgPath}" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1080:1080,setsar=1" "${vidPath}"`,
    { stdio: 'pipe' }
  );
}

function extractCsrfToken(cookieStr) {
  const m = cookieStr.match(/tt_csrf_token=([^;,\s]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

// ── Sesiones de QR activas ────────────────────────────────────────────────────
// Map<storeId, { browser, context, page, timeout, startTime }>
const qrSessions = new Map();

async function launchBrowser() {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });
    return browser;
  } catch (e) {
    throw new Error('Playwright no disponible. Ejecutá: npx playwright install chromium');
  }
}

function cookiesArrayToString(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// ── Método 1: Login por QR ────────────────────────────────────────────────────

export async function startQrLogin(storeId) {
  // Cerrar sesión previa si existe
  const prev = qrSessions.get(String(storeId));
  if (prev) {
    clearTimeout(prev.timeout);
    await prev.browser.close().catch(() => {});
    qrSessions.delete(String(storeId));
  }

  const browser = await launchBrowser();
  const context  = await browser.newContext({
    userAgent:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:      'es-ES',
    timezoneId:  'America/Argentina/Buenos_Aires',
    viewport:    { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9' },
  });

  const page = await context.newPage();

  // Quitar pistas de automatización
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Buscar botón de QR (puede cambiar según región/versión)
    const qrSelectors = [
      '[data-e2e="scan-qr-code"]',
      'a[href*="qrcode"]',
      'button:has-text("QR")',
      '[class*="qr"]',
    ];
    for (const sel of qrSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click(); break; }
      } catch {}
    }
    await page.waitForTimeout(1500);

    // Capturar el QR: primero el canvas/img del QR, si no toda la página
    let qrBase64 = null;
    const qrEl = await page.locator('canvas, [data-e2e="qrcode"], img[src*="qr"], .qrcode img').first();
    try {
      if (await qrEl.isVisible({ timeout: 2000 })) {
        const buf = await qrEl.screenshot();
        qrBase64 = buf.toString('base64');
      }
    } catch {}

    if (!qrBase64) {
      // Fallback: screenshot completo
      const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 800 } });
      qrBase64 = buf.toString('base64');
    }

    const tid = setTimeout(async () => {
      await browser.close().catch(() => {});
      qrSessions.delete(String(storeId));
    }, 5 * 60 * 1000);

    qrSessions.set(String(storeId), { browser, context, page, timeout: tid, startTime: Date.now() });
    return { qrBase64 };

  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

export async function checkQrStatus(storeId) {
  const session = qrSessions.get(String(storeId));
  if (!session) return { status: 'expired' };

  try {
    const { browser, context, timeout, startTime } = session;

    if (Date.now() - startTime > 5 * 60 * 1000) {
      clearTimeout(timeout);
      await browser.close().catch(() => {});
      qrSessions.delete(String(storeId));
      return { status: 'expired' };
    }

    const cookies = await context.cookies('https://www.tiktok.com');
    const hasSession = cookies.some(c => c.name === 'sessionid' && c.value.length > 10);

    if (hasSession) {
      const cookieString = cookiesArrayToString(cookies);
      clearTimeout(timeout);
      await browser.close().catch(() => {});
      qrSessions.delete(String(storeId));
      return { status: 'success', cookieString };
    }

    return { status: 'pending' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// ── Método 2: Login con email y contraseña ────────────────────────────────────

export async function loginWithEmail({ email, password }) {
  const browser = await launchBrowser();
  const context  = await browser.newContext({
    userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:     'es-ES',
    viewport:   { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Seleccionar login con email
    const emailChannels = [
      '[data-e2e="channel-item"]:has-text("Email")',
      'a:has-text("Use phone")',
      'div[role="button"]:has-text("Email")',
    ];
    for (const sel of emailChannels) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 })) { await el.click(); await page.waitForTimeout(600); break; }
      } catch {}
    }

    // Cambiar a login (vs registro)
    try {
      const loginLink = page.locator('a:has-text("Log in"), a:has-text("Iniciar sesión")').first();
      if (await loginLink.isVisible({ timeout: 2000 })) { await loginLink.click(); await page.waitForTimeout(600); }
    } catch {}

    // Llenar email
    const emailInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="mail"], input[placeholder*="Email"]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.click();
    await emailInput.fill(email);
    await page.waitForTimeout(400);

    // Llenar contraseña
    const passInput = page.locator('input[type="password"]').first();
    await passInput.waitFor({ timeout: 5000 });
    await passInput.click();
    await passInput.fill(password);
    await page.waitForTimeout(400);

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Iniciar sesión")').first();
    await submitBtn.click();

    // Esperar resultado
    await page.waitForTimeout(6000);

    // Revisar cookies
    const cookies = await context.cookies('https://www.tiktok.com');
    const hasSession = cookies.some(c => c.name === 'sessionid' && c.value.length > 10);

    if (hasSession) {
      await browser.close();
      return { success: true, cookieString: cookiesArrayToString(cookies) };
    }

    // Detectar captcha / verificación
    const url  = page.url();
    const html = await page.content().catch(() => '');
    await browser.close();

    if (url.includes('captcha') || html.includes('captcha') || html.includes('verify') || html.includes('verification')) {
      return { success: false, error: 'TikTok pide verificación (captcha). Usá el método de Cookies.' };
    }

    return { success: false, error: 'No se pudo iniciar sesión. Revisá el email y la contraseña.' };

  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

// ── Método 3: Publicar con cookies del navegador ──────────────────────────────

export async function postToTikTok({ cookieString, imageBuffer, caption }) {
  await ensureTmp();
  const base    = `tt_${Date.now()}`;
  const imgPath = join(TMP, `${base}.jpg`);
  const vidPath = join(TMP, `${base}.mp4`);

  await writeFile(imgPath, imageBuffer);

  try {
    imageToVideo(imgPath, vidPath);
    const videoBuffer = await readFile(vidPath);
    const videoSize   = videoBuffer.length;

    const csrfToken = extractCsrfToken(cookieString);

    const baseHdrs = {
      'Cookie':          cookieString,
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer':         'https://www.tiktok.com/',
      'Origin':          'https://www.tiktok.com',
      'Accept-Language': 'es-ES,es;q=0.9',
      ...(csrfToken ? { 'X-Secsdk-Csrf-Token': csrfToken } : {}),
    };

    // 1. Iniciar upload
    const initRes = await fetch('https://www.tiktok.com/api/media/upload/init/', {
      method:  'POST',
      headers: { ...baseHdrs, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ source_type: 'FILE_UPLOAD', video_size: videoSize, chunk_size: videoSize, total_chunk_count: 1 }),
    });

    if (!initRes.ok) throw new Error(`TikTok upload init: HTTP ${initRes.status}`);
    const initData = await initRes.json();

    if (initData.statusCode !== 0) {
      if (initData.statusCode === 8 || initData.statusCode === 10101) {
        throw new Error('Sesión expirada — volvé a conectar tu cuenta de TikTok.');
      }
      throw new Error(`TikTok error ${initData.statusCode}: ${initData.statusMsg || 'desconocido'}`);
    }

    const { upload_url, video_id } = initData.data;

    // 2. Subir video
    const uploadRes = await fetch(upload_url, {
      method:  'PUT',
      headers: { ...baseHdrs, 'Content-Type': 'video/mp4', 'Content-Length': String(videoSize), 'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}` },
      body:    videoBuffer,
    });
    if (!uploadRes.ok) throw new Error(`TikTok video upload: HTTP ${uploadRes.status}`);

    // 3. Publicar
    const postRes = await fetch('https://www.tiktok.com/api/media/publish/', {
      method:  'POST',
      headers: { ...baseHdrs, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ video_id, text: caption.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_stitch: false, disable_comment: false, video_cover_timestamp_ms: 1000 }),
    });

    const postData = await postRes.json();
    if (postData.statusCode !== 0) {
      throw new Error(`TikTok publish error ${postData.statusCode}: ${postData.statusMsg || 'desconocido'}`);
    }

  } finally {
    await unlink(imgPath).catch(() => {});
    await unlink(vidPath).catch(() => {});
  }
}
