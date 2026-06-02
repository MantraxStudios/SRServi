/**
 * rtsp-counter.js
 * Servicio background de conteo de aforo por cámara RTSP.
 * - Usa FFmpeg para extraer frames crudos a 2fps (80×60 RGB)
 * - Porta el mismo algoritmo del browser: diff de pixeles + blobs + cruce de línea
 * - Guarda eventos en DB directamente (funciona aunque el panel esté cerrado)
 * - También lanza un proceso FFmpeg separado para el preview HLS en el admin
 */

import { spawn, execSync, execFileSync } from 'child_process';
import { mkdirSync, existsSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir, platform } from 'os';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Auto-instalador de FFmpeg ────────────────────────────────────────────────

let ffmpegBin = 'ffmpeg'; // ruta al ejecutable (se actualiza si se descarga manualmente)

async function ensureFFmpeg() {
  // 1. Verificar si ya está disponible en PATH
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000 });
    console.log('[RTSP] FFmpeg disponible en PATH ✓');
    return true;
  } catch {}

  const os = platform();

  // 2. Linux/Mac → intentar instalar con gestor de paquetes
  if (os === 'linux' || os === 'darwin') {
    console.log('[RTSP] FFmpeg no encontrado. Instalando automáticamente...');
    try {
      // Detectar gestor de paquetes
      const hasPkg = (cmd) => { try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; } };
      if (hasPkg('apt-get')) {
        console.log('[RTSP] Usando apt-get...');
        execSync('apt-get update -qq && apt-get install -y ffmpeg', { stdio: 'inherit', timeout: 180000 });
      } else if (hasPkg('apt')) {
        execSync('apt update -qq && apt install -y ffmpeg', { stdio: 'inherit', timeout: 180000 });
      } else if (hasPkg('yum')) {
        execSync('yum install -y ffmpeg', { stdio: 'inherit', timeout: 180000 });
      } else if (hasPkg('brew')) {
        execSync('brew install ffmpeg', { stdio: 'inherit', timeout: 300000 });
      } else {
        throw new Error('No se encontró gestor de paquetes (apt/yum/brew)');
      }
      // Verificar que quedó instalado
      execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
      console.log('[RTSP] FFmpeg instalado correctamente ✓');
      return true;
    } catch (e) {
      console.error('[RTSP] Error instalando FFmpeg:', e.message);
    }

    // 3. Fallback Linux: descargar binario estático de john van sickle
    try {
      console.log('[RTSP] Descargando binario estático de FFmpeg...');
      const binPath = join(__dir, 'ffmpeg-static');
      // Detectar arquitectura
      const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
      const url = `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${arch}-static.tar.xz`;
      execSync(`curl -L "${url}" | tar -xJ --wildcards --strip-components=1 -C "${__dir}" "*/ffmpeg"`, {
        stdio: 'inherit', timeout: 300000
      });
      if (existsSync(join(__dir, 'ffmpeg'))) {
        chmodSync(join(__dir, 'ffmpeg'), '755');
        ffmpegBin = join(__dir, 'ffmpeg');
        console.log('[RTSP] Binario estático de FFmpeg instalado ✓');
        return true;
      }
    } catch (e) {
      console.error('[RTSP] No se pudo descargar binario estático:', e.message);
    }
  }

  // 4. Windows → descargar build de gyan.dev
  if (os === 'win32') {
    const binPath = join(__dir, 'ffmpeg.exe');
    if (existsSync(binPath)) { ffmpegBin = binPath; return true; }
    try {
      console.log('[RTSP] Descargando FFmpeg para Windows...');
      const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
      const zipPath = join(tmpdir(), 'ffmpeg-win.zip');
      execSync(`powershell -Command "Invoke-WebRequest '${url}' -OutFile '${zipPath}'"`, { stdio: 'inherit', timeout: 300000 });
      execSync(`powershell -Command "Expand-Archive '${zipPath}' -DestinationPath '${join(tmpdir(), 'ffmpeg-win')}' -Force"`, { stdio: 'inherit', timeout: 60000 });
      execSync(`powershell -Command "Copy-Item (Get-ChildItem '${join(tmpdir(), 'ffmpeg-win')}' -Recurse -Filter ffmpeg.exe | Select-Object -First 1).FullName '${binPath}'"`, { stdio: 'inherit' });
      if (existsSync(binPath)) {
        ffmpegBin = binPath;
        console.log('[RTSP] FFmpeg para Windows instalado ✓');
        return true;
      }
    } catch (e) {
      console.error('[RTSP] No se pudo instalar FFmpeg en Windows:', e.message);
    }
  }

  console.error('[RTSP] ⚠ FFmpeg no disponible. El conteo RTSP estará desactivado.');
  return false;
}

