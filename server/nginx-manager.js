import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const NGINX_AVAILABLE = process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available';
const NGINX_ENABLED   = process.env.NGINX_SITES_ENABLED   || '/etc/nginx/sites-enabled';
const CLIENT_PORT     = process.env.CLIENT_PORT || 6666;
const BASE_URL        = process.env.BASE_URL    || 'https://srservi2.srautomatic.com';
const WILDCARD_CERT   = process.env.WILDCARD_CERT || '';
const WILDCARD_KEY    = process.env.WILDCARD_KEY  || '';

function getBaseDomain() {
  try { return new URL(BASE_URL).hostname.split('.').slice(1).join('.'); }
  catch { return 'srautomatic.com'; }
}

function getMainHost() {
  try { return new URL(BASE_URL).hostname; }
  catch { return 'srservi2.srautomatic.com'; }
}

function generateConfig(subdomain) {
  const domain     = `${subdomain}.${getBaseDomain()}`;
  const mainHost   = getMainHost();
  const hasSSL     = WILDCARD_CERT && WILDCARD_KEY &&
                     fs.existsSync(WILDCARD_CERT) && fs.existsSync(WILDCARD_KEY);

  if (hasSSL) {
    return `# SRServi auto-generated — ${domain}
server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     ${WILDCARD_CERT};
    ssl_certificate_key ${WILDCARD_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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

  // HTTP-only (user can add SSL with certbot later)
  return `# SRServi auto-generated — ${domain}
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${CLIENT_PORT};
        proxy_set_header Host ${mainHost};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

async function reloadNginx() {
  try {
    await execAsync('nginx -t');
    await execAsync('systemctl reload nginx').catch(() => execAsync('nginx -s reload'));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function registerSubdomain(subdomain) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[nginx-manager] dev mode — skip nginx write for "${subdomain}"`);
    return { ok: true, dev: true };
  }

  try {
    if (!fs.existsSync(NGINX_AVAILABLE)) {
      return { ok: false, error: `Directorio nginx no encontrado: ${NGINX_AVAILABLE}` };
    }

    const configName    = `srservi-${subdomain}.conf`;
    const availablePath = path.join(NGINX_AVAILABLE, configName);
    const enabledPath   = path.join(NGINX_ENABLED,   configName);

    fs.writeFileSync(availablePath, generateConfig(subdomain), 'utf8');

    if (!fs.existsSync(enabledPath)) {
      fs.symlinkSync(availablePath, enabledPath);
    }

    const reload = await reloadNginx();
    if (!reload.ok) {
      // Rollback: remove config and symlink
      if (fs.existsSync(enabledPath))   fs.unlinkSync(enabledPath);
      if (fs.existsSync(availablePath)) fs.unlinkSync(availablePath);
      return { ok: false, error: `nginx -t falló: ${reload.error}` };
    }

    return { ok: true, ssl: !!(WILDCARD_CERT && WILDCARD_KEY && fs.existsSync(WILDCARD_CERT)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function unregisterSubdomain(subdomain) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[nginx-manager] dev mode — skip nginx remove for "${subdomain}"`);
    return { ok: true, dev: true };
  }

  try {
    const configName    = `srservi-${subdomain}.conf`;
    const availablePath = path.join(NGINX_AVAILABLE, configName);
    const enabledPath   = path.join(NGINX_ENABLED,   configName);

    if (fs.existsSync(enabledPath))   fs.unlinkSync(enabledPath);
    if (fs.existsSync(availablePath)) fs.unlinkSync(availablePath);

    await reloadNginx();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
