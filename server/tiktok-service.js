import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Import lazy para no crashear el servidor si playwright no está instalado aún
async function getChromium() {
  const { chromium } = await import('playwright');
  return chromium;
}

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP   = join(__dir, 'tmp-tiktok');

// Encuentra el Chromium instalado en el sistema (evita descargar el de Playwright)
function findChromium() {
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined; // Playwright usará el suyo si está disponible
}

const CHROMIUM_PATH = findChromium();
const LAUNCH_OPTS = {
  headless:        true,
  executablePath:  CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
};

async function ensureTmp() {
  if (!existsSync(TMP)) await mkdir(TMP, { recursive: true });
}

function imageToVideo(imgPath, vidPath) {
  execSync(
    `ffmpeg -y -loop 1 -i "${imgPath}" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1080:1080,setsar=1" "${vidPath}"`,
    { stdio: 'pipe' }
  );
}

function sessionCookies(sessionId) {
  const base = { domain: '.tiktok.com', path: '/', secure: true, httpOnly: true, sameSite: 'None' };
  return [
    { ...base, name: 'sessionid',    value: sessionId },
    { ...base, name: 'sessionid_ss', value: sessionId },
  ];
}

export async function postToTikTok({ sessionId, imageBuffer, caption }) {
  await ensureTmp();
  const base    = `tt_${Date.now()}`;
  const imgPath = join(TMP, `${base}.jpg`);
  const vidPath = join(TMP, `${base}.mp4`);
  await writeFile(imgPath, imageBuffer);

  const browser = await (await getChromium()).launch(LAUNCH_OPTS);

  try {
    imageToVideo(imgPath, vidPath);

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport:  { width: 1280, height: 900 },
    });
    await context.addCookies(sessionCookies(sessionId));

    const page = await context.newPage();
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Upload video file
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 20000 });
    await fileInput.setInputFiles(vidPath);

    // Wait for upload progress to finish
    await page.waitForSelector('[class*="upload-progress"], [class*="uploading"]', { timeout: 10000 }).catch(() => {});
    await page.waitForFunction(
      () => !document.querySelector('[class*="uploading"], [class*="upload-progress"]'),
      { timeout: 120000 }
    );

    // Fill caption
    const captionBox = await page.waitForSelector('[data-e2e="caption-input"], [class*="caption"] [contenteditable], .public-DraftEditor-content', { timeout: 15000 });
    await captionBox.click({ clickCount: 3 });
    await captionBox.fill('');
    await captionBox.type(caption.slice(0, 2200), { delay: 20 });

    // Click Post button
    const postBtn = await page.waitForSelector('[data-e2e="post-button"], button:has-text("Post"), button:has-text("Publicar")', { timeout: 10000 });
    await postBtn.click();

    // Wait for success redirect
    await page.waitForURL(/manage|profile|studio/, { timeout: 60000 });

    await context.close();
  } finally {
    await browser.close().catch(() => {});
    await unlink(imgPath).catch(() => {});
    await unlink(vidPath).catch(() => {});
  }
}

// ── QR Login (WhatsApp-style) ─────────────────────────────────────

// storeId → { browser, context, page, status, sessionId, expiresAt, pollTimer }
const qrSessions = new Map();

async function cleanupQRSession(storeId) {
  const key = String(storeId);
  const s = qrSessions.get(key);
  if (!s) return;
  if (s.pollTimer) clearInterval(s.pollTimer);
  await s.browser.close().catch(() => {});
  qrSessions.delete(key);
}

async function captureQR(page) {
  // Try canvas first (TikTok renders QR in canvas), then img fallbacks
  const el = await page.$('canvas')
    || await page.$('img[src*="qrcode"]')
    || await page.$('[class*="qrcode"] img')
    || await page.$('[class*="QrCode"] img')
    || await page.$('[data-e2e*="qr"] img');
  if (!el) return null;
  return (await el.screenshot()).toString('base64');
}

export async function startQRLogin(storeId) {
  await cleanupQRSession(storeId);

  const browser = await (await getChromium()).launch(LAUNCH_OPTS);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const session = {
    browser, context, page,
    status:    'pending',
    sessionId: null,
    qrBase64:  null,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    pollTimer: null,
  };
  qrSessions.set(String(storeId), session);

  // Navigate to TikTok QR login page
  await page.goto('https://www.tiktok.com/login/qrcode', {
    waitUntil: 'domcontentloaded',
    timeout:   30000,
  });

  // Wait for QR element
  await page.waitForSelector('canvas, img[src*="qrcode"], [class*="qrcode"] img, [class*="QrCode"] img', {
    timeout: 20000,
  });

  // Short delay to let it fully render
  await page.waitForTimeout(1500);

  const qrBase64 = await captureQR(page);
  if (!qrBase64) throw new Error('No se pudo capturar el QR de TikTok');

  session.qrBase64 = qrBase64;

  // Poll for login completion and refresh QR image
  session.pollTimer = setInterval(async () => {
    const s = qrSessions.get(String(storeId));
    if (!s || s.status !== 'pending') { clearInterval(s?.pollTimer); return; }

    if (Date.now() > s.expiresAt) {
      s.status = 'expired';
      clearInterval(s.pollTimer);
      s.browser.close().catch(() => {});
      qrSessions.delete(String(storeId));
      return;
    }

    try {
      // Check cookies regardless of URL — sessionid may appear before redirect
      const cookies = await s.context.cookies('https://www.tiktok.com');
      const cookie  = cookies.find(c => c.name === 'sessionid' && c.value && c.value.length > 10);
      if (cookie) {
        s.status    = 'connected';
        s.sessionId = cookie.value;
        clearInterval(s.pollTimer);
        setTimeout(() => s.browser.close().catch(() => {}), 5000);
        return;
      }

      // Refresh QR image so it stays up to date
      const fresh = await captureQR(s.page);
      if (fresh) s.qrBase64 = fresh;
    } catch { /* ignore mid-navigation errors */ }
  }, 2500);

  return qrBase64;
}

export async function getQRStatus(storeId) {
  const s = qrSessions.get(String(storeId));
  if (!s) return { status: 'none', qr: null, sessionId: null };

  const result = {
    status:    s.status,
    qr:        s.status === 'pending' ? s.qrBase64 : null,
    sessionId: s.status === 'connected' ? s.sessionId : null,
  };

  if (s.status !== 'pending') {
    qrSessions.delete(String(storeId));
  }

  return result;
}

export async function cancelQRLogin(storeId) {
  await cleanupQRSession(storeId);
}
