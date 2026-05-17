import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import os from 'os';

const __dir = dirname(fileURLToPath(import.meta.url));

const ANDROID_HOME    = process.env.ANDROID_HOME || join(os.homedir(), 'android-sdk');
const GRADLE_VERSION  = '9.2.1';
const GRADLE_DIR      = '/opt/gradle';
const GRADLE_BIN      = `${GRADLE_DIR}/gradle-${GRADLE_VERSION}/bin/gradle`;
const CACHE_DIR       = join(__dir, 'apk-cache');
const BUILD_JOBS      = new Map();

const APPS = {
  launcher: {
    srcDir:     join(__dir, 'web', 'SRServiClientLauncher'),
    outputName: 'SRServi-POS',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: [{
      rel: 'app/src/main/java/com/mantraxstudios/srservi/SRServiConfig.kt',
      placeholder: 'AUTO_STORE_CODE'
    }]
  },
  tvordenes: {
    srcDir:     join(__dir, 'web', 'SRServiTVOrdenes'),
    outputName: 'SRServi-TV',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: [{
      rel: 'app/src/main/java/com/mantraxstudios/srservitvordenes/MainActivity.kt',
      placeholder: 'AUTO_STORE_CODE'
    }]
  },
  cctv: {
    srcDir:     join(__dir, 'web', 'CCTV'),
    outputName: 'SRServi-CCTV',
    apkRelPath: 'app/build/outputs/apk/debug/app-debug.apk',
    injectFiles: [{
      rel: 'app/src/main/java/com/mantraxstudios/cctv/MainActivity.kt',
      placeholder: 'AUTO_STORE_CODE'
    }],
    injectFn: (content, storeCode) =>
      content.replace(
        /private const val STORE_CODE = "AUTO_STORE_CODE".*$/m,
        `private const val STORE_CODE = "${storeCode}"`
      )
  }
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function getBuildJob(jobId) {
  return BUILD_JOBS.get(jobId) || null;
}

export function getCachedApk(appName, storeCode) {
  const key  = APPS[appName]?.injectFiles.length ? (storeCode || '_generic') : '_generic';
  const file = join(CACHE_DIR, appName, `${key}.apk`);
  return existsSync(file) ? file : null;
}

export async function startBuild(appName, storeCode) {
  const app = APPS[appName];
  if (!app) throw new Error(`App desconocida: ${appName}`);

  const cacheKey  = app.injectFiles.length ? (storeCode || '_generic') : '_generic';
  const cacheFile = join(CACHE_DIR, appName, `${cacheKey}.apk`);

  if (existsSync(cacheFile)) {
    return { cached: true, apkPath: cacheFile, outputName: app.outputName };
  }

  const jobId = randomUUID();
  BUILD_JOBS.set(jobId, { status: 'building', apkPath: null, error: null, appName, storeCode, progress: 'Iniciando...' });

  buildInBackground(jobId, app, appName, storeCode, cacheFile).catch(() => {});
  return { cached: false, jobId };
}

// ─── Build pipeline ───────────────────────────────────────────────────────────

async function buildInBackground(jobId, app, appName, storeCode, cacheFile) {
  const tmpDir = join(os.tmpdir(), `srservi-build-${jobId}`);
  try {
    updateJob(jobId, { progress: 'Verificando herramientas...' });
    await ensureAndroidSdk();

    updateJob(jobId, { progress: 'Copiando fuentes del proyecto...' });
    cpSync(app.srcDir, tmpDir, { recursive: true });

    // Inject store code
    if (storeCode && app.injectFiles.length) {
      updateJob(jobId, { progress: `Configurando tienda ${storeCode}...` });
      if (app.injectFn) {
        // Custom injection function (avoids replacing placeholder in multiple places)
        const { rel } = app.injectFiles[0];
        const filePath = join(tmpDir, rel);
        if (existsSync(filePath)) {
          const content = app.injectFn(readFileSync(filePath, 'utf8'), storeCode);
          writeFileSync(filePath, content, 'utf8');
        }
      } else {
        for (const { rel, placeholder } of app.injectFiles) {
          const filePath = join(tmpDir, rel);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8').replaceAll(placeholder, storeCode);
            writeFileSync(filePath, content, 'utf8');
          }
        }
      }
    }

    writeFileSync(join(tmpDir, 'local.properties'), `sdk.dir=${ANDROID_HOME}\n`);

    updateJob(jobId, { progress: 'Compilando APK... (3-5 min en la primera compilación)' });
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

// ─── Tool setup ───────────────────────────────────────────────────────────────

async function ensureAndroidSdk() {
  if (process.platform !== 'linux') return; // dev environment, assume tools present

  // 1. JDK + basic tools
  try { execSync('java -version', { stdio: 'pipe' }); }
  catch {
    console.log('[Android Build] Instalando OpenJDK 17...');
    execSync('apt-get update -y && apt-get install -y openjdk-17-jdk ca-certificates-java unzip wget', { stdio: 'inherit' });
    try { execSync('update-ca-certificates', { stdio: 'pipe' }); } catch {}
  }

  // 2. Gradle 9.2.1 — downloaded directly with wget to avoid the SSL issue in the Gradle wrapper
  if (!existsSync(GRADLE_BIN)) {
    console.log(`[Android Build] Descargando Gradle ${GRADLE_VERSION}...`);
    const url    = `https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`;
    const tmpZip = `/tmp/gradle-${GRADLE_VERSION}.zip`;
    execSync(`wget -q --tries=5 --timeout=120 "${url}" -O "${tmpZip}"`, { stdio: 'inherit' });
    execSync(`mkdir -p "${GRADLE_DIR}" && unzip -q "${tmpZip}" -d "${GRADLE_DIR}" && rm -f "${tmpZip}"`, { stdio: 'inherit' });
    execSync(`chmod +x "${GRADLE_BIN}"`);
    console.log(`[Android Build] Gradle ${GRADLE_VERSION} instalado en ${GRADLE_DIR}`);
  }

  // 3. Android cmdline-tools
  const sdkMgr = join(ANDROID_HOME, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
  if (!existsSync(sdkMgr)) {
    console.log('[Android Build] Instalando Android cmdline-tools...');
    const toolsUrl   = 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip';
    const tmpZip     = '/tmp/cmdline-tools.zip';
    const tmpExtract = '/tmp/android-cmdtools';
    execSync(`wget -q "${toolsUrl}" -O "${tmpZip}"`, { stdio: 'inherit' });
    execSync(`rm -rf "${tmpExtract}" && mkdir -p "${tmpExtract}" && unzip -q "${tmpZip}" -d "${tmpExtract}"`, { stdio: 'inherit' });
    const destDir = join(ANDROID_HOME, 'cmdline-tools', 'latest');
    mkdirSync(destDir, { recursive: true });
    execSync(`cp -r "${tmpExtract}/cmdline-tools/." "${destDir}/" && rm -rf "${tmpExtract}" "${tmpZip}"`, { stdio: 'inherit' });
  }

  // 4. Accept licenses + install SDK packages
  const env = buildEnv();
  try { execSync(`yes | "${sdkMgr}" --licenses`, { env, stdio: 'pipe' }); } catch {}
  for (const pkg of ['platform-tools', 'build-tools;35.0.0', 'platforms;android-35']) {
    try { execSync(`"${sdkMgr}" "${pkg}"`, { env, stdio: 'pipe' }); } catch {}
  }
  // android-36 from canary (preview SDK)
  try { execSync(`"${sdkMgr}" --channel=3 "platforms;android-36"`, { env, stdio: 'pipe' }); } catch {}
}

function buildEnv() {
  return {
    ...process.env,
    ANDROID_HOME,
    ANDROID_SDK_ROOT: ANDROID_HOME,
    GRADLE_HOME: `${GRADLE_DIR}/gradle-${GRADLE_VERSION}`,
    PATH: [
      process.env.PATH,
      `${GRADLE_DIR}/gradle-${GRADLE_VERSION}/bin`,
      join(ANDROID_HOME, 'cmdline-tools', 'latest', 'bin'),
      join(ANDROID_HOME, 'platform-tools'),
    ].join(':'),
    // Force TLS 1.2/1.3 for all Java HTTPS connections (fixes SSL on some VPS)
    JAVA_OPTS: '-Dhttps.protocols=TLSv1.2,TLSv1.3 -Dfile.encoding=UTF-8',
    GRADLE_OPTS: '-Dorg.gradle.daemon=false -Dfile.encoding=UTF-8',
  };
}

// ─── Gradle runner ────────────────────────────────────────────────────────────

function runGradle(dir) {
  return new Promise((resolve, reject) => {
    // On Linux: use the direct Gradle binary (avoids wrapper SSL download)
    // On Windows (dev): fall back to gradlew.bat
    const gradleCmd = (process.platform === 'linux' && existsSync(GRADLE_BIN))
      ? GRADLE_BIN
      : (process.platform === 'win32' ? 'gradlew.bat' : './gradlew');

    const proc = spawn(gradleCmd, ['assembleDebug', '--no-daemon', '--no-build-cache'], {
      cwd: dir,
      env: buildEnv(),
      shell: process.platform === 'win32',
    });

    let output = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { output += d.toString(); });

    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Gradle falló (exit ${code}).\n${output.slice(-1000)}`));
    });
    proc.on('error', err => reject(new Error(`No se pudo ejecutar Gradle: ${err.message}`)));
  });
}
