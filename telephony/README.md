# SRServi · Telefonía IA (recepción de llamadas, 100% open source)

Agente de voz que **contesta el teléfono, entiende el pedido hablando con el
cliente y lo deja escrito en el panel** (pestaña **Llamadas IA**). La IA es
software libre: **Asterisk + Whisper + Ollama + Piper**.

**Twilio se usa por su _Programmable Voice_ (NO Elastic SIP Trunking):** número
(DID) + **Auth Token** + **Voice webhook**. Cuando entra una llamada, Twilio hace
un POST **firmado** (`X-Twilio-Signature`) al backend SRServi; SRServi responde con
TwiML `<Dial><Sip>` y Twilio entrega la llamada a este Asterisk.

**Cada tienda compra su PROPIO Twilio.** Por eso el **DID** y el **Auth Token** se
ingresan por tienda en el panel (**Llamadas IA**) y se guardan en la base de datos;
el webhook resuelve la tienda por el DID (`To`) y valida la firma con el Auth Token
de esa tienda. El webhook es **el mismo** para todas: cada cuenta de Twilio apunta
a la misma URL.

```
Cliente marca tu número (DID de Twilio)
      │
      ▼
[ Twilio Voice ] ──POST firmado (Voice webhook)──► [ backend SRServi ]
      ▲                                               │ verifica X-Twilio-Signature (Auth Token)
      │            responde TwiML: <Dial><Sip>  ◄─────┘ resuelve tienda por DID (To)
      │  (INVITE desde las IPs de señalización de Twilio)
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
- Cada tienda: una **cuenta de Twilio** con un **número (DID)** de voz y su **Auth
  Token** (Console → Account Info). Registrarse en Twilio es abierto y sencillo.
- El backend de SRServi accesible por **HTTPS** desde internet (Twilio debe poder
  llegar a la URL del webhook).

## 1. Configura SRServi (backend Node)

En el `.env` del **servidor SRServi** agrega (y reinicia el server):

```
# Token compartido con el bot de voz (servicio de esta carpeta)
TELEPHONY_BOT_TOKEN=un-token-largo-y-secreto

