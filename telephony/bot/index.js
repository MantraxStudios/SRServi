// ─────────────────────────────────────────────────────────────────────────────
// SRServi · Agente de voz IA (open source) para recibir llamadas
//
//   Asterisk (AudioSocket)  →  [este bot]  →  Whisper (STT) → Ollama (LLM) → Piper (TTS)
//                                        →  guarda el pedido en SRServi
//
// Flujo:
//   1. El dialplan de Asterisk hace un HTTP GET a /init con {uuid, from, did}.
//   2. Asterisk abre la conexión AudioSocket (TCP) con ese uuid.
//   3. El bot saluda, escucha al cliente (VAD), transcribe, responde con voz y
//      al colgar guarda la transcripción + el pedido estructurado en SRServi.
// ─────────────────────────────────────────────────────────────────────────────
import net from 'net';
import { randomUUID } from 'crypto';
import express from 'express';
import {
  AudioSocketParser, AS_TYPE_UUID, AS_TYPE_AUDIO, AS_TYPE_TERMINATE,
  streamPcm, frameRms, FRAME_BYTES,
} from './audiosocket.js';
import {
  transcribe, chat, synthesize, pcmToWav,
  fetchContext, reportCallStart, reportCallEnd,
} from './services.js';

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8090');
const AS_PORT = parseInt(process.env.AS_PORT || '8091');

// Parámetros del VAD (detección de voz por energía)
const VAD_THRESHOLD = parseInt(process.env.VAD_THRESHOLD || '600'); // RMS int16
const SILENCE_FRAMES = 30;   // 30 * 20ms = 600ms de silencio => fin de turno
const MIN_UTTERANCE_BYTES = 4000; // ~0.25s: descarta ruidos muy cortos

// Metadatos de llamadas pendientes, indexados por UUID (los deja /init).
const pending = new Map();

// ─── HTTP: el dialplan registra la llamada antes de abrir el AudioSocket ───────
const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

// El dialplan de Asterisk pide un UUID nuevo (y de paso registra el número que
// llama + el DID). Devuelve el UUID en texto plano para usarlo en AudioSocket().
app.get('/new', (req, res) => {
  const { from, did } = req.query;
  const uuid = randomUUID();
  pending.set(uuid, { from: from || '', did: did || '', ts: Date.now() });
  for (const [k, v] of pending) if (Date.now() - v.ts > 120000) pending.delete(k);
  res.type('text/plain').send(uuid);
});

// Alternativa: el dialplan genera el UUID y solo registra los metadatos.
app.get('/init', (req, res) => {
  const { uuid, from, did } = req.query;
  if (!uuid) return res.status(400).send('uuid requerido');
  pending.set(uuid, { from: from || '', did: did || '', ts: Date.now() });
  for (const [k, v] of pending) if (Date.now() - v.ts > 120000) pending.delete(k);
  res.send('OK');
});
app.listen(HTTP_PORT, () => console.log(`[bot] HTTP /init en :${HTTP_PORT}`));

