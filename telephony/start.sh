#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRServi · Telefonía IA — arranque de todo el stack en un solo comando.
#
#   ./start.sh            → levanta asterisk + bot + whisper + ollama y verifica
#   OLLAMA_MODEL=mistral ./start.sh   → descarga otro modelo (por defecto llama3)
#
# Hace: valida requisitos → construye/levanta el docker compose (reconstruye el
# bot, con las voces Piper) → descarga el modelo del LLM (una sola vez) → espera a
# que cada servicio responda → muestra el estado del SIP entrante de Twilio.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

OLLAMA_MODEL="${OLLAMA_MODEL:-llama3}"

# Docker compose v2 (docker compose) o v1 (docker-compose)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "✖ No encuentro Docker Compose. Instala Docker + Compose primero." >&2
  exit 1
fi

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m✔ %s\033[0m\n' "$*"; }
warn() { printf '  \033[1;33m! %s\033[0m\n' "$*"; }

# ── 1. Requisitos ────────────────────────────────────────────────────────────
log "Verificando requisitos"
command -v docker >/dev/null 2>&1 || { echo "✖ Docker no está instalado." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "✖ El daemon de Docker no está corriendo." >&2; exit 1; }
ok "Docker disponible"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env no existía: lo creé desde .env.example. EDÍTALO (SRSERVI_URL, TELEPHONY_BOT_TOKEN) y vuelve a ejecutar."
    exit 1
  fi
  echo "✖ Falta el archivo .env (copia .env.example y complétalo)." >&2
  exit 1
fi
ok ".env presente"

if grep -q "cambia-esto-por-un-token" .env; then
  warn "El TELEPHONY_BOT_TOKEN sigue con el valor de ejemplo — cámbialo por uno real (debe coincidir con el del server SRServi)."
fi
# Con TWILIO NO hay troncal con usuario/clave: el Auth Token (TWILIO_AUTH_TOKEN) y
# TELEPHONY_SIP_HOST viven en el .env del SERVER SRServi, no aquí. Este stack solo
# acepta el INVITE entrante por la IP de señalización de Twilio; pjsip.conf lo genera
# sync-trunks.sh. Cada tienda solo asocia su número (DID) de Twilio en el panel.

# ── 2. Levantar el stack ─────────────────────────────────────────────────────
log "Construyendo y levantando contenedores"
$DC up -d --build
ok "Contenedores arriba"

# ── 3. Esperar a Ollama y descargar el modelo ────────────────────────────────
log "Esperando a Ollama"
for i in $(seq 1 60); do
  if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then break; fi
  sleep 2
  [ "$i" = 60 ] && { echo "✖ Ollama no respondió a tiempo." >&2; exit 1; }
done
ok "Ollama responde"

log "Descargando modelo '$OLLAMA_MODEL' (solo la primera vez, puede tardar)"
if docker exec srservi-ollama ollama list 2>/dev/null | grep -q "^${OLLAMA_MODEL}"; then
  ok "Modelo '$OLLAMA_MODEL' ya estaba descargado"
else
  docker exec srservi-ollama ollama pull "$OLLAMA_MODEL"
  ok "Modelo '$OLLAMA_MODEL' listo"
fi

# ── 4. Esperar a Whisper y al bot ────────────────────────────────────────────
log "Esperando a Whisper"
for i in $(seq 1 60); do
  if curl -sf http://localhost:9000/docs >/dev/null 2>&1; then break; fi
  sleep 2
  [ "$i" = 60 ] && warn "Whisper aún no responde (puede seguir bajando el modelo). Revisa: $DC logs whisper"
done
curl -sf http://localhost:9000/docs >/dev/null 2>&1 && ok "Whisper responde"

log "Verificando el bot de voz"
for i in $(seq 1 30); do
  if curl -sf http://localhost:8090/health >/dev/null 2>&1; then break; fi
  sleep 1
done
if curl -sf http://localhost:8090/health >/dev/null 2>&1; then
  ok "Bot responde en :8090/health"
else
  warn "El bot no respondió. Revisa: $DC logs bot"
fi

# ── 5. Sincronizar troncales del panel y ver estado ──────────────────────────
log "Sincronizando troncales SIP desde el panel (sync-trunks.sh)"
sleep 3
bash ./sync-trunks.sh || warn "No pude sincronizar troncales — reintenta luego con ./sync-trunks.sh"

# Watcher en segundo plano: resincroniza cada 60s cuando un cliente agrega o
# cambia su troncal en el panel. No arranca otro si ya hay uno corriendo.
if pgrep -f "sync-trunks.sh --watch" >/dev/null 2>&1; then
  ok "Watcher de troncales ya estaba corriendo"
else
  mkdir -p logs
  nohup bash ./sync-trunks.sh --watch >> logs/sync-trunks.log 2>&1 &
  disown 2>/dev/null || true
  ok "Watcher de troncales iniciado (cada 60s) → telephony/logs/sync-trunks.log"
fi

log "Estado del SIP entrante (Asterisk)"
docker exec srservi-asterisk asterisk -rx "pjsip show identifies" 2>/dev/null \
  || warn "No pude consultar Asterisk todavía. Reintenta: docker exec -it srservi-asterisk asterisk -rx \"pjsip show identifies\""

# ── Resumen ──────────────────────────────────────────────────────────────────
log "Listo"
cat <<'EOF'
  Todo levantado. Siguientes pasos:
   1. Arriba debe verse el "identify" entrante de Twilio (NO hay registrations:
      Twilio abre el INVITE por IP, no registra un troncal).
   2. El Auth Token de Twilio (TWILIO_AUTH_TOKEN) y TELEPHONY_SIP_HOST van en el
      .env del SERVER SRServi, no en este stack.
   3. Cada tienda solo asocia su número (DID) de Twilio en SRServi → Llamadas IA.
   4. Llama al número (DID) desde el teléfono: la IA contesta y toma el pedido.

  Comandos útiles:
   - Regenerar SIP entrante:  ./sync-trunks.sh   (--watch para auto-cada-60s)
   - Ver logs en vivo:       docker compose logs -f bot
   - Detener todo:           docker compose down
   - Reiniciar el bot:       docker compose restart bot
EOF
