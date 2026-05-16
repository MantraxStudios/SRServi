import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import os from 'os';

const __dir = dirname(fileURLToPath(import.meta.url));

const ANDROID_HOME = process.env.ANDROID_HOME || join(os.homedir(), 'android-sdk');
const CACHE_DIR = join(__dir, 'apk-cache');
const BUILD_JOBS = new Map();

const APPS = {
  launcher: {
    srcDir: join(__dir, 'web', 'SRServiClientLauncher'),
    outputName: 'SRServi-POS',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: [{
      rel: 'app/src/main/java/com/mantraxstudios/srservi/SRServiConfig.kt',
      placeholder: 'AUTO_STORE_CODE'
    }]
  },
  tvordenes: {
    srcDir: join(__dir, 'web', 'SRServiTVOrdenes'),
    outputName: 'SRServi-TV',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: [{
      rel: 'app/src/main/java/com/mantraxstudios/srservitvordenes/MainActivity.kt',
      placeholder: 'AUTO_STORE_CODE'
    }]
  },
  cctv: {
    srcDir: join(__dir, 'web', 'CCTV'),
    outputName: 'SRServi-CCTV',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: []
  }
};

export function getBuildJob(jobId) {
  return BUILD_JOBS.get(jobId) || null;
}

export function getCachedApk(appName, storeCode) {
  const key = APPS[appName]?.injectFiles.length ? (storeCode || '_generic') : '_generic';
  const path = join(CACHE_DIR, appName, `${key}.apk`);
  return existsSync(path) ? path : null;
}

export async function startBuild(appName, storeCode) {
  const app = APPS[appName];
  if (!app) throw new Error(`App desconocida: ${appName}`);

  const cacheKey = app.injectFiles.length ? (storeCode || '_generic') : '_generic';
  const cacheFile = join(CACHE_DIR, appName, `${cacheKey}.apk`);

  if (existsSync(cacheFile)) {
    return { cached: true, apkPath: cacheFile, outputName: app.outputName };
  }

  const jobId = randomUUID();
  BUILD_JOBS.set(jobId, { status: 'building', apkPath: null, error: null, appName, storeCode, progress: 'Iniciando...' });

  buildInBackground(jobId, app, appName, storeCode, cacheFile).catch(() => {});
  return { cached: false, jobId };
}

