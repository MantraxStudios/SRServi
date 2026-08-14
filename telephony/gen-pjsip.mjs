// ─────────────────────────────────────────────────────────────────────────────
// SRServi · Genera asterisk/pjsip.conf con UN ÚNICO troncal SIP: Sinch.
//
// Todas las tiendas usan el mismo proveedor (Sinch). Las credenciales del
// troncal son GLOBALES y viven en el .env de esta carpeta (SINCH_SIP_*), no por
// tienda. Cada tienda solo asocia su número (DID) en el panel (Llamadas IA); el
// bot resuelve a qué tienda pertenece cada llamada por el DID llamado.
//
// Uso:  node gen-pjsip.mjs        (lee SINCH_SIP_* del entorno / .env)
// Lo invoca sync-trunks.sh, que además recarga Asterisk (pjsip reload).
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'asterisk', 'pjsip.conf');

const {
  SINCH_SIP_HOST = 'sip.sinch.com',
  SINCH_SIP_PORT = '5060',
  SINCH_SIP_USER = '',
  SINCH_SIP_PASSWORD = '',
  SINCH_SIP_FROM_DOMAIN = '',
} = process.env;

const HEADER = `;──────────────────────────────────────────────────────────────────────────────
; SRServi · pjsip.conf GENERADO AUTOMÁTICAMENTE por gen-pjsip.mjs — NO EDITAR.
; Un único troncal SIP global: Sinch. Credenciales en telephony/.env (SINCH_SIP_*).
; Regenera con: ./sync-trunks.sh  (o se ejecuta solo en start.sh)
;──────────────────────────────────────────────────────────────────────────────

[transport-udp]
type = transport
protocol = udp
bind = 0.0.0.0:5060
`;

function sinchTrunkBlock() {
  const host = String(SINCH_SIP_HOST || '').trim();
  const port = parseInt(SINCH_SIP_PORT) || 5060;
  const user = String(SINCH_SIP_USER || '').trim();
  const pass = String(SINCH_SIP_PASSWORD || '');
  const fromDomain = String(SINCH_SIP_FROM_DOMAIN || host).trim();
  if (!host || !user) return null;

  const serverUri = `sip:${host}:${port}`;

  return `
; ── Troncal SIP único: Sinch ─────────────────────────────────────────────────
[reg_sinch]
type = registration
transport = transport-udp
outbound_auth = auth_sinch
server_uri = ${serverUri}
client_uri = sip:${user}@${host}
retry_interval = 60
forbidden_retry_interval = 300
expiration = 3600

[auth_sinch]
type = auth
auth_type = userpass
username = ${user}
password = ${pass}

[trunk_sinch]
type = endpoint
transport = transport-udp
context = from-trunk
disallow = all
allow = ulaw
allow = alaw
outbound_auth = auth_sinch
aors = aor_sinch
from_user = ${user}
from_domain = ${fromDomain}
direct_media = no

[aor_sinch]
type = aor
contact = ${serverUri}

[identify_sinch]
type = identify
endpoint = trunk_sinch
match = ${host}
`;
}

function main() {
  const block = sinchTrunkBlock();

  if (!block) {
    console.error('[gen-pjsip] Faltan credenciales de Sinch en el .env (SINCH_SIP_USER / SINCH_SIP_PASSWORD / SINCH_SIP_HOST).');
    writeFileSync(OUT, HEADER + '\n; (Sin credenciales de Sinch: completa SINCH_SIP_* en telephony/.env y vuelve a correr sync-trunks.sh)\n');
    process.exit(1);
  }

  writeFileSync(OUT, HEADER + block);
  console.log(`[gen-pjsip] Troncal Sinch escrito en ${OUT} (host ${SINCH_SIP_HOST}).`);
}

main();
