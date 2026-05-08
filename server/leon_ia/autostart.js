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
const VENV_DIR   = path.join(LEON_DIR, 'venv');
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

/** Ejecuta un comando con output en tiempo real. Resuelve con true/false. */
function spawnStream(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: false,
      ...opts,
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', (e) => { warn(`Error ejecutando ${cmd}: ${e.message}`); resolve(false); });
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
    proc.on('error', (e) => { warn(`Error en shell: ${e.message}`); resolve(false); });
  });
}

/**
 * Envuelve una promesa y muestra un heartbeat cada intervalSec segundos.
 * Útil para comandos que descargan archivos y no muestran progreso en no-TTY.
 */
function withHeartbeat(promise, label, intervalSec = 15) {
  let secs = 0;
  const t = setInterval(() => {
    secs += intervalSec;
    log(`  ⏳ ${label}... (${secs}s)`);
  }, intervalSec * 1000);
  return promise.finally(() => clearInterval(t));
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

/** Espera hasta que un puerto abra, con logs de progreso. */
async function waitForPort(port, timeoutSec = 30) {
  for (let i = 0; i < timeoutSec; i++) {
    if (await isPortOpen(port)) return true;
    if (i > 0 && i % 5 === 0) log(`  ⏳ Esperando puerto ${port}... (${i}s)`);
    await sleep(1);
  }
  return false;
}

// ── 1. Instalar Ollama ────────────────────────────────────────────────────────
async function ensureOllama() {
  // Asegurar que /usr/local/bin está en el PATH del proceso
  if (!process.env.PATH.includes('/usr/local/bin')) {
    process.env.PATH = `/usr/local/bin:${process.env.PATH}`;
  }

  if (await commandExists('ollama')) {
    log('Ollama ya instalado ✓');
    return true;
  }

  log('Descargando e instalando Ollama (esto puede tardar 1-2 min sin output visible)...');
  const ok = await withHeartbeat(
    shellStream('curl -fsSL https://ollama.com/install.sh | sh'),
    'instalando Ollama'
  );

  // Actualizar PATH por si el installer lo puso en /usr/local/bin
  process.env.PATH = `/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`;

  if (ok) { log('Ollama instalado ✓'); return true; }
  warn('No se pudo instalar Ollama');
  return false;
}

// ── 2. Arrancar ollama serve ──────────────────────────────────────────────────
async function ensureOllamaRunning() {
  if (await isPortOpen(OLLAMA_PORT)) {
    log('Ollama ya corriendo en puerto 11434 ✓');
    return true;
  }

  log('Iniciando ollama serve en background...');
  const proc = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HOME: process.env.HOME || '/root' },
  });
  proc.unref();

  log('Esperando que Ollama abra el puerto 11434...');
  const up = await waitForPort(OLLAMA_PORT, 30);
  if (up) { log('ollama serve listo en puerto 11434 ✓'); return true; }
  warn('ollama serve no respondió en 30s');
  return false;
}

// ── 3. Descargar modelo ───────────────────────────────────────────────────────
async function ensureModel() {
  log('Verificando modelos instalados...');
  const checkProc = await new Promise((resolve) => {
    let out = '';
    const p = spawn('ollama', ['list'], { stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', d => { out += d.toString(); });
    p.stderr.on('data', d => { out += d.toString(); });
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
  });

  log(`  Modelos disponibles: ${checkProc.trim() || '(ninguno)'}`);

  if (checkProc.includes('qwen2.5')) {
    log('Modelo qwen2.5 disponible ✓');
    return true;
  }

  log(`Descargando modelo ${MODEL} (~2GB, puede tardar varios minutos)...`);
  log('  El progreso aparece abajo. Si no ves barras, el servidor lo está procesando en silencio.');
  const ok = await withHeartbeat(
    spawnStream('ollama', ['pull', MODEL]),
    `descargando ${MODEL}`
  );
  if (ok) { log(`Modelo ${MODEL} descargado y listo ✓`); return true; }
  warn(`Error al descargar ${MODEL}`);
  return false;
}

// ── 4. Entorno Python propio ──────────────────────────────────────────────────
async function ensurePythonEnv() {
  log('Verificando Python3...');
  if (!await commandExists('python3')) {
    log('Instalando python3 (apt/yum)...');
    const ok = await withHeartbeat(
      shellStream(
        'apt-get install -y python3 python3-venv python3-pip 2>/dev/null || ' +
        'yum install -y python3 python3-pip 2>/dev/null || true'
      ),
      'instalando python3'
    );
    if (!ok || !await commandExists('python3')) {
      warn('No se pudo instalar python3'); return false;
    }
  }
  log('Python3 disponible ✓');

  if (!existsSync(PYTHON_BIN)) {
    log(`Creando entorno virtual Python en ${VENV_DIR} ...`);
    const ok = await spawnStream('python3', ['-m', 'venv', VENV_DIR]);
    if (!ok) { warn('Error creando venv'); return false; }
    log('Venv León IA creado ✓');
  } else {
    log('Venv León IA ya existe ✓');
  }

  log('Actualizando pip...');
  await spawnStream(PIP_BIN, ['install', '--quiet', '--upgrade', 'pip']);

  log('Instalando dependencias Python (fastapi, uvicorn, mysql-connector, httpx)...');
  const ok = await withHeartbeat(
    spawnStream(PIP_BIN, ['install', '-r', REQ_TXT]),
    'instalando dependencias Python'
  );
  if (!ok) { warn('Error instalando dependencias Python'); return false; }
  log('Dependencias Python instaladas ✓');
  return true;
}

// ── 5. Lanzar FastAPI ─────────────────────────────────────────────────────────
async function startPythonService() {
  if (await isPortOpen(LEON_PORT)) {
    log('Servicio León IA ya corriendo en puerto 7777 ✓');
    return true;
  }

  log(`Lanzando León IA FastAPI en puerto ${LEON_PORT}...`);
  pythonProc = spawn(PYTHON_BIN, [MAIN_PY], {
    cwd: LEON_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

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

  log('Esperando que FastAPI abra el puerto 7777...');
  const up = await waitForPort(LEON_PORT, 30);
  if (up) { log('León IA Python listo en puerto 7777 ✓ — Ollama responde preguntas en lenguaje natural'); return true; }
  warn('FastAPI no respondió en 30s');
  return false;
}

// ── Función principal exportada ───────────────────────────────────────────────
export async function initLeonIA() {
  log('=== Iniciando configuración automática de León IA ===');

  log('[Paso 1/5] Verificando Ollama...');
  if (!await ensureOllama())        { warn('Sin Ollama → León IA usará sistema clásico'); return; }

  log('[Paso 2/5] Verificando ollama serve...');
  if (!await ensureOllamaRunning()) { warn('Ollama no arrancó → León IA usará sistema clásico'); return; }

  log('[Paso 3/5] Verificando modelo de IA...');
  if (!await ensureModel())         { warn('Sin modelo → León IA usará sistema clásico'); return; }

  log('[Paso 4/5] Verificando entorno Python...');
  if (!await ensurePythonEnv())     { warn('Sin Python env → León IA usará sistema clásico'); return; }

  log('[Paso 5/5] Lanzando servicio FastAPI...');
  if (!await startPythonService())  { warn('FastAPI no arrancó → León IA usará sistema clásico'); return; }

  log('=== León IA completamente operativo — responde cualquier pregunta en español ===');
}

// ── Limpieza al cerrar ────────────────────────────────────────────────────────
function cleanup() {
  if (pythonProc) { pythonProc.kill('SIGTERM'); pythonProc = null; }
}
process.on('exit',    cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
