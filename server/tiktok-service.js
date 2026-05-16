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

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function getTikTokAuthUrl({ clientKey, redirectUri, storeId }) {
  const params = new URLSearchParams({
    client_key:    clientKey,
    scope:         'user.info.basic,video.publish',
    response_type: 'code',
    redirect_uri:  redirectUri,
    state:         String(storeId),
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

export async function exchangeCodeForToken({ clientKey, clientSecret, code, redirectUri }) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body:    new URLSearchParams({
      client_key:    clientKey,
      client_secret: clientSecret,
      code,
      grant_type:   'authorization_code',
      redirect_uri:  redirectUri,
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, refresh_token, open_id, expires_in, scope }
}

export async function refreshTikTokToken({ clientKey, clientSecret, refreshToken }) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body:    new URLSearchParams({
      client_key:    clientKey,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

// ── Publicar video via Content Posting API ────────────────────────────────────

export async function postToTikTok({ accessToken, imageBuffer, caption }) {
  await ensureTmp();
  const base    = `tt_${Date.now()}`;
  const imgPath = join(TMP, `${base}.jpg`);
  const vidPath = join(TMP, `${base}.mp4`);

  await writeFile(imgPath, imageBuffer);

  try {
    imageToVideo(imgPath, vidPath);
    const videoBuffer = await readFile(vidPath);
    const videoSize   = videoBuffer.length;

    // 1. Iniciar upload
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title:                    caption.slice(0, 2200),
          privacy_level:            'PUBLIC_TO_EVERYONE',
          disable_duet:             false,
          disable_comment:          false,
          disable_stitch:           false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source:             'FILE_UPLOAD',
          video_size:         videoSize,
          chunk_size:         videoSize,
          total_chunk_count:  1,
        },
      }),
    });

    const initData = await initRes.json();

    if (!initRes.ok || initData.error?.code !== 'ok') {
      const code = initData.error?.code || '';
      if (code === 'access_token_invalid' || code === 'access_token_expired') {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error(`TikTok API: ${initData.error?.message || code || `HTTP ${initRes.status}`}`);
    }

    const { upload_url } = initData.data;

    // 2. Subir el video
    const uploadRes = await fetch(upload_url, {
      method:  'PUT',
      headers: {
        'Content-Type':   'video/mp4',
        'Content-Length': String(videoSize),
        'Content-Range':  `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) throw new Error(`Error subiendo video: ${uploadRes.status}`);

  } finally {
    await unlink(imgPath).catch(() => {});
    await unlink(vidPath).catch(() => {});
  }
}