// ─── TCP: servidor AudioSocket ─────────────────────────────────────────────────
const server = net.createServer(socket => {
  const parser = new AudioSocketParser();
  const state = {
    socket, uuid: null, meta: null, ctx: null,
    transcript: [], messages: [],
    listening: false, utterance: [], silence: 0, hadSpeech: false,
    resolveUtterance: null, playing: false, stopPlayback: false, bargeCount: 0,
    closed: false, startedAt: Date.now(),
  };

  socket.on('data', chunk => {
    for (const msg of parser.push(chunk)) {
      if (msg.type === AS_TYPE_UUID) {
        state.uuid = msg.payload.toString('hex').replace(
          /^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
        onCallStart(state).catch(err => { console.error('[bot] error:', err); safeHangup(state); });
      } else if (msg.type === AS_TYPE_AUDIO) {
        onAudio(state, msg.payload);
      } else if (msg.type === AS_TYPE_TERMINATE) {
        endCall(state);
      }
    }
  });

  socket.on('close', () => endCall(state));
  socket.on('error', () => endCall(state));
});
server.listen(AS_PORT, () => console.log(`[bot] AudioSocket en :${AS_PORT}`));

// ─── Procesa cada frame de audio entrante (20ms) ───────────────────────────────
function onAudio(state, pcm) {
  const voiced = frameRms(pcm) > VAD_THRESHOLD;

  // Barge-in: si el cliente habla mientras la IA reproduce, cortamos la voz.
  if (state.playing) {
    state.bargeCount = voiced ? state.bargeCount + 1 : 0;
    if (state.bargeCount > 4) state.stopPlayback = true;
    return;
  }
  if (!state.listening) return;

  if (voiced) {
    state.utterance.push(pcm); state.silence = 0; state.hadSpeech = true;
  } else if (state.hadSpeech) {
    state.utterance.push(pcm); state.silence++;
    if (state.silence >= SILENCE_FRAMES) finishUtterance(state);
  }

  // Corta turnos demasiado largos (>15s)
  if (state.utterance.length * FRAME_BYTES > 15 * 8000 * 2) finishUtterance(state);
}

function finishUtterance(state) {
  const buf = Buffer.concat(state.utterance);
  state.utterance = []; state.silence = 0; state.hadSpeech = false; state.listening = false;
  const resolve = state.resolveUtterance; state.resolveUtterance = null;
  if (resolve) resolve(buf);
}

// Espera el próximo turno del cliente (o null si pasa el timeout).
function listen(state, timeoutMs = 9000) {
  return new Promise(resolve => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true; clearTimeout(t);
      state.listening = false; state.resolveUtterance = null;
      resolve(v);
    };
    state.utterance = []; state.silence = 0; state.hadSpeech = false;
    state.listening = true; state.resolveUtterance = finish;
    const t = setTimeout(() => finish(null), timeoutMs);
  });
}

// Reproduce texto por voz (ElevenLabs de la tienda, o Piper) hacia la llamada.
async function say(state, text) {
  if (!text || state.closed) return;
  const clean = text.replace(/\[FIN\]/gi, '').trim();
  if (!clean) return;
  let pcm;
  try {
    pcm = await synthesize(clean, {
      voice: state.ctx.piper_voice,
      apiKey: state.ctx.elevenlabs_api_key,
      model: state.ctx.elevenlabs_model,
    });
  } catch (e) { console.error('[bot] TTS falló:', e.message); return; }
  state.playing = true; state.stopPlayback = false; state.bargeCount = 0;
  await streamPcm(state.socket, pcm, { shouldStop: () => state.stopPlayback || state.closed });
  state.playing = false;
}

