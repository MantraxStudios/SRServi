# SRServi · Telefonía IA (recepción de llamadas, 100% open source)

Agente de voz que **contesta el teléfono, entiende el pedido hablando con el
cliente y lo deja escrito en el panel** (pestaña **Llamadas IA**). La IA es
software libre: **Asterisk + Whisper + Ollama + Piper**. El **troncal SIP es único
para toda la plataforma: Sinch** (credenciales globales en `telephony/.env`). Cada
tienda solo asocia su **número (DID)** de Sinch desde el panel.

```
Cliente marca tu número (DID de Sinch)
      │  (red telefónica → Sinch → tu troncal SIP único)
      ▼
[ Asterisk ]  ──AudioSocket──►  [ bot de voz ]
                                   │  Whisper (voz→texto)
                                   │  Ollama  (entiende el pedido)
                                   │  Piper   (texto→voz)
                                   ▼
                          Guarda el pedido en SRServi  →  panel "Llamadas IA"
```

## Requisitos

- Servidor Linux con **GPU NVIDIA** (elegido para LLM local rápido).
- **Docker** + **Docker Compose** + **NVIDIA Container Toolkit**.
- Una **cuenta de Sinch con SIP Trunk** (credenciales globales de la plataforma) y
  uno o más **números (DID)** que se asignan a cada tienda.
- El backend de SRServi accesible por HTTPS desde el servidor.

## 1. Configura el token compartido en SRServi

En el `.env` del **servidor SRServi** agrega (y reinicia el server):

```
TELEPHONY_BOT_TOKEN=un-token-largo-y-secreto
```

Ese mismo valor va en el `.env` de esta carpeta.

## 2. Configura este stack

```bash
cd telephony
cp .env.example .env
# edita .env: SRSERVI_URL, TELEPHONY_BOT_TOKEN (igual al del server), WHISPER_MODEL
```

## 3. Troncal SIP único de Sinch

El troncal es **el mismo para todas las tiendas** (Sinch). No se edita
`pjsip.conf` a mano ni se configura por tienda: se define UNA vez en
`telephony/.env` con los datos de tu SIP Trunk de Sinch:

```
SINCH_SIP_HOST=sip.sinch.com
SINCH_SIP_PORT=5060
SINCH_SIP_USER=<usuario del trunk>
SINCH_SIP_PASSWORD=<clave del trunk>
SINCH_SIP_FROM_DOMAIN=          # opcional, si Sinch lo exige
```

`sync-trunks.sh` (vía `gen-pjsip.mjs`) genera `pjsip.conf` con ese único troncal y
recarga Asterisk. El enrutado por **DID** distingue la tienda: el bot resuelve a
qué tienda pertenece el número llamado. Para varias tiendas, asigna varios DID de
Sinch (uno por tienda) y cárgalos en el panel de cada una.

## 4. Levanta todo

```bash
docker compose up -d --build
# Descarga el modelo del LLM (una sola vez):
docker exec -it srservi-ollama ollama pull llama3
```

Verifica:

```bash
docker compose ps
curl http://localhost:8090/health        # bot -> {"ok":true}
curl http://localhost:9000/docs          # whisper (swagger)
docker exec -it srservi-asterisk asterisk -rx "pjsip show registrations"
```

## 5. Configura la tienda en el panel

En **SRServi → Llamadas IA**:

1. Activa **Agente de voz activo**.
2. Ingresa el **número (DID)** que tienes asignado en Sinch (el troncal ya está
   configurado a nivel plataforma; no se piden credenciales SIP aquí).
3. Escribe el **saludo** y las **instrucciones** para la IA.
4. Elige **modelo** (`llama3`) y **voz** (Piper).
5. Guarda.

Llama al número: la IA contesta, toma el pedido y aparece en la lista con su
**transcripción** y el **pedido detectado**.

## Cómo funciona (resumen técnico)

- **Asterisk** contesta y, por dialplan (`extensions.conf`), pide un UUID al bot
  (`GET /new?from=&did=`) y entrega el audio con `AudioSocket()`.
- **bot** (`bot/index.js`): protocolo AudioSocket (`audiosocket.js`), VAD por
  energía, turnos de conversación, y al colgar extrae el pedido en JSON.
- **services.js**: clientes de Whisper (`/asr`), Ollama (`/api/chat`) y Piper
  (CLI → `ffmpeg` a slin 8 kHz), y los endpoints del bot en SRServi.
- **SRServi** expone endpoints `/(api/telephony/bot/*)` autenticados por
  `x-bot-token` y guarda `call_logs` + `ai_call_orders`.

## Ajustes útiles

| Qué | Dónde |
|---|---|
| Sensibilidad de voz (corta/no detecta) | `VAD_THRESHOLD` en `.env` |
| Calidad/velocidad transcripción | `WHISPER_MODEL` (`small`/`medium`/`large-v3`) |
| Modelo del cerebro | `ollama_model` en el panel (ej. `mistral`, `llama3.1`) |
| Voz | `piper_voice` en el panel |
| Más voces Piper | agrégalas en `bot/Dockerfile` (huggingface `rhasspy/piper-voices`) |

## Notas

- **Latencia:** con GPU la respuesta es de ~1–3 s por turno. El modelo Whisper y
  el LLM más grandes dan mejor calidad pero más latencia.
- **Barge-in:** si el cliente habla mientras la IA responde, la IA se calla.
- **Privacidad:** todo corre en tu servidor; el audio no sale a terceros.
- **Pedido → venta:** hoy el pedido queda como "mensaje" para revisar/confirmar
  en el panel. Convertirlo en una venta/orden real del POS es el siguiente paso
  (se puede enganchar a `createOrder` cuando lo quieras).
