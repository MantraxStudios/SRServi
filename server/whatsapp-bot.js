import { pool, createOrder } from './database.js';
import { handleAIMessage } from './whatsapp-ai.js';

// In-memory sessions per store+jid
const sessions = new Map();

function getSession(storeId, jid) {
  const key = String(storeId);
  if (!sessions.has(key)) sessions.set(key, new Map());
  const storeMap = sessions.get(key);
  if (!storeMap.has(jid)) {
    storeMap.set(jid, { state: 'idle', cart: [], categories: null, currentCat: null, orderType: null });
  }
  return storeMap.get(jid);
}

function resetSession(storeId, jid) {
  sessions.get(String(storeId))?.delete(jid);
}

async function fetchMenu(storeId) {
  const [cats] = await pool.execute(
    'SELECT id, name FROM categories WHERE store_id = ? ORDER BY sort_order, id',
    [storeId]
  );
  for (const cat of cats) {
    const [prods] = await pool.execute(
      'SELECT id, name, price FROM products WHERE category_id = ? ORDER BY sort_order, id',
      [cat.id]
    );
    cat.products = prods;
  }
  return cats.filter(c => c.products.length > 0);
}

async function fetchProductAddons(productId) {
  const [extras] = await pool.execute(
    `SELECT e.name, e.price FROM extras e
     JOIN product_extras pe ON pe.extra_id = e.id
     WHERE pe.product_id = ? ORDER BY e.name`,
    [productId]
  );
  const [ingredients] = await pool.execute(
    `SELECT i.name, i.price FROM ingredients i
     JOIN product_ingredients pi ON pi.ingredient_id = i.id
     WHERE pi.product_id = ? ORDER BY i.name`,
    [productId]
  );
  return { extras, ingredients };
}

async function getStoreInfo(storeId) {
  const [rows] = await pool.execute(
    'SELECT name, address, opening_hours FROM stores WHERE id = ?',
    [storeId]
  );
  return rows[0] || {};
}

function fmt(p) {
  return `$${Number(p).toLocaleString('es-CL')}`;
}

function cartText(cart) {
  const lines = cart.map(i => `• ${i.name} x${i.qty} = ${fmt(i.price * i.qty)}`);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return lines.join('\n') + `\n\n💰 *Total: ${fmt(total)}*`;
}

async function showMenu(sess, storeId, send) {
  if (!sess.categories) sess.categories = await fetchMenu(storeId);
  const cats = sess.categories;
  if (cats.length === 0) {
    await send('Lo siento, no hay productos disponibles en este momento.');
    return;
  }
  const lines = cats.map((c, i) => `${i + 1}. ${c.name}`);
  const cartHint = sess.cart.length > 0
    ? `\n0. 🛒 Ver carrito (${sess.cart.length} ítem${sess.cart.length > 1 ? 's' : ''})`
    : '';
  await send(`📋 *Menú*\n\n${lines.join('\n')}${cartHint}\n\nEscribe el número de la categoría.`);
  sess.state = 'menu';
}

async function showCategory(sess, send) {
  const cat = sess.currentCat;
  if (!cat) return;
  const lines = cat.products.map((p, i) => `${i + 1}. ${p.name} — ${fmt(p.price)}`);
  await send(`📂 *${cat.name}*\n\n${lines.join('\n')}\n\n0. ← Volver al menú\n\nEscribe el número del producto para agregarlo.`);
}

async function showCart(sess, send) {
  if (sess.cart.length === 0) {
    await send('Tu carrito está vacío. Escribe *menu* para ver los productos. 📋');
    return;
  }
  sess.state = 'cart';
  await send(`🛒 *Tu carrito*\n\n${cartText(sess.cart)}\n\n*confirmar* ✅ — Hacer pedido\n*limpiar* 🗑️ — Vaciar carrito\n*menu* 📋 — Seguir comprando`);
}

