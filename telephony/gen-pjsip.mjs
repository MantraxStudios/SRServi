// ─────────────────────────────────────────────────────────────────────────────
// SRServi · Genera asterisk/pjsip.conf desde los troncales del panel.
//
// Cada tienda carga SU propio troncal SIP en SRServi → Llamadas IA. Este script
// pide la lista al backend (GET /api/telephony/bot/trunks) y escribe un bloque
// pjsip por tienda (registration + auth + endpoint + aor + identify). Así no hay
// que editar pjsip.conf a mano por cada cliente.
//
// Uso:  node gen-pjsip.mjs           (lee SRSERVI_URL y TELEPHONY_BOT_TOKEN del entorno)
// Lo invoca sync-trunks.sh, que además recarga Asterisk (pjsip reload).
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'asterisk', 'pjsip.conf');

const {
  SRSERVI_URL = 'https://srservi2.srautomatic.com',
  TELEPHONY_BOT_TOKEN = '',
} = process.env;

// Deja solo caracteres seguros para nombres de sección pjsip.
const clean = (s) => String(s ?? '').replace(/[^A-Za-z0-9_.-]/g, '');

const HEADER = `;──────────────────────────────────────────────────────────────────────────────
; SRServi · pjsip.conf GENERADO AUTOMÁTICAMENTE por gen-pjsip.mjs — NO EDITAR.
; Un bloque por tienda con el agente de voz activo. Fuente: panel Llamadas IA.
; Regenera con: ./sync-trunks.sh  (o se ejecuta solo en start.sh)
;──────────────────────────────────────────────────────────────────────────────

[transport-udp]
type = transport
protocol = udp
bind = 0.0.0.0:5060
`;

function trunkBlock(t) {
  const id = clean(t.store_id);
  const host = String(t.trunk_host || '').trim();
  const port = parseInt(t.trunk_port) || 5060;
  const user = String(t.trunk_username || '').trim();
  const pass = String(t.trunk_password || '');
  const fromDomain = String(t.trunk_from_domain || host).trim();
  if (!host || !user) return null;

  const ep = `trunk_${id}`;
  const serverUri = `sip:${host}:${port}`;

  return `
; ── Tienda ${id} · DID ${t.did_number || '(sin DID)'} ─────────────────────────
[reg_${id}]
type = registration
transport = transport-udp
outbound_auth = auth_${id}
server_uri = ${serverUri}
client_uri = sip:${user}@${host}
retry_interval = 60
forbidden_retry_interval = 300
expiration = 3600

[auth_${id}]
type = auth
auth_type = userpass
username = ${user}
password = ${pass}

[${ep}]
type = endpoint
transport = transport-udp
context = from-trunk
disallow = all
allow = ulaw
allow = alaw
outbound_auth = auth_${id}
aors = aor_${id}
from_user = ${user}
from_domain = ${fromDomain}
direct_media = no

[aor_${id}]
type = aor
contact = ${serverUri}

[identify_${id}]
type = identify
endpoint = ${ep}
match = ${host}
`;
}

async function main() {
  let trunks = [];
  try {
    const res = await fetch(`${SRSERVI_URL}/api/telephony/bot/trunks`, {
      headers: { 'x-bot-token': TELEPHONY_BOT_TOKEN },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trunks = await res.json();
  } catch (e) {
    console.error(`[gen-pjsip] No pude obtener los troncales de ${SRSERVI_URL}: ${e.message}`);
    process.exit(1);
  }

  const blocks = (Array.isArray(trunks) ? trunks : [])
    .map(trunkBlock)
    .filter(Boolean);

  const body = blocks.length
    ? blocks.join('\n')
    : '\n; (Ninguna tienda con troncal activo todavía — configura una en el panel.)\n';

  writeFileSync(OUT, HEADER + body);
  console.log(`[gen-pjsip] ${blocks.length} troncal(es) escrito(s) en ${OUT}`);
}

main();