let ffmpegAvailable = false;

// Importadas dinámicamente para evitar circular en index.js
let _db = null;
async function db() {
  if (!_db) _db = await import('./database.js');
  return _db;
}

// ─── Constantes (idénticas al frontend) ──────────────────────────────────────
const W = 80, H = 60;
const FRAME_SIZE = W * H * 3;        // RGB24
const MIN_BLOB_CELLS = 12;
const MAX_DIST = 0.18;
const CROSSING_COOLDOWN = 2500;      // ms

// ─── Algoritmo de detección ───────────────────────────────────────────────────

function detectBlobs(prev, curr, threshold) {
  const motion = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    const dr = Math.abs(curr[p]   - prev[p]);
    const dg = Math.abs(curr[p+1] - prev[p+1]);
    const db = Math.abs(curr[p+2] - prev[p+2]);
    if ((dr + dg + db) / 3 > threshold) motion[i] = 1;
  }

  // Dilate 1px
  const dil = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (motion[i] || motion[i-1] || motion[i+1] || motion[i-W] || motion[i+W]) dil[i] = 1;
    }
  }

  // BFS blob detection
  const labels = new Int32Array(W * H).fill(-1);
  const blobs = [];
  let nextLabel = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!dil[idx] || labels[idx] >= 0) continue;
      const queue = [idx];
      labels[idx] = nextLabel;
      let count = 0, sumX = 0, sumY = 0;
      while (queue.length) {
        const cur = queue.shift();
        count++;
        sumX += cur % W;
        sumY += Math.floor(cur / W);
        for (const n of [cur-1, cur+1, cur-W, cur+W]) {
          if (n >= 0 && n < W * H && dil[n] && labels[n] < 0) {
            labels[n] = nextLabel;
            queue.push(n);
          }
        }
      }
      if (count >= MIN_BLOB_CELLS) blobs.push({ cx: sumX / count / W, cy: sumY / count / H });
      nextLabel++;
    }
  }
  return blobs;
}

function getSide(line, px, py) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  return (px - line.x1) * dy - (py - line.y1) * dx;
}

function updateTracks(tracks, blobs, line, flip, onCross) {
  const used = new Set();
  for (const track of tracks) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < blobs.length; i++) {
      if (used.has(i)) continue;
      const d = Math.hypot(blobs[i].cx - track.cx, blobs[i].cy - track.cy);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    if (best >= 0 && bestDist < MAX_DIST) {
      const blob = blobs[best];
      used.add(best);
      const prevSide = getSide(line, track.cx, track.cy);
      const currSide = getSide(line, blob.cx, blob.cy);
      if (prevSide !== 0 && currSide !== 0 && Math.sign(prevSide) !== Math.sign(currSide)) {
        const now = Date.now();
        if (!track.lastCross || now - track.lastCross > CROSSING_COOLDOWN) {
          track.lastCross = now;
          let dir = currSide < 0 ? 'in' : 'out';
          if (flip) dir = dir === 'in' ? 'out' : 'in';
          onCross(dir);
        }
      }
      track.cx = blob.cx; track.cy = blob.cy; track.missed = 0;
    } else {
      track.missed = (track.missed || 0) + 1;
    }
  }
  for (let i = 0; i < blobs.length; i++) {
    if (!used.has(i)) tracks.push({ id: Math.random(), cx: blobs[i].cx, cy: blobs[i].cy, missed: 0, lastCross: 0 });
  }
  return tracks.filter(t => t.missed < 5);
}

// ─── Gestión de streams ───────────────────────────────────────────────────────

class RTSPCounterService {
  constructor() {
    this.streams = new Map(); // storeId → state
    this.hlsDir = join(tmpdir(), 'srservi-hls');
    mkdirSync(this.hlsDir, { recursive: true });
  }

  getStatus(storeId) {
    const s = this.streams.get(storeId);
    if (!s) return { running: false };
    return { running: true, in: s.countIn, out: s.countOut, error: s.error || null };
  }

  getHLSDir(storeId) {
    return join(this.hlsDir, String(storeId));
  }

  getSnapshot(storeId) {
    return this.streams.get(storeId)?.snapshot || null;
  }

