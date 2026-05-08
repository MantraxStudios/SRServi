/**
 * León IA — Autoarranque completo en Linux
 * Se invoca desde server/index.js al iniciar.
 * Todo corre en background; no bloquea el servidor.
 */

import { spawn, exec as execCb } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const exec = promisify(execCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEON_DIR     = __dirname;
const VENV_DIR     = path.join(LEON_DIR, 'venv');
const PYTHON_BIN   = path.join(VENV_DIR, 'bin', 'python3');
const PIP_BIN      = path.join(VENV_DIR, 'bin', 'pip');
const MAIN_PY      = path.join(LEON_DIR, 'main.py');
const REQ_TXT      = path.join(LEON_DIR, 'requirements.txt');
const OLLAMA_PORT  = 11434;
const LEON_PORT    = 7777;
const MODEL        = 'qwen2.5:3b'; // ~2 GB, rápido y capaz en español

let pythonProc = null;
let ollamaProc = null;

function log(msg)  { console.log(`[León IA] ${msg}`); }
function warn(msg) { console.warn(`[León IA] ⚠ ${msg}`); }

async function runSilent(cmd, opts = {}) {
  try { await exec(cmd, { timeout: 30000, ...opts }); return true; }
  catch { return false; }
}

async function isCommandAvailable(cmd) {
  return runSilent(`which ${cmd}`);
}

async function isPortOpen(port) {
  try {
    const { stdout } = await exec(`ss -tlnp 2>/dev/null | grep :${port} || true`);
    return stdout.includes(`:${port}`);
  } catch { return false; }
}

// ── 1. Instalar Ollama ────────────────────────────────────────────────────────
async function ensureOllama() {
  if (await isCommandAvailable('ollama')) {
    log('Ollama ya instalado ✓');
    return true;
  }
  log('Instalando Ollama...');
  try {
    await exec('curl -fsSL https://ollama.com/install.sh | sh', { timeout: 300000 });
    log('Ollama instalado ✓');
    return true;
  } catch (e) {
    warn(`No se pudo instalar Ollama: ${e.message}`);
    return false;
  }
}

// ── 2. Arrancar ollama serve ──────────────────────────────────────────────────
async function ensureOllamaRunning() {
  if (await isPortOpen(OLLAMA_PORT)) {
    log('Ollama ya corriendo ✓');
    return true;
  }
  log('Iniciando ollama serve...');
  ollamaProc = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  ollamaProc.unref();
  // Esperar hasta 15 s a que levante
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await isPortOpen(OLLAMA_PORT)) { log('Ollama serve listo ✓'); return true; }
  }
  warn('Ollama no respondió a tiempo');
  return false;
}

// ── 3. Descargar modelo si no está ───────────────────────────────────────────
async function ensureModel() {
  try {
    const { stdout } = await exec('ollama list 2>/dev/null || true', { timeout: 10000 });
    if (stdout.includes('qwen2.5')) { log(`Modelo disponible ✓`); return true; }
  } catch {}
  log(`Descargando modelo ${MODEL} (puede tardar varios minutos)...`);
  try {
    await exec(`ollama pull ${MODEL}`, { timeout: 1800000 }); // 30 min máximo
    log(`Modelo ${MODEL} listo ✓`);
    return true;
  } catch (e) {
    warn(`Error descargando modelo: ${e.message}`);
    return false;
  }
}

// ── 4. Preparar entorno Python ────────────────────────────────────────────────
async function ensurePythonEnv() {
  // Detectar python3
  const hasPy3 = await isCommandAvailable('python3');
  if (!hasPy3) {
    warn('python3 no encontrado. Instalando...');
    const ok = await runSilent(
      'apt-get install -y python3 python3-venv python3-pip 2>/dev/null || ' +
      'yum install -y python3 python3-venv python3-pip 2>/dev/null || true',
      { timeout: 120000 }
    );
    if (!ok || !await isCommandAvailable('python3')) {
      warn('No se pudo instalar python3'); return false;
    }
  }

  // Crear venv si no existe
  if (!existsSync(PYTHON_BIN)) {
    log('Creando entorno virtual Python...');
    const ok = await runSilent(`python3 -m venv ${VENV_DIR}`, { timeout: 60000 });
    if (!ok) { warn('No se pudo crear venv'); return false; }
  }

  // Instalar / actualizar dependencias
  log('Instalando dependencias Python...');
  await runSilent(`${PIP_BIN} install --quiet --upgrade pip`, { timeout: 60000 });
  const ok = await runSilent(
    `${PIP_BIN} install --quiet -r ${REQ_TXT}`,
    { timeout: 180000 }
  );
  if (!ok) { warn('Error instalando dependencias'); return false; }
  log('Dependencias Python listas ✓');
  return true;
}

// ── 5. Lanzar servicio FastAPI ────────────────────────────────────────────────
async function startPythonService() {
  if (await isPortOpen(LEON_PORT)) {
    log('Servicio León IA ya corriendo ✓');
    return true;
  }
  log(`Iniciando León IA Python en puerto ${LEON_PORT}...`);
  pythonProc = spawn(PYTHON_BIN, [MAIN_PY], {
    cwd: LEON_DIR,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  pythonProc.stdout.on('data', d => log(d.toString().trim()));
  pythonProc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg && !msg.includes('INFO')) warn(msg);
  });
  pythonProc.on('exit', (code) => {
    if (code !== 0) {
      warn(`Servicio Python terminó (código ${code}). Reintentando en 10s...`);
      setTimeout(startPythonService, 10000);
    }
  });

  // Esperar hasta 20 s
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await isPortOpen(LEON_PORT)) { log('León IA Python listo ✓'); return true; }
  }
  warn('El servicio Python no respondió a tiempo');
  return false;
}

// ── Función principal exportada ───────────────────────────────────────────────
export async function initLeonIA() {
  log('Iniciando configuración automática...');

  const ollamaOk  = await ensureOllama();
  if (!ollamaOk) { warn('Sin Ollama — León usará sistema clásico'); return; }

  const runOk = await ensureOllamaRunning();
  if (!runOk) { warn('Ollama no arrancó — León usará sistema clásico'); return; }

  const modelOk = await ensureModel();
  if (!modelOk) { warn('Sin modelo — León usará sistema clásico'); return; }

  const pyOk = await ensurePythonEnv();
  if (!pyOk) { warn('Sin Python env — León usará sistema clásico'); return; }

  await startPythonService();
}

// Limpieza al cerrar el servidor
process.on('exit',    () => { pythonProc?.kill(); });
process.on('SIGTERM', () => { pythonProc?.kill(); process.exit(0); });
process.on('SIGINT',  () => { pythonProc?.kill(); process.exit(0); });
