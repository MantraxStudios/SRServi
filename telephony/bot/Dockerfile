# Imagen del bot de voz: Node + ffmpeg + Piper (TTS) + voces en español.
FROM node:20-bookworm-slim

# Dependencias del sistema: ffmpeg (resampleo de audio) y utilidades de descarga
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates wget tar \
    && rm -rf /var/lib/apt/lists/*

# ── Piper (TTS open source) ──
# Binario oficial de rhasspy/piper para linux x86_64
ARG PIPER_VERSION=2023.11.14-2
RUN wget -qO /tmp/piper.tar.gz \
      "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
    && tar -xzf /tmp/piper.tar.gz -C /opt \
    && ln -s /opt/piper/piper /usr/local/bin/piper \
    && rm /tmp/piper.tar.gz

# ── Voces de Piper (es) ── (agrega más desde huggingface rhasspy/piper-voices)
WORKDIR /voices
ARG VOICES_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/es
RUN wget -q "${VOICES_BASE}/es_ES/davefx/medium/es_ES-davefx-medium.onnx"      -O es_ES-davefx-medium.onnx \
 && wget -q "${VOICES_BASE}/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json" -O es_ES-davefx-medium.onnx.json \
 && wget -q "${VOICES_BASE}/es_MX/ald/medium/es_MX-ald-medium.onnx"            -O es_MX-ald-medium.onnx \
 && wget -q "${VOICES_BASE}/es_MX/ald/medium/es_MX-ald-medium.onnx.json"       -O es_MX-ald-medium.onnx.json

ENV PIPER_BIN=piper
ENV PIPER_VOICES_DIR=/voices

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 8090 8091
CMD ["node", "index.js"]
