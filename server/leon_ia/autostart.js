/**
 * León IA — Autoarranque completo en Linux
 * Usa spawn con streaming para mostrar progreso en tiempo real.
 * Venv propio en server/leon_ia/venv/ — independiente de bg_remover.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const LEON_DIR   = __dirname;
const VENV_DIR   = path.join(LEON_DIR, 'venv');          // venv propio, separado de bg_remover
const PYTHON_BIN = path.join(VENV_DIR, 'bin', 'python3');
const PIP_BIN    = path.join(VENV_DIR, 'bin', 'pip');
const MAIN_PY    = path.join(LEON_DIR, 'main.py');
const REQ_TXT    = path.join(LEON_DIR, 'requirements.txt');

const OLLAMA_PORT = 11434;
const LEON_PORT   = 7777;
const MODEL       = 'qwen2.5:3b'; // ~2 GB

let pythonProc = null;

const log  = (msg) => console.log(`[León IA] ${msg}`);
const warn = (msg) => console.warn(`[León IA] ⚠ ${msg}`);

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Ejecuta un comando con output en tiempo real. Resuelve con el exit code. */
function spawnStream(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: false,
      ...opts,
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/** Ejecuta un comando de shell (string) con output en tiempo real. */
function shellStream(cmd, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      stdio: ['ignore', 'inherit', 'inherit'],
      ...opts,
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/** Comprueba si un comando existe en el PATH. */
async function commandExists(cmd) {
  return new Promise((resolve) => {
    const p = spawn('which', [cmd], { stdio: 'ignore' });
    p.on('close', (c) => resolve(c === 0));
    p.on('error', () => resolve(false));
  });
}

/** Comprueba si un puerto está escuchando. */
async function isPortOpen(port) {
  return new Promise((resolve) => {
    const p = spawn('sh', ['-c', `ss -tlnp 2>/dev/null | grep -q :${port}`], { stdio: 'ignore' });
    p.on('close', (c) => resolve(c === 0));
    p.on('error', () => resolve(false));
  });
}

/** Espera N segundos. */
const sleep = (s) => new Promise(r => setTimeout(r, s * 1000));

/** Espera hasta que un puerto abra, con timeout en segundos. */
async function waitForPort(port, timeoutSec = 30) {
  for (let i = 0; i < timeoutSec; i++) {
    if (await isPortOpen(port)) return true;
    await sleep(1);
  }
  return false;
}

// ── 1. Instalar Ollama ────────────────────────────────────────────────────────
async function ensureOllama() {
  if (await commandExists('ollama')) {
    log('Ollama ya instalado ✓');
    return true;
  }
  log('Instalando Ollama (mostrando progreso)...');
  const ok = await shellStream('curl -fsSL https://ollama.com/install.sh | sh');
  if (ok) { log('Ollama instalado ✓'); return true; }
  warn('No se pudo instalar Ollama');
  return false;
}

// ── 2. Arrancar ollama serve ──────────────────────────────────────────────────
async function ensureOllamaRunning() {
  if (await isPortOpen(OLLAMA_PORT)) {
    log('Ollama ya corriendo ✓');
    return true;
  }
  log('Iniciando ollama serve...');
  const proc = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HOME: process.env.HOME || '/root' },
  });
  proc.unref();

  const up = await waitForPort(OLLAMA_PORT, 20);
  if (up) { log('ollama serve listo ✓'); return true; }
  warn('ollama serve no respondió');
  return false;
}

// ── 3. Descargar modelo ───────────────────────────────────────────────────────
async function ensureModel() {
  // Verificar si ya existe algún modelo qwen2.5
  const checkProc = await new Promise((resolve) => {
    let out = '';
    const p = spawn('ollama', ['list'], { stdio: ['ignore', 'pipe', 'ignore'] });
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
  });

  if (checkProc.includes('qwen2.5')) {
    log('Modelo qwen2.5 disponible ✓');
    return true;
  }

  log(`Descargando modelo ${MODEL}... (puede tardar varios minutos, muestra progreso abajo)`);
  const ok = await spawnStream('ollama', ['pull', MODEL]);
  if (ok) { log(`Modelo ${MODEL} listo ✓`); return true; }
  warn(`Error al descargar ${MODEL}`);
  return false;
}

