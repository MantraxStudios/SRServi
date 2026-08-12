// Integraciones open source del agente de voz: Whisper (STT), Ollama (LLM),
// Piper (TTS) y la API de SRServi. Todo por HTTP/CLI, sin servicios de pago.
import { spawn } from 'child_process';

const {
  WHISPER_URL = 'http://whisper:9000',
  OLLAMA_URL = 'http://ollama:11434',
  PIPER_BIN = 'piper',
  PIPER_VOICES_DIR = '/voices',
  SRSERVI_URL = 'https://srservi2.srautomatic.com',
  TELEPHONY_BOT_TOKEN = '',
} = process.env;

// ─── STT: faster-whisper (imagen onerahmet/openai-whisper-asr-webservice) ──────
// Recibe un WAV (8kHz mono) y devuelve el texto transcrito.
export async function transcribe(wavBuffer, language = 'es') {
  const form = new FormData();
  form.append('audio_file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  const url = `${WHISPER_URL}/asr?method=openai-whisper&language=${language}&output=json&task=transcribe`;
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Whisper ${res.status}`);
  const data = await res.json();
  return (data.text || '').trim();
}

// ─── LLM: Ollama /api/chat ─────────────────────────────────────────────────────
export async function chat(model, messages, { json = false } = {}) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      options: { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return data.message?.content || '';
}

// ─── TTS: Piper CLI → PCM slin 8kHz para AudioSocket ───────────────────────────
// Piper produce WAV (16 o 22.05kHz); lo pasamos por ffmpeg a 8kHz mono s16le raw.
export function synthesize(text, voice) {
  return new Promise((resolve, reject) => {
    const modelPath = `${PIPER_VOICES_DIR}/${voice}.onnx`;
    const piper = spawn(PIPER_BIN, ['--model', modelPath, '--output_file', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '8000', '-ac', '1', '-f', 's16le', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const chunks = [];
    ff.stdout.on('data', d => chunks.push(d));
    ff.on('close', () => resolve(Buffer.concat(chunks)));
    ff.on('error', reject);
    piper.on('error', reject);
    piper.stdout.pipe(ff.stdin);

    piper.stdin.write(text);
    piper.stdin.end();
  });
}

// Envuelve PCM raw (8kHz mono 16-bit) en un contenedor WAV para Whisper.
export function pcmToWav(pcm, sampleRate = 8000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);       // PCM
  header.writeUInt16LE(1, 22);       // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// ─── SRServi API (endpoints del bot, auth por token compartido) ────────────────
const botHeaders = { 'Content-Type': 'application/json', 'x-bot-token': TELEPHONY_BOT_TOKEN };

export async function fetchContext(did, from) {
  const url = `${SRSERVI_URL}/api/telephony/bot/context?did=${encodeURIComponent(did)}&from=${encodeURIComponent(from || '')}`;
  const res = await fetch(url, { headers: botHeaders });
  if (!res.ok) throw new Error(`context ${res.status}`);
  return res.json();
}

export async function reportCallStart(payload) {
  const res = await fetch(`${SRSERVI_URL}/api/telephony/bot/call-start`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(payload),
  });
  return res.ok ? res.json() : {};
}

export async function reportCallEnd(payload) {
  const res = await fetch(`${SRSERVI_URL}/api/telephony/bot/call-end`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(payload),
  });
  return res.ok ? res.json() : {};
}
