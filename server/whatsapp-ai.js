// ─────────────────────────────────────────────────────────────────────────────
//  WhatsApp AI — Mesero virtual conversacional con Ollama (León IA)
//
//  Convierte el bot de pedidos de un menú rígido por números en una conversación
//  natural: entiende frases como "quiero dos completos italianos y una coca para
//  delivery, pago con efectivo". Usa el MISMO Ollama que León IA.
//
//  El modelo conversa en español chileno y, cada turno, devuelve el estado
//  completo del pedido en un bloque JSON (marcador ORDER:{...}). Node valida ese
//  pedido contra el menú real de la tienda (nombres + precios desde la BD) y
//  crea la orden. NUNCA se confía en los precios que invente el modelo.
//
//  Si Ollama no está disponible, handleAIMessage devuelve false y whatsapp-bot.js
//  cae automáticamente al menú clásico por números.
// ─────────────────────────────────────────────────────────────────────────────
import { pool, createOrder } from './database.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

// Sesiones en memoria: Map<storeId, Map<jid, { history, cart, lastOrderType, lastPayment }>>
const sessions = new Map();
// Cache del menú por tienda (evita golpear la BD en cada mensaje)
const menuCache = new Map(); // Map<storeId, { at, menu, flat, storeInfo }>
const MENU_TTL_MS = 60 * 1000;

// Cache del modelo disponible en Ollama
let _cachedModel = null;
let _modelCheckedAt = 0;

function getSession(storeId, jid) {
  const key = String(storeId);
  if (!sessions.has(key)) sessions.set(key, new Map());
  const storeMap = sessions.get(key);
  if (!storeMap.has(jid)) {
    storeMap.set(jid, { history: [], cart: [], lastOrderType: null, lastPayment: null });
  }
  return storeMap.get(jid);
}

export function resetAISession(storeId, jid) {
  sessions.get(String(storeId))?.delete(jid);
}

function fmt(p) {
  return `$${Number(p).toLocaleString('es-CL')}`;
}

// ─── Comportamiento humano (typing, pausas, muletillas) ──────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function setTyping(sock, jid, on) {
  try { await sock.sendPresenceUpdate(on ? 'composing' : 'paused', jid); } catch {}
}

// Muletillas naturales para "ganar tiempo" como lo haría una persona.
const FILLERS = [
  'Dame un segundito 🙏',
  'Ya, un momento y te confirmo 👀',
  'Espérame tantito ✍️',
  'Altiro te reviso 🙌',
];

// De vez en cuando manda un "dame un segundo" antes de responder de verdad.
async function maybeFiller(sock, jid) {
  if (Math.random() > 0.55) return;
  await setTyping(sock, jid, true);
  await sleep(rand(700, 1500));
  await setTyping(sock, jid, false);
  await sock.sendMessage(jid, { text: FILLERS[rand(0, FILLERS.length - 1)] });
}

