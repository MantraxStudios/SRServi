#!/usr/bin/env node
/**
 * SRServi — Agente Local RTSP
 *
 * Corre en el computador del local (donde está la red con la cámara).
 * Conecta al stream RTSP, detecta cruces de línea y reporta al servidor remoto.
 *
 * Uso:
 *   node local-rtsp-agent.js --server https://srservi2.srautomatic.com --store 1 --token TU_TOKEN
 *
 * O con variables de entorno:
 *   SR_SERVER=https://srservi2.srautomatic.com SR_STORE=1 SR_TOKEN=xxx node local-rtsp-agent.js
 */

import { spawn, execSync, execFileSync } from 'child_process';
import { existsSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Config desde args o env ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
};

const SERVER  = arg('server') || process.env.SR_SERVER || 'https://srservi2.srautomatic.com';
const STORE   = parseInt(arg('store')  || process.env.SR_STORE  || '0');
const TOKEN   = arg('token')  || process.env.SR_TOKEN  || '';

if (!STORE || !TOKEN) {
  console.error('Uso: node local-rtsp-agent.js --server URL --store ID --token TOKEN');
  console.error('');
  console.error('Obtén tu token desde el panel admin → perfil → copiar token');
  process.exit(1);
}

console.log(`\n🎥 SRServi Agente Local RTSP`);
console.log(`   Servidor : ${SERVER}`);
console.log(`   Tienda   : ${STORE}`);
console.log(`   Token    : ${TOKEN.slice(0, 20)}...`);
console.log('');

// ─── Algoritmo de detección (igual que browser y servidor) ────────────────────
const W = 80, H = 60, FRAME_SIZE = W * H * 3;
const MIN_BLOB = 12, MAX_DIST = 0.18, COOLDOWN = 2500;

function detectBlobs(prev, curr, threshold) {
  const motion = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    if ((Math.abs(curr[p]-prev[p]) + Math.abs(curr[p+1]-prev[p+1]) + Math.abs(curr[p+2]-prev[p+2])) / 3 > threshold)
      motion[i] = 1;
  }
  const dil = new Uint8Array(W * H);
  for (let y = 1; y < H-1; y++)
    for (let x = 1; x < W-1; x++) {
      const i = y*W+x;
      if (motion[i]||motion[i-1]||motion[i+1]||motion[i-W]||motion[i+W]) dil[i]=1;
    }
  const labels = new Int32Array(W*H).fill(-1);
  const blobs = [];
  let nl = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const idx = y*W+x;
      if (!dil[idx]||labels[idx]>=0) continue;
      const q=[idx]; labels[idx]=nl;
      let cnt=0,sx=0,sy=0;
      while(q.length){ const c=q.shift(); cnt++; sx+=c%W; sy+=Math.floor(c/W);
        for(const n of[c-1,c+1,c-W,c+W]) if(n>=0&&n<W*H&&dil[n]&&labels[n]<0){labels[n]=nl;q.push(n);} }
      if(cnt>=MIN_BLOB) blobs.push({cx:sx/cnt/W,cy:sy/cnt/H});
      nl++;
    }
  return blobs;
}

function getSide(line,px,py){ return (line.x2-line.x1)*(py-line.y1)-(line.y2-line.y1)*(px-line.x1); }

function updateTracks(tracks, blobs, line, flip, onCross) {
  const used = new Set();
  for (const t of tracks) {
    let best=-1,bd=Infinity;
    for(let i=0;i<blobs.length;i++){if(used.has(i))continue;const d=Math.hypot(blobs[i].cx-t.cx,blobs[i].cy-t.cy);if(d<bd){bd=d;best=i;}}
    if(best>=0&&bd<MAX_DIST){
      const b=blobs[best]; used.add(best);
      const ps=getSide(line,t.cx,t.cy),cs=getSide(line,b.cx,b.cy);
      if(ps!==0&&cs!==0&&Math.sign(ps)!==Math.sign(cs)){
        const now=Date.now();
        if(!t.lastCross||now-t.lastCross>COOLDOWN){
          t.lastCross=now;
          let dir=cs<0?'in':'out';
          if(flip) dir=dir==='in'?'out':'in';
          onCross(dir);
        }
      }
      t.cx=b.cx;t.cy=b.cy;t.missed=0;
    } else { t.missed=(t.missed||0)+1; }
  }
  for(let i=0;i<blobs.length;i++) if(!used.has(i)) tracks.push({cx:blobs[i].cx,cy:blobs[i].cy,missed:0,lastCross:0});
  return tracks.filter(t=>t.missed<5);
}

