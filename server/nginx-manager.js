import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const NGINX_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_ENABLED   = '/etc/nginx/sites-enabled';
const CLIENT_PORT     = process.env.CLIENT_PORT || 6666;
const BASE_URL        = process.env.BASE_URL    || 'https://srservi2.srautomatic.com';
const CERTBOT_EMAIL   = process.env.EMAIL_USER  || 'support@srautomatic.com';

function getBaseDomain() {
  try { return new URL(BASE_URL).hostname.split('.').slice(1).join('.'); }
  catch { return 'srautomatic.com'; }
}

function getMainHost() {
  try { return new URL(BASE_URL).hostname; }
  catch { return 'srservi2.srautomatic.com'; }
}

function isProduction() {
  return process.env.NODE_ENV === 'production' || fs.existsSync('/etc/nginx');
}

// Generates HTTP-only config first (before certbot runs)
function httpConfig(subdomain) {
  const fqdn     = `${subdomain}.${getBaseDomain()}`;
  const mainHost = getMainHost();
  return `# SRServi auto-generated — ${fqdn}
server {
    listen 80;
    server_name ${fqdn};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:${CLIENT_PORT};
        proxy_set_header Host ${mainHost};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

// Final config with SSL (used after certbot already placed the cert)
function httpsConfig(subdomain) {
  const fqdn     = `${subdomain}.${getBaseDomain()}`;
  const mainHost = getMainHost();
  const certDir  = `/etc/letsencrypt/live/${fqdn}`;
  return `# SRServi auto-generated — ${fqdn}
server {
    listen 80;
    server_name ${fqdn};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${fqdn};

    ssl_certificate     ${certDir}/fullchain.pem;
    ssl_certificate_key ${certDir}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;

    location / {
        proxy_pass http://127.0.0.1:${CLIENT_PORT};
        proxy_set_header Host ${mainHost};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

// Wildcard config (when wildcard cert already exists)
function wildcardConfig(subdomain) {
  const fqdn       = `${subdomain}.${getBaseDomain()}`;
  const mainHost   = getMainHost();
  const baseDomain = getBaseDomain();
  const certDir    = `/etc/letsencrypt/live/${baseDomain}`;
  return `# SRServi auto-generated — ${fqdn}
server {
    listen 80;
    server_name ${fqdn};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${fqdn};

    ssl_certificate     ${certDir}/fullchain.pem;
    ssl_certificate_key ${certDir}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;

    location / {
        proxy_pass http://127.0.0.1:${CLIENT_PORT};
        proxy_set_header Host ${mainHost};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

function writeConfig(subdomain, content) {
  const name          = `srservi-${subdomain}.conf`;
  const availablePath = path.join(NGINX_AVAILABLE, name);
  const enabledPath   = path.join(NGINX_ENABLED,   name);
  fs.writeFileSync(availablePath, content, 'utf8');
  if (!fs.existsSync(enabledPath)) fs.symlinkSync(availablePath, enabledPath);
}

function removeConfig(subdomain) {
  const name          = `srservi-${subdomain}.conf`;
  const availablePath = path.join(NGINX_AVAILABLE, name);
  const enabledPath   = path.join(NGINX_ENABLED,   name);
  if (fs.existsSync(enabledPath))   fs.unlinkSync(enabledPath);
  if (fs.existsSync(availablePath)) fs.unlinkSync(availablePath);
}

async function reloadNginx() {
  try {
    await execAsync('nginx -t');
    try { await execAsync('systemctl reload nginx'); }
    catch { await execAsync('nginx -s reload'); }
    return true;
  } catch (e) {
    console.error('[nginx-manager] reload error:', e.message);
    return false;
  }
}

async function certbotObtain(fqdn) {
  // Ensure webroot dir exists for ACME challenge
  await execAsync('mkdir -p /var/www/certbot').catch(() => {});

  const cmd = [
    'certbot certonly',
    '--webroot',
    `-w /var/www/certbot`,
    `-d ${fqdn}`,
    `--email ${CERTBOT_EMAIL}`,
    '--agree-tos',
    '--non-interactive',
    '--quiet'
  ].join(' ');

  try {
    await execAsync(cmd);
    return true;
  } catch (e) {
    console.error('[nginx-manager] certbot error:', e.message);
    return false;
  }
}

export async function registerSubdomain(subdomain) {
  if (!isProduction()) {
    console.log(`[nginx-manager] dev — skipping nginx for "${subdomain}"`);
    return { ok: true, dev: true, ssl: false };
  }

  try {
    if (!fs.existsSync(NGINX_AVAILABLE)) {
      return { ok: false, error: 'nginx no encontrado en este servidor' };
    }

    const fqdn       = `${subdomain}.${getBaseDomain()}`;
    const baseDomain = getBaseDomain();

    // 1. Check if wildcard cert already exists (fastest path)
    const wildcardCertPath = `/etc/letsencrypt/live/${baseDomain}/fullchain.pem`;
    if (fs.existsSync(wildcardCertPath)) {
      writeConfig(subdomain, wildcardConfig(subdomain));
      const ok = await reloadNginx();
      if (!ok) { removeConfig(subdomain); return { ok: false, error: 'nginx -t falló con config wildcard' }; }
      return { ok: true, ssl: true, method: 'wildcard' };
    }

    // 2. Check if individual cert already exists for this subdomain
    const certPath = `/etc/letsencrypt/live/${fqdn}/fullchain.pem`;
    if (fs.existsSync(certPath)) {
      writeConfig(subdomain, httpsConfig(subdomain));
      const ok = await reloadNginx();
      if (!ok) { removeConfig(subdomain); return { ok: false, error: 'nginx -t falló con config HTTPS' }; }
      return { ok: true, ssl: true, method: 'existing-cert' };
    }

    // 3. Write HTTP config first, reload nginx so ACME challenge works
    writeConfig(subdomain, httpConfig(subdomain));
    const httpOk = await reloadNginx();
    if (!httpOk) { removeConfig(subdomain); return { ok: false, error: 'nginx -t falló con config HTTP' }; }

    // 4. Obtain SSL cert via certbot webroot challenge
    const certObtained = await certbotObtain(fqdn);

    if (certObtained) {
      // 5. Upgrade to HTTPS config now that cert exists
      writeConfig(subdomain, httpsConfig(subdomain));
      await reloadNginx();
      return { ok: true, ssl: true, method: 'certbot' };
    }

    // certbot failed — keep HTTP only (cert can be added later)
    return { ok: true, ssl: false, method: 'http-only', warning: 'No se pudo obtener SSL. El subdominio funciona sin HTTPS por ahora. Asegúrate de que el DNS wildcard apunta a este servidor.' };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function unregisterSubdomain(subdomain) {
  if (!isProduction()) {
    console.log(`[nginx-manager] dev — skipping nginx remove for "${subdomain}"`);
    return { ok: true };
  }

  try {
    removeConfig(subdomain);
    await reloadNginx();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