# Host público de ESTE Asterisk (mismo servidor que SRServi) al que Twilio enviará
# el INVITE del <Sip>. Ej: srservi2.srautomatic.com
TELEPHONY_SIP_HOST=tu-dominio-publico
# Recomendado: la URL EXACTA del webhook, para validar la firma sin ambigüedad:
TWILIO_WEBHOOK_URL=https://TU_DOMINIO/api/telephony/twilio/callback
# Opcionales (por defecto udp / 5060):
# TELEPHONY_SIP_PORT=5060
# TELEPHONY_SIP_TRANSPORT=udp
# TWILIO_AUTH_TOKEN=...   # SOLO si usas UNA cuenta Twilio compartida (fallback).
#                          En multi-tienda NO se usa: cada tienda pone su token en el panel.
```

> El **Auth Token de cada tienda NO va aquí**: se ingresa por tienda en el panel
> (Llamadas IA) y se guarda en la base de datos. El env `TWILIO_AUTH_TOKEN` es solo
> un fallback opcional para un despliegue de cuenta única.

Luego, en el **panel de Twilio de cada tienda → Phone Numbers → su número → Voice**,
configura "A CALL COMES IN" como **Webhook (HTTP POST)** apuntando a la MISMA URL:

```
https://TU_DOMINIO/api/telephony/twilio/callback
```

`TELEPHONY_BOT_TOKEN` también va en el `.env` de esta carpeta.

## 2. Configura este stack

```bash
cd telephony
cp .env.example .env
# edita .env: SRSERVI_URL, TELEPHONY_BOT_TOKEN (igual al del server), WHISPER_MODEL
```

## 3. SIP entrante desde Twilio (sin troncal, sin registro)

Como la integración es por **Programmable Voice + `<Dial><Sip>`**, Asterisk NO se
registra en ningún lado: solo **acepta el INVITE entrante** que Twilio abre desde
sus IPs de señalización. `sync-trunks.sh` (vía `gen-pjsip.mjs`) genera un
`pjsip.conf` con un endpoint que confía en la **IP de origen de Twilio** (identify
por CIDR). No hay usuario/clave SIP.

Por defecto se permiten **todos** los rangos de señalización de Twilio. Para acotar
(Chile ≈ São Paulo) puedes fijar en `telephony/.env`:

```
TWILIO_SIP_IPS=177.71.206.192/30      # opcional; por defecto, todos los de Twilio
SIP_BIND_PORT=5060                    # puerto SIP alcanzable desde internet
```

> **Firewall:** abre a estos rangos de Twilio el puerto **5060/udp** (señalización)
> y el rango RTP de tu Asterisk (**10000–20000/udp** por defecto). Rangos de
> señalización de Twilio: us1 `54.172.60.0/30`, us2 `54.244.51.0/30`, ie1
> `54.171.127.192/30`, de1 `35.156.191.128/30`, jp1 `54.65.63.192/30`, sg1
> `54.169.127.128/30`, au1 `54.252.254.64/30`, **br1 `177.71.206.192/30`**.

El enrutado por **DID** distingue la tienda: el DID viaja como usuario del URI SIP
del `<Sip>`, y el dialplan/bot resuelve a qué tienda pertenece. Para varias
tiendas, compra varios DID en Twilio (uno por tienda) y cárgalos en el panel.

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
# No hay registros SIP. Verifica el endpoint/identify entrantes:
docker exec -it srservi-asterisk asterisk -rx "pjsip show endpoint trunk_twilio"
docker exec -it srservi-asterisk asterisk -rx "pjsip show identifies"
```

## 5. Configura la tienda en el panel

En **SRServi → Llamadas IA**:

1. Activa **Agente de voz activo**.
2. Ingresa el **número (DID)** que compraste en Twilio y el **Auth Token** de tu
   cuenta de Twilio (Account Info → Auth Token; NO el API Key `SK…`).
3. Escribe el **saludo** y las **instrucciones** para la IA.
4. Elige **modelo** (`llama3`) y **voz** (Piper; por defecto *Claudia · alta*, la
   más natural).
5. Guarda.

Llama al número: la IA contesta, toma el pedido y aparece en la lista con su
**transcripción** y el **pedido detectado**.

## Cómo funciona (resumen técnico)

- **Twilio Programmable Voice** hace un POST firmado (HMAC-SHA1 con el Auth Token,
  header `X-Twilio-Signature`) a `/api/telephony/twilio/callback` al entrar la
  llamada. SRServi valida la firma, resuelve la tienda por el DID (`To`) y responde
  TwiML `<Dial><Sip>` hacia este Asterisk.
- **Asterisk** recibe el INVITE de Twilio (aceptado por IP, sin registro) y, por
  dialplan (`extensions.conf`), pide un UUID al bot (`GET /new?from=&did=`) y
  entrega el audio con `AudioSocket()`.
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
| Voz | `piper_voice` en el panel (por defecto la más natural) |
| Más voces Piper | agrégalas en `bot/Dockerfile` (huggingface `rhasspy/piper-voices`) |

## Notas

- **Latencia:** con GPU la respuesta es de ~1–3 s por turno. El modelo Whisper y
  el LLM más grandes dan mejor calidad pero más latencia.
- **Barge-in:** si el cliente habla mientras la IA responde, la IA se calla.
- **Privacidad:** todo corre en tu servidor; el audio no sale a terceros.
- **Pedido → venta:** hoy el pedido queda como "mensaje" para revisar/confirmar
  en el panel. Convertirlo en una venta/orden real del POS es el siguiente paso
  (se puede enganchar a `createOrder` cuando lo quieras).
