import { pool, createOrder } from './database.js';

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

async function getStoreName(storeId) {
  const [rows] = await pool.execute('SELECT name FROM stores WHERE id = ?', [storeId]);
  return rows[0]?.name || 'la tienda';
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

export async function handleBotMessage(storeId, jid, text, sock) {
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
    const name = await getStoreName(storeId);
    sess.categories = null;
    sess.cart = [];
    await send(`¡Hola! 👋 Bienvenido a *${name}*.\n\nPuedes hacer tu pedido por aquí. 🍽️\n\nEscribe *cancelar* en cualquier momento para salir.`);
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
        await send(`✅ *${prod.name}* agregado.\n\n🛒 ${sess.cart.length} producto${sess.cart.length > 1 ? 's' : ''} — *${fmt(total)}*\n\nAgrega más, escribe *0* para el menú, *carrito* para ver el pedido, o *confirmar* para pedir.`);
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
        const order = await createOrder(storeId, { items, order_type: sess.orderType, payment_method: payMethod });
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