// Returns true if message was handled as an FAQ
async function tryFAQ(t, storeId, send) {
  const isAddress = /direcci[oó]n|donde|ubicaci[oó]n|d[oó]nde est[aá]n|c[oó]mo llego/.test(t);
  const isHours = /horario|a qu[eé] hora|cu[aá]ndo abren|cu[aá]ndo cierran|atienden|abren|cierran|horas de atenci[oó]n/.test(t);
  const isPrices = /precio|precios|cu[aá]nto cuesta|cu[aá]nto sale|cuanto vale|tarifas/.test(t);
  const isExtras = /extras|complementos|acompa[nñ]ar|qu[eé] tiene|qu[eé] incluye|qu[eé] viene/.test(t);

  if (!isAddress && !isHours && !isPrices && !isExtras) return false;

  const info = await getStoreInfo(storeId);

  if (isAddress) {
    if (info.address) {
      await send(`📍 *Dirección*\n\n${info.address}\n\nEscribe *menu* para ver nuestros productos o *hola* para empezar un pedido.`);
    } else {
      await send('Aún no tenemos la dirección configurada. Contáctanos directamente para más info. 📍\n\nEscribe *menu* para ver nuestros productos.');
    }
    return true;
  }

  if (isHours) {
    if (info.opening_hours) {
      await send(`🕐 *Horario de atención*\n\n${info.opening_hours}\n\nEscribe *menu* para ver nuestros productos o *hola* para hacer un pedido.`);
    } else {
      await send('Aún no tenemos el horario configurado. Contáctanos directamente para más info. 🕐\n\nEscribe *menu* para ver nuestros productos.');
    }
    return true;
  }

  if (isPrices || isExtras) {
    await send('📋 Puedes ver todos nuestros productos y precios en el menú.\n\nEscribe *menu* para verlos. 👇');
    return true;
  }

  return false;
}