// ─── FFmpeg auto-install ───────────────────────────────────────────────────────
let ffmpegBin = 'ffmpeg';

async function ensureFFmpeg() {
  try { execFileSync('ffmpeg',['-version'],{stdio:'ignore',timeout:5000}); return true; } catch {}
  const os = platform();
  if (os==='linux'||os==='darwin') {
    try {
      const hasPkg = c => { try{execSync(`which ${c}`,{stdio:'ignore'});return true;}catch{return false;} };
      if(hasPkg('apt-get')) execSync('apt-get update -qq && apt-get install -y ffmpeg',{stdio:'inherit',timeout:180000});
      else if(hasPkg('brew')) execSync('brew install ffmpeg',{stdio:'inherit',timeout:300000});
      execFileSync('ffmpeg',['-version'],{stdio:'ignore'});
      return true;
    } catch {}
  }
  if (os==='win32') {
    const bin = join(__dir,'ffmpeg.exe');
    if(existsSync(bin)){ffmpegBin=bin;return true;}
    try {
      const url='https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
      const zip=join(require('os').tmpdir(),'ffmpeg-win.zip');
      execSync(`powershell -Command "Invoke-WebRequest '${url}' -OutFile '${zip}'"`,{stdio:'inherit',timeout:300000});
      execSync(`powershell -Command "Expand-Archive '${zip}' -DestinationPath '${join(require('os').tmpdir(),'ffmpeg-win')}' -Force"`,{stdio:'inherit'});
      execSync(`powershell -Command "Copy-Item (Get-ChildItem '${join(require('os').tmpdir(),'ffmpeg-win')}' -Recurse -Filter ffmpeg.exe | Select-Object -First 1).FullName '${bin}'"`,{stdio:'inherit'});
      if(existsSync(bin)){ffmpegBin=bin;return true;}
    } catch {}
  }
  return false;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(`${SERVER}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function uploadSnapshot(jpegBuffer) {
  const r = await fetch(`${SERVER}/api/stores/${STORE}/people-counter/snapshot-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${TOKEN}` },
    body: jpegBuffer,
  });
  // silenciar errores de snapshot
}

// ─── Main ─────────────────────────────────────────────────────────────────────
let tracks = [], prevFrame = null;
let config = null;
let ffCount = null, ffSnap = null;
let bufCount = Buffer.alloc(0), bufSnap = Buffer.alloc(0);

async function loadConfig() {
  try {
    const rtsp = await apiGet(`/api/stores/${STORE}/people-counter/rtsp`);
    const counter = await apiGet(`/api/stores/${STORE}/people-counter/config`);
    config = {
      rtspUrl: rtsp.rtsp_url,
      enabled: rtsp.rtsp_enabled,
      sensitivity: rtsp.rtsp_sensitivity || 30,
      line: counter?.line || null,
      flip: counter?.flip || false,
    };
    return config;
  } catch (e) {
    console.error('Error al obtener config:', e.message);
    return null;
  }
}

function stopProcesses() {
  try { ffCount?.kill('SIGKILL'); } catch {}
  try { ffSnap?.kill('SIGKILL'); } catch {}
  ffCount = null; ffSnap = null;
  bufCount = Buffer.alloc(0); bufSnap = Buffer.alloc(0);
  prevFrame = null; tracks = [];
}

function startProcesses(cfg) {
  stopProcesses();
  const url = cfg.rtspUrl;

  // Proceso 1: conteo (80×60 raw)
  ffCount = spawn(ffmpegBin, [
    '-rtsp_transport','tcp','-i',url,
    '-vf',`fps=2,scale=${W}:${H}`,
    '-f','rawvideo','-pix_fmt','rgb24',
    '-loglevel','error','pipe:1',
  ], { stdio:['ignore','pipe','pipe'] });

  ffCount.stdout.on('data', chunk => {
    bufCount = Buffer.concat([bufCount, chunk]);
    while (bufCount.length >= FRAME_SIZE) {
      const frame = bufCount.slice(0, FRAME_SIZE);
      bufCount = bufCount.slice(FRAME_SIZE);
      if (!prevFrame) { prevFrame = frame; return; }
      if (!cfg.line) { prevFrame = frame; return; }
      const blobs = detectBlobs(prevFrame, frame, cfg.sensitivity);
      tracks = updateTracks(tracks, blobs, cfg.line, cfg.flip, dir => {
        console.log(`  → ${dir === 'in' ? '↓ Entrada' : '↑ Salida'} detectada`);
        apiPost(`/api/stores/${STORE}/people-counter/event`, { direction: dir, crossed_at: new Date().toISOString() }).catch(() => {});
      });
      prevFrame = frame;
    }
  });

  ffCount.stderr.on('data', d => process.stderr.write(`[count] ${d}`));
  ffCount.on('exit', code => console.log(`[count] FFmpeg salió con código ${code}`));

  // Proceso 2: snapshot JPEG 1fps
  ffSnap = spawn(ffmpegBin, [
    '-rtsp_transport','tcp','-i',url,
    '-vf','fps=1,scale=640:360',
    '-f','image2pipe','-vcodec','mjpeg','-q:v','5',
    '-loglevel','error','pipe:1',
  ], { stdio:['ignore','pipe','pipe'] });

  ffSnap.stdout.on('data', chunk => {
    bufSnap = Buffer.concat([bufSnap, chunk]);
    let i = 0;
    while (i < bufSnap.length - 1) {
      if (bufSnap[i]===0xFF && bufSnap[i+1]===0xD8) {
        const end = bufSnap.indexOf(Buffer.from([0xFF,0xD9]), i+2);
        if (end===-1) break;
        uploadSnapshot(bufSnap.slice(i, end+2));
        i = end+2;
      } else i++;
    }
    bufSnap = bufSnap.slice(i);
  });

  console.log(`✅ Conectando a ${url.replace(/:([^@]+)@/,':***@')}…`);
}

async function main() {
  console.log('🔧 Verificando FFmpeg…');
  const ok = await ensureFFmpeg();
  if (!ok) { console.error('❌ FFmpeg no disponible. Instálalo desde https://ffmpeg.org/download.html'); process.exit(1); }
  console.log('✅ FFmpeg listo\n');

  const cfg = await loadConfig();
  if (!cfg) { console.error('❌ No se pudo obtener la configuración del servidor'); process.exit(1); }
  if (!cfg.enabled || !cfg.rtspUrl) {
    console.log('⚠  Stream RTSP no activado en el panel admin. Actívalo y vuelve a ejecutar.');
    process.exit(0);
  }

  startProcesses(cfg);

  // Re-cargar config cada 60s por si cambia en el panel
  setInterval(async () => {
    const newCfg = await loadConfig();
    if (!newCfg?.enabled || !newCfg?.rtspUrl) { stopProcesses(); return; }
    if (newCfg.rtspUrl !== cfg.rtspUrl) {
      Object.assign(cfg, newCfg);
      console.log('🔄 Config actualizada, reiniciando stream…');
      startProcesses(cfg);
    } else {
      Object.assign(cfg, newCfg);
    }
  }, 60000);

  console.log('\nPresiona Ctrl+C para detener.\n');
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
