import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP   = join(__dir, 'tmp-tiktok');

async function ensureTmp() {
  if (!existsSync(TMP)) await mkdir(TMP, { recursive: true });
}

// Convierte imagen JPEG en video de 5 segundos usando ffmpeg
function imageToVideo(imgPath, vidPath) {
  execSync(
    `ffmpeg -y -loop 1 -i "${imgPath}" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1080:1080,setsar=1" "${vidPath}"`,
    { stdio: 'pipe' }
  );
}

// Construye el array de cookies que necesita tiktok-uploader a partir del sessionid
function buildCookies(sessionId) {
  return [
    { name: 'sessionid',     value: sessionId, domain: '.tiktok.com', path: '/', secure: true, httpOnly: true },
    { name: 'sessionid_ss',  value: sessionId, domain: '.tiktok.com', path: '/', secure: true, httpOnly: true },
  ];
}

export async function postToTikTok({ sessionId, imageBuffer, caption }) {
  await ensureTmp();

  const base    = `tt_${Date.now()}`;
  const imgPath = join(TMP, `${base}.jpg`);
  const vidPath = join(TMP, `${base}.mp4`);

  await writeFile(imgPath, imageBuffer);

  try {
    imageToVideo(imgPath, vidPath);

    const { uploadVideo } = await import('tiktok-uploader');

    await uploadVideo({
      cookies:  buildCookies(sessionId),
      video:    vidPath,
      title:    caption,
      headless: true,
    });
  } finally {
    await unlink(imgPath).catch(() => {});
    await unlink(vidPath).catch(() => {});
  }
}