// Envía como humano: muestra "escribiendo…" y espera una pausa natural. El
// retardo se calcula contra el tiempo ya transcurrido "pensando" (la llamada a
// Ollama ya es una pausa real), para no acumular esperas eternas ni responder
// de golpe cuando el modelo es muy rápido.
async function humanSend(sock, jid, text, { startedAt = Date.now(), min = 3000, max = 5000 } = {}) {
  await setTyping(sock, jid, true);
  const target = rand(min, max);
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(1200, target - elapsed);
  await sleep(wait);
  await setTyping(sock, jid, false);
  await sock.sendMessage(jid, { text });
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Menú / info de tienda ───────────────────────────────────────────────────
async function loadMenu(storeId) {
  const cached = menuCache.get(String(storeId));
  if (cached && Date.now() - cached.at < MENU_TTL_MS) return cached;

  const [cats] = await pool.execute(
    'SELECT id, name FROM categories WHERE store_id = ? ORDER BY sort_order, id',
    [storeId]
  );
  const flat = []; // { id, name, price, category, extras:[], ingredients:[] }
  for (const cat of cats) {
    const [prods] = await pool.execute(
      'SELECT id, name, price FROM products WHERE category_id = ? ORDER BY sort_order, id',
      [cat.id]
    );
    cat.products = prods;
    for (const p of prods) {
      let extras = [], ingredients = [];
      try {
        const [ex] = await pool.execute(
          `SELECT e.name, e.price FROM extras e
           JOIN product_extras pe ON pe.extra_id = e.id
           WHERE pe.product_id = ? ORDER BY e.name`, [p.id]
        );
        const [ing] = await pool.execute(
          `SELECT i.name, i.price FROM ingredients i
           JOIN product_ingredients pi ON pi.ingredient_id = i.id
           WHERE pi.product_id = ? ORDER BY i.name`, [p.id]
        );
        extras = ex; ingredients = ing;
      } catch {}
      flat.push({
        id: p.id, name: p.name, price: parseFloat(p.price),
        category: cat.name, extras, ingredients,
      });
    }
  }
  const menu = cats.filter(c => c.products.length > 0);

  const [rows] = await pool.execute(
    'SELECT name, address, opening_hours FROM stores WHERE id = ?', [storeId]
  );
  const storeInfo = rows[0] || {};

  const entry = { at: Date.now(), menu, flat, storeInfo };
  menuCache.set(String(storeId), entry);
  return entry;
}

// Empareja un nombre libre del modelo con un producto real del menú
function matchProduct(flat, name) {
  const q = normalize(name);
  if (!q) return null;
  // 1. Coincidencia exacta
  let hit = flat.find(p => normalize(p.name) === q);
  if (hit) return hit;
  // 2. El nombre del producto contiene la consulta o viceversa
  hit = flat.find(p => normalize(p.name).includes(q) || q.includes(normalize(p.name)));
  if (hit) return hit;
  // 3. Coincidencia por palabras (todas las palabras de la consulta están en el producto)
  const words = q.split(' ').filter(w => w.length > 2);
  if (words.length) {
    hit = flat.find(p => {
      const pn = normalize(p.name);
      return words.every(w => pn.includes(w));
    });
    if (hit) return hit;
  }
  return null;
}

// ─── Ollama ──────────────────────────────────────────────────────────────────
async function getModel() {
  if (_cachedModel && Date.now() - _modelCheckedAt < 60000) return _cachedModel;
  const forced = process.env.LEON_MODEL;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    if (!models.length) return null;
    _modelCheckedAt = Date.now();
    if (forced && models.some(m => m.includes(forced))) { _cachedModel = forced; return forced; }
    for (const pref of ['qwen2.5:7b', 'qwen2.5:3b', 'llama3.2:3b', 'mistral:7b', 'llama3:8b', 'qwen2.5:14b']) {
      const m = models.find(x => x.includes(pref));
      if (m) { _cachedModel = m; return m; }
    }
    _cachedModel = models[0];
    return _cachedModel;
  } catch {
    return null;
  }
}

export async function isOllamaAvailable() {
  return (await getModel()) !== null;
}

async function callOllama(messages, model) {
  const ka = process.env.LEON_KEEP_ALIVE || '-1';
  const keep_alive = /^-?\d+$/.test(ka) ? parseInt(ka) : ka;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 120000);
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, stream: false, keep_alive,
        options: { temperature: 0.6, num_predict: 500 },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const data = await resp.json();
    return data.message?.content || '';
  } finally {
    clearTimeout(to);
  }
}

