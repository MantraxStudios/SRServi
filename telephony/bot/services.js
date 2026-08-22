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
  // ElevenLabs (TTS de pago). Si hay API key, se usa ElevenLabs; si no, Piper.
  ELEVENLABS_API_KEY = '',
  ELEVENLABS_BASE = 'https://api.elevenlabs.io',
  ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5',   // rápido + multilingüe (bueno para teléfono)
  ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM', // voz por defecto si la tienda no eligió una
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

// ─── TTS → PCM slin 8kHz mono para AudioSocket ─────────────────────────────────
// Con API key de ElevenLabs usamos ElevenLabs (voz de alta calidad); si no, Piper.
// La api key/modelo/voz vienen POR TIENDA en el contexto (cada tienda configura la
// suya); si la tienda no puso una, se usa la del .env como fallback.
// `opts` puede ser el string de la voz (compat) o { voice, apiKey, model }.
export function synthesize(text, opts = {}) {
  const o = typeof opts === 'string' ? { voice: opts } : (opts || {});
  const apiKey = (o.apiKey && String(o.apiKey).trim()) || ELEVENLABS_API_KEY;
  const model = (o.model && String(o.model).trim()) || ELEVENLABS_MODEL_ID;
  if (apiKey) return elevenLabsTTS(text, o.voice, apiKey, model);
  return piperTTS(text, o.voice);
}

// Decodifica cualquier audio (mp3/wav) leído por stdin a PCM 8kHz mono s16le.
function ffmpegDecodeToPcm8k(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '8000', '-ac', '1', '-f', 's16le', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    ff.stdout.on('data', d => chunks.push(d));
    ff.on('close', () => resolve(Buffer.concat(chunks)));
    ff.on('error', reject);
    ff.stdin.on('error', () => {});
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
  });
}

// ElevenLabs Text-to-Speech. `voice` es el Voice ID de ElevenLabs (o el default).
// `apiKey` y `model` vienen de la config de la tienda (o del .env como fallback).
async function elevenLabsTTS(text, voice, apiKey = ELEVENLABS_API_KEY, model = ELEVENLABS_MODEL_ID) {
  const voiceId = (voice && String(voice).trim()) || ELEVENLABS_VOICE_ID;
  const url = `${ELEVENLABS_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
  }
  const mp3 = Buffer.from(await res.arrayBuffer());
  return ffmpegDecodeToPcm8k(mp3);
}

// Piper (TTS open source) → PCM 8kHz. Fallback si no hay ElevenLabs.
function piperTTS(text, voice) {
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
