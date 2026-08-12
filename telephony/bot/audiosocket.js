// Implementación del protocolo AudioSocket de Asterisk.
// Referencia: https://docs.asterisk.org/Configuration/Channel-Drivers/AudioSocket/
//
// Cada mensaje TCP tiene la forma:
//   [ 1 byte tipo ][ 2 bytes longitud (big-endian) ][ payload ]
//
// Tipos relevantes:
//   0x00 Terminate  -> Asterisk pide terminar la conexión
//   0x01 UUID       -> payload = 16 bytes con el UUID del canal (llega primero)
//   0x10 Audio      -> payload = audio slin (8kHz, 16-bit LE, mono)
//   0xff Error      -> payload con código de error
//
// El audio que ENVIAMOS de vuelta usa el mismo formato con tipo 0x10.

export const AS_TYPE_TERMINATE = 0x00;
export const AS_TYPE_UUID = 0x01;
export const AS_TYPE_AUDIO = 0x10;
export const AS_TYPE_ERROR = 0xff;

// Audio de AudioSocket: 8kHz, 16-bit, mono. 20ms = 160 muestras = 320 bytes.
export const SAMPLE_RATE = 8000;
export const FRAME_MS = 20;
export const FRAME_BYTES = (SAMPLE_RATE / 1000) * FRAME_MS * 2; // 320

// Parser incremental: alimenta bytes y emite mensajes completos.
export class AudioSocketParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages = [];
    while (this.buffer.length >= 3) {
      const type = this.buffer[0];
      const len = this.buffer.readUInt16BE(1);
      if (this.buffer.length < 3 + len) break; // mensaje incompleto
      const payload = this.buffer.subarray(3, 3 + len);
      messages.push({ type, payload: Buffer.from(payload) });
      this.buffer = this.buffer.subarray(3 + len);
    }
    return messages;
  }
}

// Empaqueta un frame de audio para enviarlo a Asterisk.
export function encodeAudioFrame(pcm) {
  const header = Buffer.alloc(3);
  header[0] = AS_TYPE_AUDIO;
  header.writeUInt16BE(pcm.length, 1);
  return Buffer.concat([header, pcm]);
}

export function encodeHangup() {
  return Buffer.from([AS_TYPE_TERMINATE, 0x00, 0x00]);
}

// Envía un buffer PCM completo (slin 8kHz) al socket, en frames de 20ms y a
// ritmo real (~20ms por frame) para que Asterisk lo reproduzca sin cortes.
export async function streamPcm(socket, pcm, { onDone, shouldStop } = {}) {
  for (let i = 0; i < pcm.length; i += FRAME_BYTES) {
    if (shouldStop && shouldStop()) break;
    let frame = pcm.subarray(i, i + FRAME_BYTES);
    if (frame.length < FRAME_BYTES) {
      // rellenar el último frame con silencio
      frame = Buffer.concat([frame, Buffer.alloc(FRAME_BYTES - frame.length)]);
    }
    if (!socket.writable) break;
    socket.write(encodeAudioFrame(frame));
    await new Promise(r => setTimeout(r, FRAME_MS));
  }
  if (onDone) onDone();
}

// Detector de energía simple (RMS) para saber si hay voz en un frame.
export function frameRms(pcm) {
  if (!pcm.length) return 0;
  let sum = 0;
  const n = Math.floor(pcm.length / 2);
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}
