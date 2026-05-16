import { writeFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dir, 'uploads');
if (!existsSync(UPLOADS)) mkdirSync(UPLOADS, { recursive: true });

const CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY    || '';
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const CALLBACK_URL  = 'https://srservi2.srautomatic.com/api/tiktok/callback';
const SCOPES        = 'user.info.basic,video.publish';

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getTikTokAuthUrl(state) {
  const p = new URLSearchParams({
    client_key:    CLIENT_KEY,
    response_type: 'code',
    scope:         SCOPES,
    redirect_uri:  CALLBACK_URL,
    state:         String(state),
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
}

export async function exchangeTikTokCode(code) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body:    new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: CALLBACK_URL }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data; // { access_token, refresh_token, open_id, expires_in }
}

export async function refreshTikTokToken(refreshToken) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body:    new URLSearchParams({ client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

// ─── Posting ─────────────────────────────────────────────────────────────────

export async function postPhotoToTikTok({ accessToken, imageBuffer, caption }) {
  const fname = `tiktok_${Date.now()}.jpg`;
  const fpath = join(UPLOADS, fname);
  await writeFile(fpath, imageBuffer);

  // Clean up after 10 minutes whether the post succeeds or fails
  const cleanup = () => setTimeout(() => unlink(fpath).catch(() => {}), 10 * 60 * 1000);

  try {
    const imageUrl = `https://srservi2.srautomatic.com/uploads/${fname}`;
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body:    JSON.stringify({
        post_info:   { title: caption, privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_comment: false, disable_stitch: false },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [imageUrl] },
        media_type:  'PHOTO',
        post_mode:   'DIRECT_POST',
      }),
    });
    const data = await res.json();
    if (data.error?.code && data.error.code !== 'ok') throw new Error(data.error.message || `TikTok error ${res.status}`);
    cleanup();
    return data;
  } catch (e) {
    cleanup();
    throw e;
  }
}