// ─── Prompt del sistema ──────────────────────────────────────────────────────
function buildSystemPrompt(storeInfo, flat, cart) {
  const storeName = storeInfo.name || 'la tienda';

  // Menú compacto por categoría (el modelo ve nombres y precios exactos)
  const byCat = {};
  for (const p of flat) (byCat[p.category] ||= []).push(p);
  const menuLines = Object.entries(byCat).map(([cat, prods]) => {
    const items = prods.map(p => {
      let line = `  - ${p.name}: ${fmt(p.price)}`;
      if (p.extras.length) line += ` (extras: ${p.extras.map(e => e.name).join(', ')})`;
      return line;
    }).join('\n');
    return `${cat}:\n${items}`;
  }).join('\n');

  const infoBits = [];
  if (storeInfo.address) infoBits.push(`Dirección: ${storeInfo.address}`);
  if (storeInfo.opening_hours) infoBits.push(`Horario: ${storeInfo.opening_hours}`);
  const infoBlock = infoBits.length ? `\nINFORMACIÓN DE LA TIENDA:\n${infoBits.join('\n')}\n` : '';

  const cartBlock = cart.length
    ? `\nPEDIDO ACTUAL DEL CLIENTE (ya registrado por ti):\n${cart.map(i => `  - ${i.name} x${i.qty}`).join('\n')}\n`
    : '\nEl cliente todavía no ha pedido nada.\n';

  return `Eres el mesero virtual de "${storeName}", un local de comida en Chile. Atiendes a los clientes por WhatsApp para tomar sus pedidos. Hablas como una persona real: cercano, amable, chileno, natural. NUNCA suenas como un robot ni como un menú de opciones numeradas.

TU TRABAJO:
- Saludar, recomendar y tomar el pedido conversando de forma natural.
- Entender lo que el cliente quiere aunque lo diga informal ("un completo italiano y una bebida", "ponme dos churrascos", "quiero algo pa' picar").
- Confirmar el pedido, preguntar si es para retirar/comer aquí o delivery, y cómo paga (efectivo o tarjeta).
- Responder dudas de horario, dirección y precios usando SOLO la info de abajo.

REGLAS ESTRICTAS:
- Responde SIEMPRE en español chileno, breve (máximo 3-4 oraciones). Usa emojis con moderación 🍔.
- SOLO puedes vender productos que estén en el MENÚ de abajo. Si piden algo que no existe, dilo amablemente y ofrece una alternativa del menú.
- NUNCA inventes precios: usa los del menú. Los totales los calcula el sistema, no los inventes tú.
- No pidas datos personales innecesarios. Con el pedido, el tipo (retiro/delivery) y el pago basta.
- Antes de cerrar el pedido, confirma en palabras qué llevará el cliente.
${infoBlock}
MENÚ (nombre exacto: precio):
${menuLines}
${cartBlock}
FORMATO DE SALIDA (MUY IMPORTANTE):
Primero escribe tu respuesta natural para el cliente. Luego, SIEMPRE que el pedido cambie o avance, agrega en la ÚLTIMA línea un bloque JSON EXACTO (el cliente NO lo verá):
ORDER:{"items":[{"name":"NOMBRE EXACTO DEL MENÚ","qty":2}],"order_type":"serve|delivery|null","payment":"cash|card|null","confirm":true|false}
- "items": el pedido COMPLETO y actualizado (no solo lo nuevo). Usa el nombre EXACTO del menú.
- "order_type": "serve" para retiro/comer aquí, "delivery" para domicilio, null si aún no lo sabes.
- "payment": "cash" efectivo, "card" tarjeta, null si aún no lo sabes.
- "confirm": true SOLO cuando el cliente ya confirmó el pedido Y definió tipo de entrega Y forma de pago. En cualquier otro caso, false.
Si el cliente solo está preguntando (horario, saludo, dudas) y no hay pedido, NO agregues el bloque ORDER.`;
}

