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
const BASE_URL = process.env.BASE_URL || 'https://srservi2.srautomatic.com';

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
    storeMap.set(jid, { history: [], cart: [], lastOrderType: null, lastPayment: null, address: null, customerName: null });
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

// Envía como humano: muestra "escribiendo…" y espera un rato PROPORCIONAL al
// largo del texto (como si lo estuviera tecleando), más un pequeño tiempo de
// "leer/pensar". Se descuenta el tiempo ya transcurrido (la llamada a Ollama ya
// es una pausa real) y se topa con un máximo para no eternizarse.
const TYPE_MS_PER_CHAR = 55;   // velocidad de tipeo (~ una persona en el celu)
const TYPE_MAX_WAIT = 8000;    // tope de espera por mensaje
async function humanSend(sock, jid, text, { startedAt = Date.now(), floor = 1200 } = {}) {
  await setTyping(sock, jid, true);
  const chars = (text || '').length;
  const think = rand(500, 1300);
  const perChar = TYPE_MS_PER_CHAR + rand(-10, 15);
  const target = Math.min(TYPE_MAX_WAIT, think + chars * perChar);
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(floor, target - elapsed);
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
    'SELECT code, name, address, opening_hours FROM stores WHERE id = ?', [storeId]
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
function buildSystemPrompt(storeInfo, flat, cart, menuLink) {
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

  const hours = (storeInfo.opening_hours || '').trim();
  const address = (storeInfo.address || '').trim();
  const infoBlock = `\nINFORMACIÓN DE LA TIENDA (úsala para responder dudas):\n` +
    `- Horario de atención: ${hours || 'NO CONFIGURADO — si preguntan por el horario, di con amabilidad que en este momento no tienes el horario a mano y que te confirman escribiendo, o que pueden pasar en el horario habitual del local. NUNCA inventes horas.'}\n` +
    `- Dirección: ${address || 'NO CONFIGURADA — si preguntan la dirección, di amablemente que no la tienes a mano por aquí y que pueden consultarla al local. NUNCA inventes una dirección.'}\n`;

  const cartBlock = cart.length
    ? `\nPEDIDO ACTUAL DEL CLIENTE (ya registrado por ti):\n${cart.map(i => `  - ${i.name} x${i.qty}`).join('\n')}\n`
    : '\nEl cliente todavía no ha pedido nada.\n';

  return `Eres el mesero virtual de "${storeName}", un local de comida en Chile. Atiendes a los clientes por WhatsApp para tomar sus pedidos. Hablas como una persona real: cercano, amable, chileno, natural. NUNCA suenas como un robot ni como un menú de opciones numeradas.

TU TRABAJO:
- Saludar, recomendar y tomar el pedido conversando de forma natural.
- Entender lo que el cliente quiere aunque lo diga informal ("un completo italiano y una bebida", "ponme dos churrascos", "quiero algo pa' picar").
- Confirmar el pedido, preguntar si es para retirar/comer aquí o delivery, y cómo paga (efectivo o tarjeta).
- Responder dudas de HORARIO, dirección y precios usando SOLO la "INFORMACIÓN DE LA TIENDA" de abajo. Si el cliente pregunta a qué hora abren/cierran o si están abiertos, responde con el horario de atención indicado; nunca lo dejes sin respuesta.${menuLink ? `
- Si el cliente pide ver el MENÚ o la CARTA completa, NO la escribas en texto ni listes todos los productos: comparte SIEMPRE este link donde puede verlo y pedir: ${menuLink}. Igual puedes recomendar 2 o 3 opciones concretas.` : ''}

REGLAS ESTRICTAS:
- Responde SIEMPRE en español chileno, breve (máximo 3-4 oraciones). Usa emojis con moderación 🍔.
- SOLO puedes vender productos que estén en el MENÚ de abajo. ANTES de decir "sí, tenemos X", verifica que X aparezca TAL CUAL en la lista del MENÚ. Si NO está, NO digas que sí: dilo amablemente ("no manejo eso 🙏") y ofrece una alternativa real del menú. Está PROHIBIDO afirmar que tienes algo y que luego el sistema lo marque como no encontrado.
- NUNCA inventes precios: usa los del menú. Los totales los calcula el sistema, no los inventes tú.
- No pidas datos personales innecesarios. Con el pedido, el tipo (retiro/delivery) y el pago basta.

PROCESO PARA CERRAR EL PEDIDO (síguelo en orden, NO te saltes pasos):
1) El cliente elige productos. Cuando diga que ya no quiere agregar más ("no, gracias", "eso sería", "nada más", "listo así"), NO cierres todavía: eso significa que terminó de elegir, no que confirmó.
2) Repite en palabras qué va a llevar y pregunta: ¿es para retirar/comer aquí o delivery a domicilio?
3) Si es DELIVERY, pide la DIRECCIÓN completa de entrega (calle y número, depto/casa, comuna si aplica) y el NOMBRE de quién recibe. Sin dirección NO se puede cerrar un delivery.
4) Pregunta la forma de pago: ¿efectivo o tarjeta?
5) Solo cuando YA tengas todo (productos + tipo de entrega + [dirección y nombre si es delivery] + forma de pago), recién ahí el pedido queda confirmado.
- PROHIBIDO decir "vamos a preparar tu pedido", "gracias por tu pedido", "tu pedido está confirmado" o similares ANTES de tener TODOS los datos. Si falta alguno, tu respuesta debe ser una PREGUNTA pidiendo el dato que falta.
- NUNCA tú escribas el comprobante final (número de pedido, total, "confirmado"): ESO LO ENVÍA EL SISTEMA automáticamente. Tú solo conversas.
- Si el cliente se despide o agradece pero falta algún dato, no inventes una confirmación: pregunta amablemente el dato que falta o despídete sin dar por hecho un pedido que no está completo.
${infoBlock}
MENÚ (nombre exacto: precio):
${menuLines}
${cartBlock}
FORMATO DE SALIDA (MUY IMPORTANTE):
Primero escribe tu respuesta natural para el cliente. Luego, SIEMPRE que el pedido cambie o avance, agrega en la ÚLTIMA línea un bloque JSON EXACTO (el cliente NO lo verá):
ORDER:{"items":[{"name":"NOMBRE EXACTO DEL MENÚ","qty":2}],"order_type":"serve|delivery|null","payment":"cash|card|null","address":"","customer_name":"","confirm":true|false}
- "items": el pedido COMPLETO y actualizado (no solo lo nuevo). Usa el nombre EXACTO del menú.
- "order_type": "serve" para retiro/comer aquí, "delivery" para domicilio, null si aún no lo sabes.
- "payment": "cash" efectivo, "card" tarjeta, null si aún no lo sabes.
- "address": dirección de entrega tal cual la dio el cliente (solo si es delivery; "" si no la sabes o es retiro).
- "customer_name": nombre de quién recibe (si lo dio; "" si no).
- "confirm": true SOLO cuando ya tienes las TRES cosas juntas (productos + tipo de entrega + forma de pago) y el cliente estuvo de acuerdo. Si falta cualquiera, "confirm" es false. Un "gracias" o "no quiero nada más" NO es confirmar.
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
    await send('Listo, cancelé todo 👋. Escríbeme cuando quieras pedir algo.');
    return true;
  }

  const { flat, storeInfo } = await loadMenu(storeId);
  if (!flat.length) {
    await send('Por ahora no tengo productos cargados para tomar tu pedido 🙏. Escríbenos directamente y te ayudamos.');
    return true;
  }

  const menuLink = storeInfo.code ? `${BASE_URL}/store/${storeInfo.code}` : null;

  // Si el cliente pide ver el menú/la carta, se lo mandamos como LINK (no en
  // texto). Atajo directo para las frases más comunes, sin llamar a Ollama.
  const nt = normalize(t);
  const wantsMenu = /(^|\b)(menu|carta)\b/.test(nt) ||
    /\b(ver|muestra|muestrame|mandame|pasame|envia|enviame|quiero ver|tienen|tienes) (el |la )?(menu|carta)\b/.test(nt) ||
    /\bque (tienen|venden|hay|ofrecen)\b/.test(nt);
  if (menuLink && wantsMenu) {
    await send(`¡Claro! 😊 Acá puedes ver todo nuestro menú y pedir directo 👇\n\n${menuLink}\n\nSi prefieres, dime qué se te antoja y te lo anoto por aquí mismo 🍽️`);
    return true;
  }

  const system = buildSystemPrompt(storeInfo, flat, sess.cart, menuLink);
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
    if (typeof order.address === 'string' && order.address.trim().length >= 5) sess.address = order.address.trim();
    if (typeof order.customer_name === 'string' && order.customer_name.trim()) sess.customerName = order.customer_name.trim();

    if (unmatched.length) {
      // Nota suave para no contradecir de golpe un "sí" del modelo: aclaramos que
      // ese producto no está y ofrecemos ayudar, en vez de un seco "no encontré".
      outText += `\n\n_(Ojo 👀: no manejo ${unmatched.join(', ')} en el menú. ¿Te muestro algo parecido?)_`;
    }

    // Seguro: si el modelo quiso confirmar pero faltan datos, ignoramos su texto
    // (que suele decir "vamos a preparar tu pedido") y preguntamos lo que falta.
    // Nunca damos por cerrado un pedido incompleto. En delivery exigimos dirección.
    const needsAddress = sess.lastOrderType === 'delivery' && !sess.address;
    const missing = order.confirm === true && sess.cart.length > 0 &&
      (!sess.lastOrderType || needsAddress || !sess.lastPayment);
    if (missing) {
      const { text: sumText, total } = cartSummary(sess.cart);
      if (!sess.lastOrderType) {
        outText = `Perfecto, entonces te anoto:\n${sumText}\n\n💰 *Total: ${fmt(total)}*\n\n¿Es para retirar/comer aquí 🏪 o delivery a domicilio 🚀?`;
      } else if (needsAddress) {
        outText = `¡Genial, delivery! 🚀 ¿A qué dirección te lo enviamos? Pásame calle y número (y depto/casa y comuna si aplica), y el nombre de quién recibe 🙌`;
      } else {
        outText = `¡Listo! ¿Cómo prefieres pagar: efectivo 💵 o tarjeta 💳?`;
      }
      sess.history.push({ role: 'user', content: t });
      sess.history.push({ role: 'assistant', content: outText });
      if (sess.history.length > 16) sess.history = sess.history.slice(-16);
      await send(outText);
      return true;
    }

    // ¿Listo para crear la orden?
    const ready = order.confirm === true && sess.cart.length > 0 && sess.lastOrderType &&
      sess.lastPayment && !(sess.lastOrderType === 'delivery' && !sess.address);
    if (ready) {
      try {
        const items = sess.cart.map(i => ({
          product_id: i.product_id, quantity: i.qty, unit_price: i.price,
          selected_ingredients: [], selected_extras: [],
        }));
        // Si es @lid (WhatsApp oculta el número), guardamos el JID completo para
        // poder responderle luego; si es un número normal, solo los dígitos.
        const phone = /@lid$/i.test(jid) ? jid : jid.split('@')[0];
        const created = await createOrder(storeId, {
          items, order_type: sess.lastOrderType, payment_method: sess.lastPayment,
          source: 'whatsapp', customer_phone: phone,
          delivery_address: sess.lastOrderType === 'delivery' ? sess.address : null,
          customer_name: sess.customerName || null,
        });
        const { text: sumText, total } = cartSummary(sess.cart);
        const typeLabel = sess.lastOrderType === 'serve' ? 'Retiro / comer aquí 🏪' : 'Delivery 🚀';
        const payLabel = sess.lastPayment === 'cash' ? 'Efectivo 💵' : 'Tarjeta 💳';
        const addrLine = sess.lastOrderType === 'delivery' && sess.address ? `\n📍 ${sess.address}` : '';
        await send(`✅ *¡Pedido #${created.order_number} confirmado!*\n\n${sumText}\n\n💰 *Total: ${fmt(total)}*\n📦 ${typeLabel}${addrLine}\n💳 ${payLabel}\n\n¡Gracias! En un rato tenemos tu pedido listo 🙌`);
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

  await send(outText);
  return true;
}
