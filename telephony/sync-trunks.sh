#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRServi · Regenera la config SIP entrante (Twilio Programmable Voice) de Asterisk.
#
#   1. Genera pjsip.conf con el endpoint que ACEPTA el INVITE entrante de Twilio
#      (por IP de señalización de Twilio; sin registro ni digest).
#   2. Recarga Asterisk (pjsip reload) para aplicar sin cortar llamadas activas.
#
# Twilio usa Programmable Voice (número + Auth Token + webhook), no un SIP trunk.
# El webhook lo recibe el backend SRServi y responde TwiML <Dial><Sip> hacia este
# Asterisk. Las tiendas solo asocian su número (DID) en el panel.
#
# Uso:
#   ./sync-trunks.sh            → sincroniza una vez
#   ./sync-trunks.sh --watch    → repite cada 60s (útil como servicio/cron)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] && set -a && . ./.env && set +a

if ! command -v node >/dev/null 2>&1; then
  echo "✖ Necesito Node.js para generar la config (node no está en PATH)." >&2
  exit 1
fi

sync_once() {
  node gen-pjsip.mjs || { echo "  ⚠ No se pudo regenerar pjsip.conf (¿backend/token OK?)"; return 1; }
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^srservi-asterisk$'; then
    docker exec srservi-asterisk asterisk -rx "pjsip reload" >/dev/null 2>&1 \
      && echo "  ✔ Asterisk recargado (pjsip reload)" \
      || echo "  ⚠ No pude recargar Asterisk (¿contenedor listo?)"
  else
    echo "  ⏭  Contenedor srservi-asterisk no está corriendo — solo se generó el archivo"
  fi
}

if [ "${1:-}" = "--watch" ]; then
  echo "[sync-trunks] Modo watch: sincronizando cada 60s (Ctrl+C para salir)"
  while true; do
    sync_once || true
    sleep 60
  done
else
  sync_once
fi
