# SRServi · Telefonía IA (recepción de llamadas, 100% open source)

Agente de voz que **contesta el teléfono, entiende el pedido hablando con el
cliente y lo deja escrito en el panel** (pestaña **Llamadas IA**). La IA es
software libre: **Asterisk + Whisper + Ollama + Piper**.

**Sinch se usa por su _Voice API_ (NO SIP trunking):** número (DID) +
**Application Key/Secret** + **Callback**. Cuando entra una llamada, Sinch hace un
POST **firmado** al backend SRServi; SRServi responde con SVAML `connectSip` y
Sinch entrega la llamada a este Asterisk. Cada tienda solo asocia su **número
(DID)** desde el panel.

```
Cliente marca tu número (DID de Sinch)
      │
      ▼
[ Sinch Voice API ] ──POST firmado (Incoming Call Event)──► [ backend SRServi ]
      ▲                                                         │ verifica firma (App Secret)
      │            responde SVAML: connectSip  ◄───────────────┘ resuelve tienda por DID
      │  (INVITE desde media servers de Sinch)
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
- Una **cuenta de Sinch con una Voice API app** (Application Key + Secret) y uno o
  más **números (DID)** que se asignan a cada tienda.
- El backend de SRServi accesible por **HTTPS** desde internet (Sinch debe poder
  llegar a la URL del callback).

## 1. Configura SRServi (backend Node)

En el `.env` del **servidor SRServi** agrega (y reinicia el server):

```
# Token compartido con el bot de voz (servicio de esta carpeta)
TELEPHONY_BOT_TOKEN=un-token-largo-y-secreto

# Credenciales GLOBALES de la Voice API de Sinch (una sola cuenta para todo)
SINCH_APP_KEY=tu-application-key
SINCH_APP_SECRET=tu-application-secret

# Host público de ESTE Asterisk (mismo servidor que SRServi) al que Sinch
# enviará el INVITE del connectSip. Ej: srservi2.srautomatic.com
TELEPHONY_SIP_HOST=tu-dominio-publico
# Opcionales (por defecto udp / 5060):
# TELEPHONY_SIP_PORT=5060
# TELEPHONY_SIP_TRANSPORT=udp
```

Luego, en el **panel de Sinch → tu Voice API app**, configura el **Callback URL**:

```
https://TU_DOMINIO/api/telephony/sinch/callback
```

`TELEPHONY_BOT_TOKEN` también va en el `.env` de esta carpeta.

## 2. Configura este stack

```bash
cd telephony
cp .env.example .env
# edita .env: SRSERVI_URL, TELEPHONY_BOT_TOKEN (igual al del server), WHISPER_MODEL
```

## 3. SIP entrante desde Sinch (sin troncal, sin registro)

Como la integración es por **Voice API + `connectSip`**, Asterisk NO se registra
en ningún lado: solo **acepta el INVITE entrante** que Sinch abre desde sus media
servers. `sync-trunks.sh` (vía `gen-pjsip.mjs`) genera un `pjsip.conf` con un
endpoint que confía en la **IP de origen de Sinch** (identify por CIDR). No hay
usuario/clave SIP.

Por defecto se permiten **todos** los rangos de Sinch. Para acotar (Chile =
Sudamérica) puedes fijar en `telephony/.env`:

```
SINCH_SIP_IPS=206.146.138.0/28      # opcional; por defecto, todos los de Sinch
SIP_BIND_PORT=5060                  # puerto SIP alcanzable desde internet
```

> **Firewall:** abre a estos rangos de Sinch el puerto **5060/udp** (señalización)
> y **10000–60000/udp** (RTP). Rangos de señalización: Europa `206.146.136.0/28`,
> Norteamérica `206.146.133.0/28`, **Sudamérica `206.146.138.0/28`**, Sudeste Asia
> `206.146.139.0/28`, Australia `206.146.141.0/28`.

El enrutado por **DID** distingue la tienda: el DID viaja como usuario del URI SIP
del `connectSip`, y el dialplan/bot resuelve a qué tienda pertenece. Para varias
tiendas, asigna varios DID de Sinch (uno por tienda) y cárgalos en el panel.

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
# No hay registros SIP (Voice API). Verifica el endpoint/identify entrantes:
docker exec -it srservi-asterisk asterisk -rx "pjsip show endpoint trunk_sinch"
docker exec -it srservi-asterisk asterisk -rx "pjsip show identifies"
```

## 5. Configura la tienda en el panel

En **SRServi → Llamadas IA**:

1. Activa **Agente de voz activo**.
2. Ingresa el **número (DID)** que tienes asignado en Sinch (las credenciales de
   la Voice API son globales y viven en el `.env` del server; aquí no se piden).
3. Escribe el **saludo** y las **instrucciones** para la IA.
4. Elige **modelo** (`llama3`) y **voz** (Piper).
5. Guarda.

Llama al número: la IA contesta, toma el pedido y aparece en la lista con su
**transcripción** y el **pedido detectado**.

## Cómo funciona (resumen técnico)

- **Sinch Voice API** hace un POST firmado (HMAC-SHA256 con el App Secret) a
  `/api/telephony/sinch/callback` al entrar la llamada. SRServi valida la firma,
  resuelve la tienda por DID y responde SVAML `connectSip` hacia este Asterisk.
- **Asterisk** recibe el INVITE de los media servers de Sinch (aceptado por IP,
  sin registro) y, por dialplan (`extensions.conf`), pide un UUID al bot
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