// El cliente escanea el QR del tótem y envía "Avísenme cuando esté listo mi
// pedido #123". Detectamos el número de orden + intención de aviso, guardamos su
// WhatsApp como customer_phone de esa orden y confirmamos. Luego el aviso de
// "listo" lo manda notifyOrderStatusWhatsApp usando ese customer_phone.
export async function tryLinkReadyNotify(storeId, jid, text, sock) {
  const raw = text || '';
  const t = raw.toLowerCase();
  // El número de orden es ALFANUMÉRICO (generateUniqueOrderNumber crea "letra +
  // 2 dígitos", p.ej. "F13"), no solo dígitos. Capturamos la referencia tal cual
  // (letra opcional + dígitos) para no perder el prefijo.
  const numMatch = raw.match(/#\s*([a-z]?\d+[a-z0-9]*)/i)
    || raw.match(/pedido\s+(?:n[°º]?\s*)?#?\s*([a-z]?\d+[a-z0-9]*)/i);
  const hasIntent = /(avis|listo|aviso|notif|liste?[nm])/i.test(t);
  if (!numMatch || !hasIntent) return false;

  // Normalizamos: quitamos todo lo que no sea letra/dígito y pasamos a mayúsculas
  // ("#h83", " H83 ", "h-83" → "H83") para comparar contra order_number igual de
  // normalizado en la BD. Así toleramos espacios, guiones y minúsculas.
  const orderNumber = numMatch[1].replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!orderNumber) return false;

  // Buscamos por número normalizado, la MÁS RECIENTE de esta tienda. No filtramos
  // por fecha con INTERVAL (era frágil ante zona horaria y dejaba pedidos fuera);
  // ORDER BY id DESC ya elige el pedido recién creado y evita reusos antiguos.
  const [rows] = await pool.execute(
    `SELECT id, order_number, store_id FROM orders
     WHERE store_id = ?
       AND UPPER(REPLACE(REPLACE(REPLACE(order_number,'#',''),'-',''),' ','')) = ?
     ORDER BY id DESC LIMIT 1`,
    [storeId, orderNumber]
  );
  let order = rows[0];
  // Qué guardamos como contacto para avisarle luego:
  // - Número normal (@s.whatsapp.net): guardamos solo los dígitos (compatible con
  //   el resto del sistema que espera un teléfono).
  // - @lid (WhatsApp oculta el número por privacidad): guardamos el JID COMPLETO
  //   con su dominio @lid. Guardar solo los dígitos rompía el envío, porque el
  //   aviso se mandaba a <digitos>@s.whatsapp.net (dominio equivocado) y no
  //   llegaba a nadie. El @lid solo es válido en ESTA conexión, así que el aviso
  //   debe salir por la misma tienda que lo recibió.
  const isLid = /@lid$/i.test(jid);
  const phone = isLid ? jid : jid.split('@')[0].replace(/[^0-9]/g, '');

  // Diagnóstico: si no aparece en esta tienda, buscamos en cualquier tienda para
  // saber si es un problema de store_id (WhatsApp conectado en otra tienda) o si
  // el pedido de verdad no existe. Registramos el resultado en consola.
  if (!order) {
    try {
      const [any] = await pool.execute(
        `SELECT id, store_id, order_number, created_at FROM orders
         WHERE UPPER(REPLACE(REPLACE(REPLACE(order_number,'#',''),'-',''),' ','')) = ?
         ORDER BY id DESC LIMIT 3`,
        [orderNumber]
      );
      console.log(`[Bot:${storeId}] Aviso: no encontré "#${orderNumber}" en la tienda ${storeId}. Coincidencias en cualquier tienda:`, JSON.stringify(any));
      // Si existe exactamente en otra tienda y solo hay una, la usamos igual
      // (negocio con varias tiendas pero un solo WhatsApp).
      if (any.length === 1) order = any[0];
    } catch (e) {
      console.error(`[Bot:${storeId}] Error en diagnóstico de aviso:`, e.message);
    }
  }

  if (!order) {
    await sock.sendMessage(jid, { text: `No encontré un pedido reciente con el número *${orderNumber}* 🤔. Revisa el número en tu comprobante e inténtalo de nuevo.` });
    return true;
  }

  await pool.execute('UPDATE orders SET customer_phone = ? WHERE id = ?', [phone, order.id]);
  await sock.sendMessage(jid, { text: `¡Perfecto! 🙌 Te avisaré por aquí apenas tu pedido *#${orderNumber}* esté listo. ¡Gracias por tu compra! 🍽️` });
  console.log(`[Bot:${storeId}] Cliente ${phone} vinculado al aviso del pedido #${orderNumber} (orden ${order.id})`);
  return true;
}

export async function handleBotMessage(storeId, jid, text, sock, msg) {
  // 0º: ¿es un cliente pidiendo que le avisen cuando su pedido esté listo (QR
  // del tótem)? Se atiende antes que nada para no confundirlo con un pedido.
  try {
    if (await tryLinkReadyNotify(storeId, jid, text, sock)) return;
  } catch (err) {
    console.error(`[Bot:${storeId}] Error vinculando aviso de pedido:`, err.message);
  }

  // 1º intento: mesero virtual conversacional con Ollama (IA). Si Ollama no está
  // disponible o falla, devuelve false y caemos al menú clásico por números.
  try {
    const handled = await handleAIMessage(storeId, jid, text, sock, msg);
    if (handled) return;
  } catch (err) {
    console.error(`[Bot:${storeId}] IA no disponible, usando menú clásico:`, err.message);
  }

  const sess = getSession(storeId, jid);
  const t = (text || '').trim().toLowerCase();
  const send = (msg) => sock.sendMessage(jid, { text: msg });

  // Global commands always work
  if (['cancelar', 'salir', 'exit'].includes(t)) {
    resetSession(storeId, jid);
    await send('Pedido cancelado. Escribe *hola* para empezar de nuevo. 👋');
    return;
  }

  if (['hola', 'inicio', 'start', '/start'].includes(t) || sess.state === 'idle') {
    const info = await getStoreInfo(storeId);
    const name = info.name || 'la tienda';
    sess.categories = null;
    sess.cart = [];

    const extras = [];
    if (info.address) extras.push(`📍 ${info.address}`);
    if (info.opening_hours) extras.push(`🕐 ${info.opening_hours}`);
    const infoLine = extras.length > 0 ? `\n\n${extras.join('\n')}` : '';

    await send(`¡Hola! 👋 Bienvenido a *${name}*.${infoLine}\n\nPuedes hacer tu pedido por aquí. 🍽️\n\nEscribe *cancelar* en cualquier momento para salir.`);
    await showMenu(sess, storeId, send);
    return;
  }

  if (['menu', 'menú'].includes(t) && !['order_type', 'payment'].includes(sess.state)) {
    await showMenu(sess, storeId, send);
    return;
  }

  if (['carrito', 'ver carrito', 'ver pedido'].includes(t)) {
    await showCart(sess, send);
    return;
  }

  if (t === 'confirmar' && !['cart', 'order_type', 'payment'].includes(sess.state)) {
    if (sess.cart.length === 0) {
      await send('Tu carrito está vacío. Escribe *menu* para agregar productos. 📋');
      return;
    }
    await showCart(sess, send);
    return;
  }

  // FAQ detection — works in any state except mid-checkout
  if (!['order_type', 'payment'].includes(sess.state)) {
    const handled = await tryFAQ(t, storeId, send);
    if (handled) return;
  }

  switch (sess.state) {
    case 'menu': {
      const n = parseInt(t);
      if (n === 0 && sess.cart.length > 0) {
        await showCart(sess, send);
      } else if (!isNaN(n) && n >= 1 && n <= (sess.categories?.length || 0)) {
        sess.currentCat = sess.categories[n - 1];
        sess.state = 'cat';
        await showCategory(sess, send);
      } else {
        await send('Escribe el número de la categoría que deseas ver, o *cancelar* para salir.');
      }
      break;
    }

    case 'cat': {
      const n = parseInt(t);
      if (n === 0) {
        await showMenu(sess, storeId, send);
      } else if (!isNaN(n) && n >= 1 && n <= (sess.currentCat?.products.length || 0)) {
        const prod = sess.currentCat.products[n - 1];
        const existing = sess.cart.find(i => i.product_id === prod.id);
        if (existing) existing.qty++;
        else sess.cart.push({ product_id: prod.id, name: prod.name, price: parseFloat(prod.price), qty: 1 });
        const total = sess.cart.reduce((s, i) => s + i.price * i.qty, 0);

        // Build addons info
        let addonsText = '';
        try {
          const { extras, ingredients } = await fetchProductAddons(prod.id);
          const parts = [];
          if (extras.length > 0) {
            parts.push(`➕ *Extras disponibles:* ${extras.map(e => `${e.name}${e.price > 0 ? ` (+${fmt(e.price)})` : ''}`).join(', ')}`);
          }
          if (ingredients.length > 0) {
            parts.push(`🥗 *Complementos:* ${ingredients.map(i => `${i.name}${i.price > 0 ? ` (+${fmt(i.price)})` : ''}`).join(', ')}`);
          }
          if (parts.length > 0) addonsText = `\n\n${parts.join('\n')}\n_(Los extras y complementos se agregan en el local)_`;
        } catch {}

        await send(`✅ *${prod.name}* agregado.${addonsText}\n\n🛒 ${sess.cart.length} producto${sess.cart.length > 1 ? 's' : ''} — *${fmt(total)}*\n\nAgrega más, escribe *0* para el menú, *carrito* para ver el pedido, o *confirmar* para pedir.`);
      } else {
        await send(`Escribe el número del producto (1–${sess.currentCat?.products.length || '?'}), *0* para volver al menú.`);
      }
      break;
    }

    case 'cart': {
      if (t === 'confirmar') {
        sess.state = 'order_type';
        await send('📦 ¿Cómo deseas recibir tu pedido?\n\n1. 🏪 Para aquí / llevar\n2. 🚀 Delivery a domicilio');
      } else if (t === 'limpiar') {
        sess.cart = [];
        await send('🗑️ Carrito vaciado.');
        await showMenu(sess, storeId, send);
      } else {
        await send('Escribe *confirmar* para hacer el pedido, *limpiar* para vaciar el carrito, o *menu* para seguir comprando.');
      }
      break;
    }

    case 'order_type': {
      if (t === '1') sess.orderType = 'serve';
      else if (t === '2') sess.orderType = 'delivery';
      else { await send('Escribe *1* para comer aquí o *2* para delivery.'); return; }
      sess.state = 'payment';
      await send('💳 ¿Cómo deseas pagar?\n\n1. 💵 Efectivo\n2. 💳 Tarjeta');
      break;
    }

    case 'payment': {
      let payMethod = null;
      if (t === '1') payMethod = 'cash';
      else if (t === '2') payMethod = 'card';
      else { await send('Escribe *1* para efectivo o *2* para tarjeta.'); return; }

      try {
        const items = sess.cart.map(i => ({
          product_id: i.product_id, quantity: i.qty, unit_price: i.price,
          selected_ingredients: [], selected_extras: []
        }));
        const phone = jid.split('@')[0];
        const order = await createOrder(storeId, { items, order_type: sess.orderType, payment_method: payMethod, source: 'whatsapp', customer_phone: phone });
        const payLabel = payMethod === 'cash' ? 'Efectivo 💵' : 'Tarjeta 💳';
        const typeLabel = sess.orderType === 'serve' ? 'Para aquí / llevar 🏪' : 'Delivery 🚀';
        await send(`✅ *¡Pedido #${order.order_number} creado!*\n\n${cartText(sess.cart)}\n\n📦 ${typeLabel}\n💳 ${payLabel}\n\n¡Gracias por tu pedido! Pronto te contactaremos. 🙏\n\nEscribe *hola* para hacer otro pedido.`);
        resetSession(storeId, jid);
      } catch (err) {
        console.error(`[Bot:${storeId}] Error al crear orden:`, err.message);
        await send('❌ Error al procesar el pedido. Escribe *confirmar* para intentar de nuevo o *cancelar* para salir.');
      }
      break;
    }
  }
}
