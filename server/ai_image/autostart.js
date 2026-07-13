/**
 * Servicio de generación de imágenes con IA (FLUX.1-schnell, open source)
 * Mismo patrón que León IA / Instagram: venv propio, instala deps, lanza uvicorn.
 * Cross-platform (Windows para desarrollo, Linux para producción).
 */

import { spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = __dirname;
const VENV_DIR    = path.join(SERVICE_DIR, 'venv');
const IS_WIN      = process.platform === 'win32';
const PYTHON_BIN  = IS_WIN
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python3');
const PIP_BIN     = IS_WIN
  ? path.join(VENV_DIR, 'Scripts', 'pip.exe')
  : path.join(VENV_DIR, 'bin', 'pip');
const MAIN_PY       = path.join(SERVICE_DIR, 'main.py');
const REQ_TXT       = path.join(SERVICE_DIR, 'requirements.txt');
const AI_IMAGE_PORT = parseInt(process.env.AI_IMAGE_PORT || '8788', 10);

let pyProc = null;

const log  = (msg) => console.log(`[AI-Image] ${msg}`);
const warn = (msg) => console.warn(`[AI-Image] ⚠ ${msg}`);

function spawnStream(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], shell: false, ...opts });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', (e) => { warn(`Error ejecutando ${cmd}: ${e.message}`); resolve(false); });
  });
}

/** Envuelve una promesa y muestra un heartbeat cada intervalSec segundos. */
function withHeartbeat(promise, label, intervalSec = 15) {
  let secs = 0;
  const t = setInterval(() => { secs += intervalSec; log(`  ⏳ ${label}... (${secs}s)`); }, intervalSec * 1000);
  return promise.finally(() => clearInterval(t));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => { socket.end(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutSec = 30) {
  const sleep = (s) => new Promise(r => setTimeout(r, s * 1000));
  for (let i = 0; i < timeoutSec; i++) {
    if (await isPortOpen(port)) return true;
    if (i > 0 && i % 5 === 0) log(`  ⏳ Esperando puerto ${port}... (${i}s)`);
    await sleep(1);
  }
  return false;
}

/** En Windows, `python3`/`python` pueden resolver al stub falso de la Microsoft
 * Store (App Execution Alias) que no ejecuta nada real. Confirmamos que el
 * comando funcione de verdad revisando la salida de `--version`. */
function realPythonVersion(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { out += d.toString(); });
    proc.on('close', () => resolve(/^Python \d/.test(out.trim()) ? out.trim() : null));
    proc.on('error', () => resolve(null));
  });
}

async function findPythonCmd() {
  for (const cmd of IS_WIN ? ['python', 'python3'] : ['python3', 'python']) {
    if (await realPythonVersion(cmd)) return cmd;
  }
  return null;
}

/** Detecta GPU NVIDIA (para instalar torch con soporte CUDA en vez de CPU-only). */
async function hasNvidiaGpu() {
  return new Promise((resolve) => {
    const p = spawn('nvidia-smi', ['-L'], { stdio: 'ignore' });
    p.on('close', (c) => resolve(c === 0));
    p.on('error', () => resolve(false));
  });
}

async function ensurePythonEnv() {
  if (existsSync(VENV_DIR) && (!existsSync(PYTHON_BIN) || !existsSync(PIP_BIN))) {
    warn('Venv incompleto — recreando...');
    try { rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
  }

  if (!existsSync(PYTHON_BIN)) {
    const pyCmd = await findPythonCmd();
    if (!pyCmd) { warn('No se encontró Python en el sistema'); return false; }

    log(`Creando entorno virtual en ${VENV_DIR} ...`);
    const ok = await spawnStream(pyCmd, ['-m', 'venv', VENV_DIR]);
    if (!ok || !existsSync(PYTHON_BIN)) {
      warn('Error creando venv');
      try { rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
      return false;
    }
    log('Venv creado ✓');
  } else {
    log('Venv ya existe ✓');
  }

  log('Actualizando pip...');
  await spawnStream(PYTHON_BIN, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);

  // torch: con GPU NVIDIA instala el build con soporte CUDA (mucho más rápido);
  // sin GPU usa el índice CPU-only, que evita bajar los kernels CUDA (varios GB) de más.
  const gpu = await hasNvidiaGpu();
  log(gpu ? 'GPU NVIDIA detectada ✓ — instalando torch con soporte CUDA...' : 'Sin GPU NVIDIA — instalando torch (CPU)...');
  log('  puede tardar varios minutos la primera vez');
  const torchArgs = gpu
    ? ['-m', 'pip', 'install', 'torch']
    : ['-m', 'pip', 'install', 'torch', '--index-url', 'https://download.pytorch.org/whl/cpu'];
  const torchOk = await withHeartbeat(
    spawnStream(PYTHON_BIN, torchArgs),
    `instalando torch (${gpu ? 'CUDA' : 'CPU'})`
  );
  if (!torchOk) { warn('Error instalando torch'); return false; }

  log('Instalando dependencias (diffusers, transformers, fastapi)...');
  const ok = await withHeartbeat(
    spawnStream(PYTHON_BIN, ['-m', 'pip', 'install', '-r', REQ_TXT]),
    'instalando dependencias'
  );
  if (!ok) { warn('Error instalando dependencias'); return false; }
  log('Dependencias instaladas ✓');
  return true;
}

async function launchService() {
  if (await isPortOpen(AI_IMAGE_PORT)) {
    log(`Servicio ya corriendo en puerto ${AI_IMAGE_PORT} ✓`);
    return true;
  }

  log(`Lanzando servicio de imágenes IA en puerto ${AI_IMAGE_PORT}...`);
  pyProc = spawn(PYTHON_BIN, [MAIN_PY], {
    cwd: SERVICE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AI_IMAGE_PORT: String(AI_IMAGE_PORT) },
  });

  pyProc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => log(`  ${l}`)));
  pyProc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => {
    if (!l.includes('INFO:') && !l.includes('Uvicorn')) warn(`  ${l}`);
  }));
  pyProc.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      warn(`Servicio terminó (code=${code}). Reiniciando en 15s...`);
      pyProc = null;
      setTimeout(launchService, 15000);
    }
  });
  pyProc.on('error', e => warn(`Error proceso: ${e.message}`));

  log(`Esperando que el servicio abra el puerto ${AI_IMAGE_PORT}...`);
  const up = await waitForPort(AI_IMAGE_PORT, 30);
  if (up) { log(`Servicio de imágenes IA listo en puerto ${AI_IMAGE_PORT} ✓ (el modelo se descarga en segundo plano la primera vez)`); return true; }
  warn('El servicio no respondió en 30s');
  return false;
}

export async function initAiImageService() {
  log('=== Iniciando servicio de generación de imágenes con IA (FLUX.1-schnell) ===');
  if (!await ensurePythonEnv()) { warn('Sin entorno Python — generación de imágenes IA no disponible'); return; }
  await launchService();
}

function cleanup() {
  if (pyProc) { pyProc.kill('SIGTERM'); pyProc = null; }
}
process.on('exit',    cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