  async _startStore(storeId, rtspUrl, lineConfig, flip, sensitivity = 30) {
    this.stopStore(storeId);

    const state = {
      rtspUrl, lineConfig, flip, sensitivity,
      tracks: [], prevFrame: null,
      countIn: 0, countOut: 0,
      error: null, snapshot: null,
      ffmpegCount: null, ffmpegSnap: null,
      bufferCount: Buffer.alloc(0),
      bufferSnap: Buffer.alloc(0),
    };

    // ── Proceso 1: frames raw 80×60 para conteo ────────────────────────────
    const ffCount = spawn(ffmpegBin, [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-vf', `fps=2,scale=${W}:${H}`,
      '-f', 'rawvideo', '-pix_fmt', 'rgb24',
      '-loglevel', 'error', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffCount.stdout.on('data', chunk => {
      state.bufferCount = Buffer.concat([state.bufferCount, chunk]);
      while (state.bufferCount.length >= FRAME_SIZE) {
        const frame = state.bufferCount.slice(0, FRAME_SIZE);
        state.bufferCount = state.bufferCount.slice(FRAME_SIZE);
        this._processFrame(storeId, frame, state);
      }
    });

    ffCount.stderr.on('data', d => {
      const msg = d.toString();
      if (msg.toLowerCase().includes('error')) {
        state.error = msg.replace(/\n/g, ' ').slice(0, 150);
        console.error(`[RTSP:${storeId}]`, state.error);
      }
    });

    ffCount.on('exit', code => {
      if (this.streams.has(storeId))
        state.error = state.error || `Stream desconectado (código ${code})`;
    });

    state.ffmpegCount = ffCount;

    // ── Proceso 2: JPEG 640×360 a 1fps → snapshot en memoria ──────────────
    // Detectamos frames JPEG completos por sus marcadores SOI (FFD8) / EOI (FFD9)
    const ffSnap = spawn(ffmpegBin, [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-vf', 'fps=1,scale=640:360',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '5',
      '-loglevel', 'error', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffSnap.stdout.on('data', chunk => {
      state.bufferSnap = Buffer.concat([state.bufferSnap, chunk]);
      // Extraer JPEGs completos (FFD8...FFD9)
      let i = 0;
      while (i < state.bufferSnap.length - 1) {
        if (state.bufferSnap[i] === 0xFF && state.bufferSnap[i + 1] === 0xD8) {
          const end = state.bufferSnap.indexOf(Buffer.from([0xFF, 0xD9]), i + 2);
          if (end === -1) break;
          state.snapshot = state.bufferSnap.slice(i, end + 2);
          i = end + 2;
        } else { i++; }
      }
      state.bufferSnap = state.bufferSnap.slice(i);
    });

    state.ffmpegSnap = ffSnap;
    this.streams.set(storeId, state);
    console.log(`[RTSP:${storeId}] Iniciado → ${rtspUrl}`);
  }

  stopStore(storeId) {
    const state = this.streams.get(storeId);
    if (!state) return;
    try { state.ffmpegCount?.kill('SIGKILL'); } catch {}
    try { state.ffmpegSnap?.kill('SIGKILL'); } catch {}
    this.streams.delete(storeId);
    console.log(`[RTSP:${storeId}] Detenido`);
  }

  _processFrame(storeId, frame, state) {
    if (!state.prevFrame) { state.prevFrame = frame; return; }
    if (!state.lineConfig) { state.prevFrame = frame; return; }

    const blobs = detectBlobs(state.prevFrame, frame, state.sensitivity);
    state.tracks = updateTracks(state.tracks, blobs, state.lineConfig, state.flip, async (dir) => {
      state[dir === 'in' ? 'countIn' : 'countOut']++;
      try {
        const { savePeopleCounterEvent } = await db();
        await savePeopleCounterEvent(storeId, dir, new Date().toISOString());
      } catch (e) {
        console.error(`[RTSP:${storeId}] DB error:`, e.message);
      }
    });
    state.prevFrame = frame;
  }

  // Llamar al arrancar el servidor para reanudar streams activos
  async initAll() {
    // Instalar FFmpeg automáticamente si no está disponible
    ffmpegAvailable = await ensureFFmpeg();
    if (!ffmpegAvailable) return;

    try {
      const { getStoresWithRTSP } = await db();
      const stores = await getStoresWithRTSP();
      for (const s of stores) {
        if (s.rtsp_enabled && s.rtsp_url) {
          const line = s.line_config ? JSON.parse(s.line_config) : null;
          await this.startStore(s.store_id, s.rtsp_url, line, !!s.flip_direction, s.rtsp_sensitivity || 30);
        }
      }
      console.log(`[RTSP] ${stores.filter(s=>s.rtsp_enabled).length} stream(s) iniciados`);
    } catch (e) {
      console.error('[RTSP] initAll error:', e.message);
    }
  }

  async startStore(storeId, rtspUrl, lineConfig, flip, sensitivity = 30) {
    if (!ffmpegAvailable) {
      ffmpegAvailable = await ensureFFmpeg();
      if (!ffmpegAvailable) throw new Error('FFmpeg no disponible');
    }
    return this._startStore(storeId, rtspUrl, lineConfig, flip, sensitivity);
  }
}

export const rtspCounterService = new RTSPCounterService();
