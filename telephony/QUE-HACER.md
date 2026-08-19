# ✅ Qué hacer — Llamadas IA (checklist de puesta en marcha)

Pasos concretos para dejar funcionando la recepción de llamadas con el agente de
voz IA. La explicación técnica completa está en [`README.md`](./README.md).

---

## Antes de empezar (requisitos)

- [ ] Servidor Linux con **GPU NVIDIA**.
- [ ] Instalado **Docker**, **Docker Compose** y **NVIDIA Container Toolkit**.
- [ ] Cada tienda: una **cuenta de Twilio** con un **número (DID)** de voz y su
      **Auth Token** (esto es lo único con costo). **NO** es un troncal SIP.
- [ ] El backend de SRServi accesible por **HTTPS desde internet** (Twilio debe poder
      llegar al Voice webhook).

---

## 1. Configura el `.env` del servidor SRServi

- [ ] En el `.env` del **servidor SRServi** agrega:
      - `TELEPHONY_BOT_TOKEN=un-token-largo-y-secreto`
      - `TELEPHONY_SIP_HOST=tu-dominio-publico` (host de ESTE Asterisk)
      - `TWILIO_WEBHOOK_URL=https://TU_DOMINIO/api/telephony/twilio/callback` (recom.)
      - (El **Auth Token de cada tienda NO va aquí**: se pone en el panel. `TWILIO_AUTH_TOKEN`
        en el env es solo fallback si usas UNA cuenta Twilio compartida.)
- [ ] **Reinicia** el servidor SRServi.
- [ ] En **Twilio → Phone Numbers → tu número → Voice**, pon "A CALL COMES IN" como
      **Webhook (HTTP POST)**: `https://TU_DOMINIO/api/telephony/twilio/callback`
      (la MISMA URL para todas las tiendas)

## 2. Configura este stack (`telephony/`)

- [ ] `cp .env.example .env`
- [ ] Edita `.env`: `SRSERVI_URL`, `TELEPHONY_BOT_TOKEN` (el **mismo** del paso 1),
      `WHISPER_MODEL` (`small` recomendado).

## 3. SIP entrante (automático, NO se edita a mano)

- [ ] Con **Twilio** NO hay troncal con usuario/clave: Asterisk solo **acepta el
      INVITE** que Twilio abre por IP. `asterisk/pjsip.conf` se **genera solo** con
      `sync-trunks.sh` (confía en los rangos de IP de señalización de Twilio).
- [ ] Abre en tu firewall a los rangos de Twilio el **5060/udp** y el rango RTP.

## 4. Levantar

- [ ] `docker compose up -d --build`
- [ ] `docker exec -it srservi-ollama ollama pull llama3`  (una sola vez)

## 5. Verificar

- [ ] `curl http://localhost:8090/health`  → `{"ok":true}`
- [ ] `docker exec -it srservi-asterisk asterisk -rx "pjsip show identifies"`
      → debe verse el identify entrante de Twilio (NO hay registros/registrations).

## 6. Configurar la tienda en el panel

- [ ] SRServi → **Llamadas IA**
- [ ] Activa **Agente de voz activo**.
- [ ] Ingresa el **número (DID)** comprado en Twilio y el **Auth Token** de tu
      cuenta de Twilio (Account Info → Auth Token; NO el API Key `SK…`).
- [ ] Escribe **saludo** e **instrucciones** de la IA.
- [ ] Elige **modelo** (`llama3`) y **voz** (Piper; por defecto *Claudia · alta*,
      la más natural). Guarda.

## 7. Probar

- [ ] Llama al número → la IA contesta, toma el pedido y aparece en la lista con
      **transcripción** y **pedido detectado**.

---

## Pendiente / mejoras futuras

- [ ] **Convertir el pedido en venta real del POS** (hoy queda como "mensaje" para
      revisar/confirmar). Enganchar a `createOrder` cuando se decida.
- [ ] Más **voces Piper**: agregarlas en `bot/Dockerfile`
      (huggingface `rhasspy/piper-voices`).
- [ ] Afinar `VAD_THRESHOLD` (si corta al cliente o no lo detecta) y `WHISPER_MODEL`
      (calidad vs. latencia).
- [ ] (Opcional) Grabación de llamadas y derivación a humano (`forward_number`).

---

## Referencia rápida de archivos

| Parte | Ubicación |
|---|---|
| Guía técnica completa | `telephony/README.md` |
| Bot de voz (IA) | `telephony/bot/` |
| Config Asterisk (auto-generada) | `telephony/asterisk/pjsip.conf` (la escribe `gen-pjsip.mjs`) |
| Sincronizar troncales del panel | `telephony/sync-trunks.sh` |
| Orquestación | `telephony/docker-compose.yml` |
| Panel admin | `client/src/pages/admin/Calls.jsx` (`/admin/calls`) |
| Backend (tablas + endpoints) | `server/database.js`, `server/index.js` (`/api/telephony/*`) |
