#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SRServi · Telefonía IA — arranque de todo el stack en un solo comando.
#
#   ./start.sh            → levanta asterisk + bot + whisper + ollama y verifica
#   OLLAMA_MODEL=mistral ./start.sh   → descarga otro modelo (por defecto llama3)
#
# Hace: valida requisitos → construye/levanta el docker compose → descarga el
# modelo del LLM (una sola vez) → espera a que cada servicio responda → muestra
# el estado del troncal SIP.
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
if grep -qE 'SIP_HOST|SIP_USER|SIP_PASSWORD' asterisk/pjsip.conf; then
  warn "asterisk/pjsip.conf todavía tiene SIP_HOST/SIP_USER/SIP_PASSWORD sin reemplazar — el troncal NO se registrará hasta completarlos."
fi

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

# ── 5. Estado del troncal SIP ────────────────────────────────────────────────
log "Estado del troncal SIP (Asterisk)"
sleep 3
docker exec srservi-asterisk asterisk -rx "pjsip show registrations" 2>/dev/null \
  || warn "No pude consultar Asterisk todavía. Reintenta: docker exec -it srservi-asterisk asterisk -rx \"pjsip show registrations\""

# ── Resumen ──────────────────────────────────────────────────────────────────
log "Listo"
cat <<'EOF'
  Todo levantado. Siguientes pasos:
   1. En el registro de arriba, el troncal debe verse "Registered".
   2. Configura la tienda en SRServi → Llamadas IA (DID, saludo, instrucciones, modelo, voz).
   3. Llama a tu número (DID) desde el teléfono: la IA contesta y toma el pedido.

  Comandos útiles:
   - Ver logs en vivo:   docker compose logs -f bot
   - Detener todo:       docker compose down
   - Reiniciar el bot:   docker compose restart bot
EOF