async function buildInBackground(jobId, app, appName, storeCode, cacheFile) {
  const tmpDir = join(os.tmpdir(), `srservi-build-${jobId}`);
  try {
    updateJob(jobId, { progress: 'Verificando herramientas de compilación...' });
    await ensureAndroidSdk();

    updateJob(jobId, { progress: 'Copiando fuentes del proyecto...' });
    cpSync(app.srcDir, tmpDir, { recursive: true });

    // Make gradlew executable on Linux
    const gradlew = join(tmpDir, 'gradlew');
    if (existsSync(gradlew)) {
      try { execSync(`chmod +x "${gradlew}"`); } catch {}
    }

    // Inject store code into source files
    if (storeCode && app.injectFiles.length) {
      updateJob(jobId, { progress: `Configurando tienda ${storeCode}...` });
      for (const { rel, placeholder } of app.injectFiles) {
        const filePath = join(tmpDir, rel);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8').replaceAll(placeholder, storeCode);
          writeFileSync(filePath, content, 'utf8');
        }
      }
    }

    // Write local.properties pointing to Android SDK
    writeFileSync(join(tmpDir, 'local.properties'), `sdk.dir=${ANDROID_HOME}\n`);

    updateJob(jobId, { progress: 'Compilando APK... (3-5 min en primera compilación)' });
    await runGradle(tmpDir);

    const builtApk = join(tmpDir, app.apkRelPath);
    if (!existsSync(builtApk)) throw new Error('El APK no se generó. Revisa los logs del servidor.');

    mkdirSync(dirname(cacheFile), { recursive: true });
    cpSync(builtApk, cacheFile);

    BUILD_JOBS.set(jobId, { status: 'done', apkPath: cacheFile, error: null, appName, outputName: app.outputName, storeCode, progress: 'Listo' });
  } catch (err) {
    BUILD_JOBS.set(jobId, { status: 'error', apkPath: null, error: err.message, appName, storeCode, progress: 'Error' });
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function updateJob(jobId, patch) {
  const job = BUILD_JOBS.get(jobId);
  if (job) BUILD_JOBS.set(jobId, { ...job, ...patch });
}

function sdkManagerBin() {
  return join(ANDROID_HOME, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
}

async function ensureAndroidSdk() {
  // 1. Check JDK
  try { execSync('java -version', { stdio: 'pipe' }); }
  catch {
    if (process.platform !== 'linux') throw new Error('JDK no encontrado. Instala Java 17+.');
    console.log('[Android Build] Instalando OpenJDK 17...');
    execSync('apt-get update -y && apt-get install -y openjdk-17-jdk unzip wget', { stdio: 'inherit' });
  }

  // 2. Check Android SDK cmdline-tools
  if (!existsSync(sdkManagerBin())) {
    if (process.platform !== 'linux') throw new Error('Android SDK no encontrado. Instala el SDK manualmente.');
    await installAndroidCmdlineTools();
  }

  // 3. Accept licenses and install required SDK packages
  const sdkEnv = buildEnv();
  try {
    execSync(`yes | "${sdkManagerBin()}" --licenses`, { env: sdkEnv, stdio: 'pipe' });
  } catch {}

  const packages = [
    'platform-tools',
    'build-tools;35.0.0',
    'platforms;android-35',
  ];
  // Try android-36 from canary channel (needed by the apps)
  const extraPackages = ['platforms;android-36'];

  try {
    execSync(`"${sdkManagerBin()}" ${packages.map(p => `"${p}"`).join(' ')}`, { env: sdkEnv, stdio: 'pipe' });
  } catch (e) {
    console.warn('[Android Build] Aviso instalando paquetes estables:', e.message);
  }
  try {
    execSync(`"${sdkManagerBin()}" --channel=3 ${extraPackages.map(p => `"${p}"`).join(' ')}`, { env: sdkEnv, stdio: 'pipe' });
  } catch {}
}

async function installAndroidCmdlineTools() {
  console.log('[Android Build] Descargando Android cmdline-tools...');
  const toolsUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip';
  const tmpZip = '/tmp/cmdline-tools.zip';
  const tmpExtract = '/tmp/android-cmdtools';

  execSync(`wget -q "${toolsUrl}" -O "${tmpZip}"`, { stdio: 'inherit' });
  execSync(`rm -rf "${tmpExtract}" && mkdir -p "${tmpExtract}" && unzip -q "${tmpZip}" -d "${tmpExtract}"`, { stdio: 'inherit' });

  const destDir = join(ANDROID_HOME, 'cmdline-tools', 'latest');
  mkdirSync(destDir, { recursive: true });
  execSync(`cp -r "${tmpExtract}/cmdline-tools/." "${destDir}/"`, { stdio: 'inherit' });
  execSync(`rm -rf "${tmpExtract}" "${tmpZip}"`);
  console.log(`[Android Build] cmdline-tools instalado en ${destDir}`);
}

function buildEnv() {
  return {
    ...process.env,
    ANDROID_HOME,
    ANDROID_SDK_ROOT: ANDROID_HOME,
    PATH: `${process.env.PATH}:${join(ANDROID_HOME, 'cmdline-tools', 'latest', 'bin')}:${join(ANDROID_HOME, 'platform-tools')}`,
    JAVA_TOOL_OPTIONS: '-Dfile.encoding=UTF-8',
  };
}

function runGradle(dir) {
  return new Promise((resolve, reject) => {
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    const proc = spawn(gradlew, ['assembleDebug', '--no-daemon'], {
      cwd: dir,
      env: buildEnv(),
      shell: process.platform === 'win32'
    });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.stdout.on('data', () => {});

    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Gradle falló (exit ${code}).\n${stderr.slice(-800)}`));
    });
    proc.on('error', err => reject(new Error(`No se pudo ejecutar Gradle: ${err.message}`)));
  });
}
