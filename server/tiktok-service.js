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

// ── Publicar video usando las cookies del navegador ───────────────────────────

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
      body:    JSON.stringify({
        source_type:       'FILE_UPLOAD',
        video_size:        videoSize,
        chunk_size:        videoSize,
        total_chunk_count: 1,
      }),
    });

    if (!initRes.ok) throw new Error(`TikTok upload init: HTTP ${initRes.status}`);
    const initData = await initRes.json();

    if (initData.statusCode !== 0) {
      if (initData.statusCode === 8 || initData.statusCode === 10101) {
        throw new Error('Sesión expirada — pegá las cookies actualizadas de TikTok.');
      }
      throw new Error(`TikTok error ${initData.statusCode}: ${initData.statusMsg || 'desconocido'}`);
    }

    const { upload_url, video_id } = initData.data;

    // 2. Subir video
    const uploadRes = await fetch(upload_url, {
      method:  'PUT',
      headers: {
        ...baseHdrs,
        'Content-Type':   'video/mp4',
        'Content-Length': String(videoSize),
        'Content-Range':  `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) throw new Error(`TikTok video upload: HTTP ${uploadRes.status}`);

    // 3. Publicar
    const postRes = await fetch('https://www.tiktok.com/api/media/publish/', {
      method:  'POST',
      headers: { ...baseHdrs, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        video_id,
        text:                     caption.slice(0, 2200),
        privacy_level:            'PUBLIC_TO_EVERYONE',
        disable_duet:             false,
        disable_stitch:           false,
        disable_comment:          false,
        video_cover_timestamp_ms: 1000,
      }),
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
