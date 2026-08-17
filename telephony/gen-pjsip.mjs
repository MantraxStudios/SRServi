// ─────────────────────────────────────────────────────────────────────────────
// SRServi · Genera asterisk/pjsip.conf para recibir llamadas de la Voice API de Sinch.
//
// IMPORTANTE: la plataforma usa la *Voice API* de Sinch (número + Application
// Key/Secret + Callback), NO Elastic SIP Trunking. Por eso NO hay registro SIP ni
// usuario/clave digest. El flujo es:
//
//   1. Entra la llamada al DID → Sinch hace un POST firmado al backend SRServi
//      (/api/telephony/sinch/callback).
//   2. SRServi responde SVAML `connectSip` apuntando a ESTE Asterisk.
//   3. Sinch abre un INVITE desde sus MEDIA SERVERS hacia nosotros.
//
// Por lo tanto aquí solo definimos un endpoint que ACEPTA el INVITE entrante de
// Sinch, identificado por la IP de sus media servers (identify por CIDR). El
// ruteo por DID lo hace el dialplan (extensions.conf, contexto from-trunk).
//
// IPs de señalización SIP de Sinch (doc oficial "SIP Trunking / firewall"):
//   Europa         206.146.136.0/28
//   Norteamérica   206.146.133.0/28
//   Sudamérica     206.146.138.0/28   ← Chile
//   Sudeste Asia   206.146.139.0/28
//   Australia      206.146.141.0/28
// Se pueden sobreescribir con SINCH_SIP_IPS (lista separada por comas).
//
// Uso:  node gen-pjsip.mjs        (lo invoca sync-trunks.sh, que recarga Asterisk)
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'asterisk', 'pjsip.conf');

// CIDRs de señalización de Sinch. Por defecto todos (Sinch recomienda permitir
// todas sus IPs por redundancia entre zonas); se puede acotar con SINCH_SIP_IPS.
const DEFAULT_SINCH_IPS = [
  '206.146.136.0/28',
  '206.146.133.0/28',
  '206.146.138.0/28',
  '206.146.139.0/28',
  '206.146.141.0/28',
];

const {
  SINCH_SIP_IPS = '',
  SIP_BIND_PORT = '5060',
} = process.env;

const sinchIps = (SINCH_SIP_IPS.trim()
  ? SINCH_SIP_IPS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_SINCH_IPS);

const bindPort = parseInt(SIP_BIND_PORT) || 5060;

const HEADER = `;──────────────────────────────────────────────────────────────────────────────
; SRServi · pjsip.conf GENERADO AUTOMÁTICAMENTE por gen-pjsip.mjs — NO EDITAR.
; Recibe llamadas de la Voice API de Sinch (connectSip). Sin registro ni digest:
; se acepta el INVITE entrante por la IP de los media servers de Sinch (identify).
; Regenera con: ./sync-trunks.sh  (o se ejecuta solo en start.sh)
;──────────────────────────────────────────────────────────────────────────────

[transport-udp]
type = transport
protocol = udp
bind = 0.0.0.0:${bindPort}
`;

function sinchInboundBlock() {
  const matchLines = sinchIps.map(ip => `match = ${ip}`).join('\n');

  return `
; ── Entrante de Sinch (Voice API · connectSip) ───────────────────────────────
[trunk_sinch]
type = endpoint
transport = transport-udp
context = from-trunk
disallow = all
allow = ulaw
allow = alaw
direct_media = no
; Sin autenticación SIP: la llamada ya fue autorizada por firma en el callback.
; La confianza se basa en identificar la IP de origen (Sinch media servers).
rtp_symmetric = yes
force_rport = yes
rewrite_contact = yes

[aor_sinch]
type = aor
max_contacts = 0

; Identifica el INVITE entrante de Sinch por IP de origen y lo mapea al endpoint.
[identify_sinch]
type = identify
endpoint = trunk_sinch
${matchLines}
`;
}

function main() {
  writeFileSync(OUT, HEADER + sinchInboundBlock());
  console.log(`[gen-pjsip] pjsip.conf escrito en ${OUT}. Entrante Voice API de Sinch por IP: ${sinchIps.join(', ')}`);
}

main();
