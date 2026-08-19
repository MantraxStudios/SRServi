// ─────────────────────────────────────────────────────────────────────────────
// SRServi · Genera asterisk/pjsip.conf para recibir llamadas de Twilio (Voice).
//
// La plataforma usa Twilio Programmable Voice: número (DID) + Auth Token + Voice
// webhook. NO es Elastic SIP Trunking con registro/usuario/clave digest. Flujo:
//
//   1. Entra la llamada al DID → Twilio hace un POST (firmado con
//      X-Twilio-Signature) al backend SRServi (/api/telephony/twilio/callback).
//   2. SRServi responde TwiML <Dial><Sip> apuntando a ESTE Asterisk.
//   3. Twilio abre un INVITE desde sus IPs de señalización hacia nosotros.
//
// Por lo tanto aquí solo definimos un endpoint que ACEPTA el INVITE entrante de
// Twilio, identificado por la IP de señalización de Twilio (identify por CIDR). El
// ruteo por DID lo hace el dialplan (extensions.conf, contexto from-trunk).
//
// IPs de señalización SIP de Twilio (doc oficial):
//   NA Virginia    (us1) 54.172.60.0/30
//   NA Oregon      (us2) 54.244.51.0/30
//   EU Irlanda     (ie1) 54.171.127.192/30
//   EU Frankfurt   (de1) 35.156.191.128/30
//   AP Tokio       (jp1) 54.65.63.192/30
//   AP Singapur    (sg1) 54.169.127.128/30
//   AP Sídney      (au1) 54.252.254.64/30
//   SA São Paulo   (br1) 177.71.206.192/30   ← más cercano a Chile
// Se pueden sobreescribir con TWILIO_SIP_IPS (lista separada por comas).
//
// Uso:  node gen-pjsip.mjs        (lo invoca sync-trunks.sh, que recarga Asterisk)
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'asterisk', 'pjsip.conf');

// CIDRs de señalización de Twilio. Por defecto todos (Twilio enruta por el edge
// más cercano y puede variar); se puede acotar con TWILIO_SIP_IPS (p. ej. solo br1).
const DEFAULT_TWILIO_IPS = [
  '54.172.60.0/30',      // us1
  '54.244.51.0/30',      // us2
  '54.171.127.192/30',   // ie1
  '35.156.191.128/30',   // de1
  '54.65.63.192/30',     // jp1
  '54.169.127.128/30',   // sg1
  '54.252.254.64/30',    // au1
  '177.71.206.192/30',   // br1 (São Paulo)
];

const {
  TWILIO_SIP_IPS = '',
  SIP_BIND_PORT = '5060',
} = process.env;

const twilioIps = (TWILIO_SIP_IPS.trim()
  ? TWILIO_SIP_IPS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_TWILIO_IPS);

const bindPort = parseInt(SIP_BIND_PORT) || 5060;

const HEADER = `;──────────────────────────────────────────────────────────────────────────────
; SRServi · pjsip.conf GENERADO AUTOMÁTICAMENTE por gen-pjsip.mjs — NO EDITAR.
; Recibe llamadas de Twilio (TwiML <Dial><Sip>). Sin registro ni digest: se acepta
; el INVITE entrante por la IP de señalización de Twilio (identify).
; Regenera con: ./sync-trunks.sh  (o se ejecuta solo en start.sh)
;──────────────────────────────────────────────────────────────────────────────

[transport-udp]
type = transport
protocol = udp
bind = 0.0.0.0:${bindPort}
`;

function twilioInboundBlock() {
  const matchLines = twilioIps.map(ip => `match = ${ip}`).join('\n');

  return `
; ── Entrante de Twilio (Programmable Voice · <Dial><Sip>) ────────────────────
[trunk_twilio]
type = endpoint
transport = transport-udp
context = from-trunk
disallow = all
allow = ulaw
allow = alaw
direct_media = no
; Sin autenticación SIP: la llamada ya fue autorizada por firma en el webhook.
; La confianza se basa en identificar la IP de origen (señalización de Twilio).
rtp_symmetric = yes
force_rport = yes
rewrite_contact = yes

[aor_twilio]
type = aor
max_contacts = 0

; Identifica el INVITE entrante de Twilio por IP de origen y lo mapea al endpoint.
[identify_twilio]
type = identify
endpoint = trunk_twilio
${matchLines}
`;
}

function main() {
  writeFileSync(OUT, HEADER + twilioInboundBlock());
  console.log(`[gen-pjsip] pjsip.conf escrito en ${OUT}. Entrante de Twilio por IP: ${twilioIps.join(', ')}`);
}

main();