// ─── Parseo del bloque ORDER ─────────────────────────────────────────────────
function extractOrder(text) {
  const idx = text.lastIndexOf('ORDER:');
  if (idx === -1) return { reply: text.trim(), order: null };
  const reply = text.slice(0, idx).trim();
  const jsonPart = text.slice(idx + 'ORDER:'.length).trim();
  // Tomar desde la primera { hasta la } que balancea
  const start = jsonPart.indexOf('{');
  if (start === -1) return { reply, order: null };
  let depth = 0, end = -1;
  for (let i = start; i < jsonPart.length; i++) {
    if (jsonPart[i] === '{') depth++;
    else if (jsonPart[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return { reply, order: null };
  try {
    const order = JSON.parse(jsonPart.slice(start, end + 1));
    return { reply, order };
  } catch {
    return { reply, order: null };
  }
}

// Reconstruye el carrito validado contra el menú real
function buildCart(flat, orderItems) {
  const cart = [];
  const unmatched = [];
  for (const it of orderItems || []) {
    const prod = matchProduct(flat, it.name);
    const qty = Math.max(1, parseInt(it.qty) || 1);
    if (!prod) { unmatched.push(it.name); continue; }
    const existing = cart.find(c => c.product_id === prod.id);
    if (existing) existing.qty += qty;
    else cart.push({ product_id: prod.id, name: prod.name, price: prod.price, qty });
  }
  return { cart, unmatched };
}

function cartSummary(cart) {
  const lines = cart.map(i => `• ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}`);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return { text: lines.join('\n'), total };
}

// ─── Handler principal ───────────────────────────────────────────────────────
// Devuelve true si atendió el mensaje con IA; false si Ollama no está disponible
// (para que whatsapp-bot.js caiga al menú clásico).
export async function handleAIMessage(storeId, jid, text, sock, msg) {
  const started = Date.now();
  const model = await getModel();
  if (!model) return false; // Ollama caído → fallback al bot clásico

  // Marcar el mensaje como leído (doble check azul) — se ve humano
  if (msg?.key) { try { await sock.readMessages([msg.key]); } catch {} }

  const send = (txt, opts) => humanSend(sock, jid, txt, { startedAt: started, ...opts });
  const sess = getSession(storeId, jid);
  const t = (text || '').trim();

  // Comando de escape universal
  if (['cancelar', 'salir', 'reiniciar'].includes(normalize(t))) {
    resetAISession(storeId, jid);
    await send('Listo, cancelé todo 👋. Escríbeme cuando quieras pedir algo.', { min: 1400, max: 2600 });
    return true;
  }

  const { flat, storeInfo } = await loadMenu(storeId);
  if (!flat.length) {
    await send('Por ahora no tengo productos cargados para tomar tu pedido 🙏. Escríbenos directamente y te ayudamos.', { min: 1400, max: 2600 });
    return true;
  }

  const system = buildSystemPrompt(storeInfo, flat, sess.cart);
  const messages = [
    { role: 'system', content: system },
    ...sess.history.slice(-8),
    { role: 'user', content: t },
  ];

  // Muletilla ocasional ("dame un segundito") + mantener "escribiendo…"
  // mientras el modelo piensa. Da la sensación de una persona real atendiendo.
  await maybeFiller(sock, jid);
  await setTyping(sock, jid, true);

  let raw;
  try {
    raw = await callOllama(messages, model);
  } catch (err) {
    console.error(`[AI Bot:${storeId}] Ollama error:`, err.message);
    await setTyping(sock, jid, false);
    return false; // fallback al menú clásico
  }

  const { reply, order } = extractOrder(raw);
  let outText = reply || 'Cuéntame, ¿qué te gustaría pedir? 😊';

  // Actualizar carrito si el modelo devolvió un pedido
  if (order && Array.isArray(order.items)) {
    const { cart, unmatched } = buildCart(flat, order.items);
    sess.cart = cart;
    if (order.order_type === 'serve' || order.order_type === 'delivery') sess.lastOrderType = order.order_type;
    if (order.payment === 'cash' || order.payment === 'card') sess.lastPayment = order.payment;

    if (unmatched.length) {
      outText += `\n\n_(No encontré en el menú: ${unmatched.join(', ')})_`;
    }

    // ¿Listo para crear la orden?
    const ready = order.confirm === true && sess.cart.length > 0 && sess.lastOrderType && sess.lastPayment;
    if (ready) {
      try {
        const items = sess.cart.map(i => ({
          product_id: i.product_id, quantity: i.qty, unit_price: i.price,
          selected_ingredients: [], selected_extras: [],
        }));
        const phone = jid.split('@')[0];
        const created = await createOrder(storeId, {
          items, order_type: sess.lastOrderType, payment_method: sess.lastPayment,
          source: 'whatsapp', customer_phone: phone,
        });
        const { text: sumText, total } = cartSummary(sess.cart);
        const typeLabel = sess.lastOrderType === 'serve' ? 'Retiro / comer aquí 🏪' : 'Delivery 🚀';
        const payLabel = sess.lastPayment === 'cash' ? 'Efectivo 💵' : 'Tarjeta 💳';
        await send(`✅ *¡Pedido #${created.order_number} confirmado!*\n\n${sumText}\n\n💰 *Total: ${fmt(total)}*\n📦 ${typeLabel}\n💳 ${payLabel}\n\n¡Gracias! En un rato tenemos tu pedido listo 🙌`);
        resetAISession(storeId, jid);
        return true;
      } catch (err) {
        console.error(`[AI Bot:${storeId}] Error al crear orden:`, err.message);
        await send('Uy, tuve un problema al registrar el pedido 😕. ¿Lo intentamos de nuevo?');
        return true;
      }
    }
  }

  // Guardar en historial y responder
  sess.history.push({ role: 'user', content: t });
  sess.history.push({ role: 'assistant', content: outText });
  if (sess.history.length > 16) sess.history = sess.history.slice(-16);

  await send(outText, { min: 3500, max: 6000 });
  return true;
}