// ─── Conversación completa ─────────────────────────────────────────────────────
async function onCallStart(state) {
  const meta = pending.get(state.uuid) || { from: '', did: '' };
  pending.delete(state.uuid);
  state.meta = meta;

  state.ctx = await fetchContext(meta.did, meta.from);
  const { call_log_id } = await reportCallStart({
    store_id: state.ctx.store_id, call_uid: state.uuid,
    from_number: meta.from, to_number: meta.did,
  });
  state.callLogId = call_log_id;

  // Prompt del sistema: personalidad de la tienda + menú + reglas.
  const menuText = (state.ctx.menu || [])
    .map(p => `- ${p.name}${p.category ? ` (${p.category})` : ''}: ${Math.round(Number(p.price) || 0)}`)
    .join('\n');
  const callerNote = state.ctx.caller
    ? `\nEl cliente ya compró antes (${state.ctx.caller.customer_name || 'sin nombre'}, ${state.ctx.caller.order_count} pedidos). Salúdalo con cercanía si corresponde.`
    : '';
  const system = `${state.ctx.system_prompt || 'Eres el asistente telefónico de una tienda. Tomas pedidos por teléfono de forma breve, clara y amable.'}
Idioma: responde SIEMPRE en ${state.ctx.language === 'en' ? 'inglés' : state.ctx.language === 'pt' ? 'portugués' : 'español'}.
Reglas:
- Responde en frases cortas (es una llamada de voz).
- Confirma cada producto y cantidad.
- Pregunta si es para retirar o delivery, y si desea algo más.
- No inventes productos que no estén en el menú.
- Cuando el pedido esté confirmado y te despidas, termina tu último mensaje con el token [FIN].
MENÚ (nombre: precio):
${menuText || '(sin menú cargado)'}${callerNote}`;
  state.messages = [{ role: 'system', content: system }];

  // Saludo inicial
  const greeting = state.ctx.greeting_text;
  state.transcript.push(`IA: ${greeting}`);
  state.messages.push({ role: 'assistant', content: greeting });
  await say(state, greeting);

  // Bucle de turnos
  let emptyTurns = 0;
  while (!state.closed) {
    if ((Date.now() - state.startedAt) / 1000 > (state.ctx.max_seconds || 300)) break;

    const utter = await listen(state, 9000);
    if (state.closed) break;

    if (!utter || utter.length < MIN_UTTERANCE_BYTES) {
      emptyTurns++;
      if (emptyTurns >= 2) { await say(state, 'No lo escuché bien. Gracias por llamar, ¡hasta luego!'); break; }
      await say(state, '¿Sigue ahí? Cuénteme qué desea pedir.');
      continue;
    }
    emptyTurns = 0;

    let text = '';
    try { text = await transcribe(pcmToWav(utter), state.ctx.language); }
    catch (e) { console.error('[bot] STT falló:', e.message); }
    if (!text) continue;

    state.transcript.push(`Cliente: ${text}`);
    state.messages.push({ role: 'user', content: text });

    let reply = '';
    try { reply = await chat(state.ctx.ollama_model, state.messages); }
    catch (e) { console.error('[bot] LLM falló:', e.message); reply = 'Disculpe, ¿me repite por favor?'; }

    state.messages.push({ role: 'assistant', content: reply });
    state.transcript.push(`IA: ${reply.replace(/\[FIN\]/gi, '').trim()}`);
    await say(state, reply);

    if (/\[FIN\]/i.test(reply)) break;
  }

  await say(state, '¡Gracias por su pedido! Que tenga un buen día.');
  endCall(state);
}

// ─── Extracción del pedido y cierre ────────────────────────────────────────────
let ending = new WeakSet();
async function endCall(state) {
  if (state.closed) return;
  state.closed = true;
  safeHangup(state);
  if (ending.has(state)) return;
  ending.add(state);

  const transcript = state.transcript.join('\n');
  let order = null;
  try {
    if (state.ctx && transcript) order = await extractOrder(state, transcript);
  } catch (e) { console.error('[bot] extracción falló:', e.message); }

  try {
    await reportCallEnd({
      store_id: state.ctx?.store_id,
      call_log_id: state.callLogId || null,
      call_uid: state.uuid,
      from_number: state.meta?.from,
      duration_sec: Math.round((Date.now() - state.startedAt) / 1000),
      transcript,
      order,
      summary: order?.summary || null,
      customer_name: order?.customer_name || state.ctx?.caller?.customer_name || null,
      status: 'completed',
    });
  } catch (e) { console.error('[bot] reportCallEnd falló:', e.message); }
}

async function extractOrder(state, transcript) {
  const menu = (state.ctx.menu || []).map(p => ({ name: p.name, price: Math.round(Number(p.price) || 0) }));
  const prompt = [
    { role: 'system', content: 'Extrae el pedido de la transcripción de una llamada. Devuelve SOLO JSON válido con esta forma: {"items":[{"name":string,"quantity":number,"price":number,"notes":string}],"total":number,"customer_name":string|null,"delivery":boolean,"summary":string}. Usa los precios del menú. Si no hay pedido, items vacío.' },
    { role: 'user', content: `MENÚ: ${JSON.stringify(menu)}\n\nTRANSCRIPCIÓN:\n${transcript}` },
  ];
  const raw = await chat(state.ctx.ollama_model, prompt, { json: true });
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || !Array.isArray(parsed.items)) return parsed || null;
  // Recalcula el total por seguridad
  const total = parsed.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  parsed.total = parsed.total || total;
  return parsed;
}

function safeHangup(state) {
  try { if (state.socket.writable) { state.socket.write(Buffer.from([AS_TYPE_TERMINATE, 0, 0])); state.socket.end(); } }
  catch { /* noop */ }
}

process.on('uncaughtException', e => console.error('[bot] uncaught:', e));
process.on('unhandledRejection', e => console.error('[bot] unhandled:', e));
