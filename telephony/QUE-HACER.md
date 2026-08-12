# ✅ Qué hacer — Llamadas IA (checklist de puesta en marcha)

Pasos concretos para dejar funcionando la recepción de llamadas con el agente de
voz IA. La explicación técnica completa está en [`README.md`](./README.md).

---

## Antes de empezar (requisitos)

- [ ] Servidor Linux con **GPU NVIDIA**.
- [ ] Instalado **Docker**, **Docker Compose** y **NVIDIA Container Toolkit**.
- [ ] Un **número + troncal SIP** contratado con un proveedor (esto es lo único con costo).
- [ ] El backend de SRServi accesible por HTTPS desde el servidor.

---

## 1. Token compartido

- [ ] En el `.env` del **servidor SRServi** agrega:
      `TELEPHONY_BOT_TOKEN=un-token-largo-y-secreto`
- [ ] **Reinicia** el servidor SRServi.

## 2. Configura este stack (`telephony/`)

- [ ] `cp .env.example .env`
- [ ] Edita `.env`: `SRSERVI_URL`, `TELEPHONY_BOT_TOKEN` (el **mismo** del paso 1),
      `WHISPER_MODEL` (`small` recomendado).

## 3. Datos del troncal en Asterisk

- [ ] En `asterisk/pjsip.conf` reemplaza `SIP_HOST`, `SIP_USER`, `SIP_PASSWORD`
      con los datos de tu proveedor.
- [ ] (Varias tiendas/números: duplica los bloques o usa Asterisk Realtime — ver README.)

## 4. Levantar

- [ ] `docker compose up -d --build`
- [ ] `docker exec -it srservi-ollama ollama pull llama3`  (una sola vez)

## 5. Verificar

- [ ] `curl http://localhost:8090/health`  → `{"ok":true}`
- [ ] `docker exec -it srservi-asterisk asterisk -rx "pjsip show registrations"`
      → el troncal debe verse **Registered**.

## 6. Configurar la tienda en el panel

- [ ] SRServi → **Llamadas IA**
- [ ] Activa **Agente de voz activo**.
- [ ] Ingresa el **número (DID)** + datos del troncal.
- [ ] Escribe **saludo** e **instrucciones** de la IA.
- [ ] Elige **modelo** (`llama3`) y **voz** (Piper). Guarda.

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
| Config Asterisk | `telephony/asterisk/` |
| Orquestación | `telephony/docker-compose.yml` |
| Panel admin | `client/src/pages/admin/Calls.jsx` (`/admin/calls`) |
| Backend (tablas + endpoints) | `server/database.js`, `server/index.js` (`/api/telephony/*`) |