// ── 4. Entorno Python propio ──────────────────────────────────────────────────
async function ensurePythonEnv() {
  // Detectar python3
  if (!await commandExists('python3')) {
    log('Instalando python3...');
    const ok = await shellStream(
      'apt-get install -y python3 python3-venv python3-pip 2>/dev/null || ' +
      'yum install -y python3 python3-pip 2>/dev/null || true'
    );
    if (!ok || !await commandExists('python3')) {
      warn('No se pudo instalar python3'); return false;
    }
  }

  // Crear venv en server/leon_ia/venv/ (separado de bg_remover)
  if (!existsSync(PYTHON_BIN)) {
    log(`Creando venv Python en ${VENV_DIR} ...`);
    const ok = await spawnStream('python3', ['-m', 'venv', VENV_DIR]);
    if (!ok) { warn('Error creando venv'); return false; }
    log('Venv León IA creado ✓');
  } else {
    log('Venv León IA ya existe ✓');
  }

  // Actualizar pip
  await spawnStream(PIP_BIN, ['install', '--quiet', '--upgrade', 'pip']);

  // Instalar dependencias
  log('Instalando dependencias Python (fastapi, uvicorn, mysql-connector...)');
  const ok = await spawnStream(PIP_BIN, ['install', '-r', REQ_TXT]);
  if (!ok) { warn('Error instalando dependencias Python'); return false; }
  log('Dependencias Python instaladas ✓');
  return true;
}

// ── 5. Lanzar FastAPI ─────────────────────────────────────────────────────────
async function startPythonService() {
  if (await isPortOpen(LEON_PORT)) {
    log('Servicio León IA ya corriendo ✓');
    return true;
  }

  log(`Lanzando León IA FastAPI en puerto ${LEON_PORT}...`);
  pythonProc = spawn(PYTHON_BIN, [MAIN_PY], {
    cwd: LEON_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Mostrar logs del servicio Python con prefijo
  pythonProc.stdout.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(l => log(`  ${l}`));
  });
  pythonProc.stderr.on('data', d => {
    d.toString().split('\n').filter(Boolean).forEach(l => {
      if (!l.includes('INFO:') && !l.includes('Uvicorn')) warn(`  ${l}`);
    });
  });
  pythonProc.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      warn(`Servicio Python terminó (code=${code}). Reiniciando en 15s...`);
      pythonProc = null;
      setTimeout(startPythonService, 15000);
    }
  });
  pythonProc.on('error', e => warn(`Error proceso Python: ${e.message}`));

  const up = await waitForPort(LEON_PORT, 25);
  if (up) { log('León IA Python listo ✓ — Ollama responde preguntas naturales'); return true; }
  warn('FastAPI no respondió a tiempo');
  return false;
}

// ── Función principal exportada ───────────────────────────────────────────────
export async function initLeonIA() {
  log('=== Configuración automática de León IA ===');

  if (!await ensureOllama())          { warn('Sin Ollama → usando sistema clásico'); return; }
  if (!await ensureOllamaRunning())   { warn('Ollama no arrancó → usando sistema clásico'); return; }
  if (!await ensureModel())           { warn('Sin modelo → usando sistema clásico'); return; }
  if (!await ensurePythonEnv())       { warn('Sin Python env → usando sistema clásico'); return; }
  if (!await startPythonService())    { warn('FastAPI no arrancó → usando sistema clásico'); return; }

  log('=== León IA completamente operativo ===');
}

// ── Limpieza al cerrar ────────────────────────────────────────────────────────
function cleanup() {
  if (pythonProc) { pythonProc.kill('SIGTERM'); pythonProc = null; }
}
process.on('exit',    cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
