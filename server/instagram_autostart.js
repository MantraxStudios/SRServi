/**
 * Instagram Service — Autoarranque con venv propio
 * Mismo patrón que León IA: crea venv, instala deps, lanza uvicorn.
 */

import { spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = __dirname;
const VENV_DIR   = path.join(SERVER_DIR, 'instagram_venv');
const PYTHON_BIN = path.join(VENV_DIR, 'bin', 'python3');
const PIP_BIN    = path.join(VENV_DIR, 'bin', 'pip');
const REQ_TXT    = path.join(SERVER_DIR, 'requirements_instagram.txt');
const IG_PORT    = 8787;

let igProc = null;

const log  = (msg) => console.log(`[IG-Service] ${msg}`);
const warn = (msg) => console.warn(`[IG-Service] ⚠ ${msg}`);

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

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const p = spawn('sh', ['-c', `ss -tlnp 2>/dev/null | grep -q :${port}`], { stdio: 'ignore' });
    p.on('close', (c) => resolve(c === 0));
    p.on('error', () => resolve(false));
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

function shellOk(cmd) {
  return new Promise((resolve) => {
    const p = spawn('sh', ['-c', cmd], { stdio: 'ignore' });
    p.on('close', (c) => resolve(c === 0));
    p.on('error', () => resolve(false));
  });
}

async function ensurePythonEnv() {
  // Venv incompleto (sin python o sin pip) → recrear desde cero.
  // Pasa cuando faltaba python3-venv al crearlo: deja bin/python3 pero sin pip.
  if (existsSync(VENV_DIR) && (!existsSync(PYTHON_BIN) || !existsSync(PIP_BIN))) {
    warn('Venv incompleto detectado (falta pip) — recreando...');
    try { rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
  }

  if (!existsSync(PYTHON_BIN)) {
    if (!await shellOk('python3 -c "import ensurepip"')) {
      log('Instalando python3-venv (necesario para crear el venv)...');
      await shellOk(
        '(apt-get update -qq 2>/dev/null; apt-get install -y python3-venv python3-pip) 2>/dev/null || ' +
        'yum install -y python3-pip 2>/dev/null || true'
      );
    }

    log(`Creando entorno virtual en ${VENV_DIR} ...`);
    const ok = await spawnStream('python3', ['-m', 'venv', VENV_DIR]);
    if (!ok || !existsSync(PYTHON_BIN)) {
      warn('Error creando venv');
      try { rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
      return false;
    }
    if (!existsSync(PIP_BIN)) {
      log('Venv sin pip — ejecutando ensurepip...');
      await spawnStream(PYTHON_BIN, ['-m', 'ensurepip', '--upgrade']);
    }
    if (!existsSync(PIP_BIN)) {
      warn('No se pudo obtener pip en el venv');
      try { rmSync(VENV_DIR, { recursive: true, force: true }); } catch {}
      return false;
    }
    log('Venv creado ✓');
  } else {
    log('Venv ya existe ✓');
  }

  log('Instalando dependencias Python (instagrapi, fastapi, uvicorn)...');
  const ok = await spawnStream(PYTHON_BIN, ['-m', 'pip', 'install', '-r', REQ_TXT, '--timeout', '120']);
  if (!ok) { warn('Error instalando dependencias'); return false; }
  log('Dependencias instaladas ✓');
  return true;
}

async function launchUvicorn() {
  if (await isPortOpen(IG_PORT)) {
    log('Servicio ya corriendo en puerto 8787 ✓');
    return;
  }

  log('Lanzando uvicorn en puerto 8787...');
  igProc = spawn(PYTHON_BIN, [
    '-m', 'uvicorn',
    'instagram_python_service:app',
    '--host', '127.0.0.1',
    '--port', String(IG_PORT),
    '--log-level', 'warning',
  ], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  igProc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => log(l)));
  igProc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => warn(l)));
  igProc.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      warn(`Proceso terminó (code=${code}), reiniciando en 5s...`);
      igProc = null;
      setTimeout(launchUvicorn, 5000);
    }
  });
  igProc.on('error', e => warn(`Error proceso: ${e.message}`));

  const up = await waitForPort(IG_PORT, 30);
  if (up) log('Servicio Instagram listo en puerto 8787 ✓');
  else warn('El servicio no respondió en 30s');
}

export async function initInstagramService() {
  log('=== Iniciando servicio Instagram (instagrapi) ===');
  if (!await ensurePythonEnv()) { warn('Sin entorno Python — Instagram auto-post no disponible'); return; }
  await launchUvicorn();
}

function cleanup() {
  if (igProc) { igProc.kill('SIGTERM'); igProc = null; }
}
process.on('exit',    cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
