/**
 * SRBrain — Sistema Autónomo de SRServi
 * Corre diariamente, analiza datos, toma decisiones y actúa.
 */

import fetch from 'node-fetch';
import {
  getAllEnabledAiConfigs,
  getAiConfig,
  updateAiConfigLastRun,
  logAiActivity,
  getMonthlySalesHistory,
  getYesterdayTaskStatus,
  getWorkersWithPhone,
  getWorkersWithBirthdayToday,
  createCoupon,
  pool
} from './database.js';
import { getWhatsAppStatus, sendWhatsAppMessage } from './whatsapp.js';

const LEON_URL = 'http://localhost:7777';

// ─── Mensajería: WhatsApp (preferido) o SMS via Twilio (fallback) ────────────

async function sendMessage(storeId, to, message) {
  if (!to) return false;

  // Intentar WhatsApp primero
  const wa = getWhatsAppStatus(storeId);
  if (wa.connected) {
    try {
      await sendWhatsAppMessage(storeId, to, message);
      return { channel: 'whatsapp', success: true };
    } catch (e) {
      console.warn('[SRBrain] WhatsApp send failed, falling back to SMS:', e.message);
    }
  }

  // Fallback: Twilio SMS
  return sendSMS(to, message);
}

async function sendSMS(to, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return false;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ To: to.startsWith('+') ? to : '+' + to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    return res.ok ? { channel: 'sms', success: true } : false;
  } catch { return false; }
}

// ─── León IA — análisis y decisiones ────────────────────────────────────────

async function askLeon(storeId, prompt, timeoutMs = 90000) {
  try {
    const res = await fetch(`${LEON_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt, store_id: storeId, history: [] }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[SRBrain] León IA HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (!data.answer) console.warn(`[SRBrain] León IA respondió sin campo "answer":`, JSON.stringify(data).slice(0, 200));
    return data.answer || null;
  } catch (e) {
    console.warn(`[SRBrain] Error llamando a León IA:`, e.message);
    return null;
  }
}

async function generateMoraleMessage(storeId, workerNames) {
  const names = workerNames.length > 0 ? workerNames.join(', ') : 'el equipo';
  const prompt = `Escribe un mensaje motivacional corto (2-3 oraciones) para el equipo de trabajo. Sus nombres son: ${names}. El mensaje debe ser cálido y personal, en español latinoamericano, como si fuera el administrador escribiendo por WhatsApp. Solo el mensaje, sin saludos extra ni explicaciones.`;
  const answer = await askLeon(storeId, prompt, 40000);
  return answer?.trim() || getRandomMorale();
}

async function getDecisionsFromLeon(storeId, context) {
  const prompt = `Eres el sistema autónomo SRBrain. Analiza estos datos y responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin markdown.

DATOS DEL NEGOCIO:
${JSON.stringify(context, null, 2)}

Responde con este JSON exacto (solo los tipos de acciones que apliquen, puede ser array vacío):
{
  "analysis": "análisis breve en 1-2 oraciones",
  "actions": [
    {
      "type": "create_coupon",
      "reason": "por qué",
      "data": { "code": "PROMO20", "name": "Promoción Especial", "discount_type": "percent", "discount_value": 20, "min_order_total": 0, "usage_limit": 50 }
    },
    {
      "type": "send_worker_reminder",
      "reason": "por qué",
      "data": { "worker_id": 0, "worker_name": "Nombre", "worker_phone": "+56912345678", "missed_task": "Nombre de tarea", "message": "Hola [nombre], te escribo porque ayer no pude ver que completaras [tarea]. ¿Todo bien? Recuerda que es importante para el equipo. ¡Ánimo!" }
    },
    {
      "type": "send_morale",
      "reason": "mensaje diario de ánimo",
      "data": { "message": "¡Buenos días equipo! [mensaje motivador de 1-2 oraciones personalizado según el rendimiento]" }
    }
  ]
}

REGLAS ESTRICTAS:
- Solo crea cupón si las ventas del mes actual están ${context.promotion_threshold || 20}% o más por debajo del promedio histórico
- Solo envía recordatorio de tarea a trabajadores que realmente fallaron ayer (missed_task no null)
- Siempre incluye al menos 1 acción send_morale (mensaje diario de ánimo)
- El mensaje debe sonar humano, cálido, como si fuera el administrador escribiendo
- SOLO JSON, nada más`;

  const raw = await askLeon(storeId, prompt);
  if (!raw) return null;

  // Extraer JSON del texto (por si el modelo agrega texto extra)
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch { return null; }
}

// ─── Generador de mensajes de ánimo (fallback si León no responde) ────────────

const moraleMessages = [
  '¡Buenos días equipo! Cada día es una oportunidad de dar lo mejor. Sigamos adelante con buena energía.',
  '¡Hola a todos! Recuerden que el trabajo en equipo hace la diferencia. ¡Gracias por su esfuerzo!',
  '¡Buen día! El esfuerzo de cada uno de ustedes es lo que hace crecer este negocio. ¡Muchas gracias!',
  '¡Buenos días! Hoy es un buen día para superarse. ¡Cuenten conmigo siempre!',
  '¡Equipo, buenos días! Cada pedido bien atendido es un cliente feliz. ¡A darle con todo hoy!',
  '¡Hola! Recuerden mantener la actitud positiva. Su trabajo importa más de lo que creen.',
  '¡Buenos días! Esta semana va a ser excelente. Confío mucho en ustedes.',
  '¡Buen día equipo! El servicio que dan cada día marca la diferencia. ¡Gracias por todo!',
];

function getRandomMorale() {
  return moraleMessages[Math.floor(Math.random() * moraleMessages.length)];
}

// ─── Ejecutar acción ─────────────────────────────────────────────────────────

async function executeAction(storeId, action, config, workers) {
  const { type, reason, data } = action;

  if (type === 'create_coupon' && config.auto_promotions) {
    try {
      // Verificar que no exista ya un cupón activo creado por el brain hoy
      const [existing] = await pool.execute(
        `SELECT id FROM coupons WHERE store_id = ? AND code = ? LIMIT 1`,
        [storeId, data.code]
      );
      if (existing.length > 0) {
        await logAiActivity(storeId, 'coupon_skipped', `Cupón ${data.code} ya existe`, { reason });
        return;
      }
      await createCoupon(storeId, {
        code: data.code,
        name: data.name || 'Promoción Automática',
        discount_type: data.discount_type || 'percent',
        discount_value: data.discount_value || 15,
        min_order_total: data.min_order_total || 0,
        usage_limit: data.usage_limit || 100,
        is_active: true
      });
      await logAiActivity(storeId, 'coupon_created', `Cupón "${data.code}" creado: ${reason}`, data);
    } catch (e) {
      await logAiActivity(storeId, 'coupon_error', `Error al crear cupón: ${e.message}`, { reason });
    }
  }

  if (type === 'send_worker_reminder' && config.worker_reminders) {
    const phone = data.worker_phone;
    const message = data.message;
    if (!phone || !message) {
      await logAiActivity(storeId, 'message_skipped', `Recordatorio sin teléfono o mensaje para ${data.worker_name}`);
      return;
    }
    try {
      const result = await sendMessage(storeId, phone, message);
      if (result?.success) {
        await logAiActivity(storeId, 'message_sent', `Recordatorio enviado a ${data.worker_name} (${result.channel})`, { reason, worker: data.worker_name });
      } else {
        await logAiActivity(storeId, 'message_failed', `No se pudo enviar recordatorio a ${data.worker_name} — WhatsApp no conectado`);
      }
    } catch (e) {
      await logAiActivity(storeId, 'message_failed', `Error enviando recordatorio a ${data.worker_name}: ${e.message}`);
    }
  }

  if (type === 'send_morale' && config.morale_messages) {
    const message = data.message || getRandomMorale();
    const targets = workers.filter(w => w.phone);
    if (!targets.length) {
      await logAiActivity(storeId, 'message_skipped', 'Ningún trabajador tiene teléfono registrado');
      return;
    }
    let sent = 0;
    for (const worker of targets) {
      const personalizedMsg = message.replace(/\[nombre\]/gi, worker.name);
      try {
        const result = await sendMessage(storeId, worker.phone, personalizedMsg);
        if (result?.success) sent++;
      } catch (e) {
        console.warn(`[SRBrain] Error enviando ánimo a ${worker.name}:`, e.message);
      }
    }
    await logAiActivity(storeId, sent > 0 ? 'message_sent' : 'message_failed',
      sent > 0 ? `Mensaje de ánimo enviado a ${sent}/${targets.length} trabajadores` : 'No se pudo enviar mensaje de ánimo — WhatsApp no conectado',
      { message }
    );
  }
}

// ─── Felicitaciones de cumpleaños + cupón de descuento ───────────────────────

async function generateBirthdayMessage(storeId, workerName, couponCode, percent, senderName) {
  const prompt = `Escribe un mensaje de WhatsApp cálido y personal para felicitar a ${workerName} por su cumpleaños, de parte de "${senderName || 'el equipo'}". Debe ser alegre y sincero (2-3 oraciones), en español latinoamericano. Al final menciona que le regalan un cupón de ${percent}% de descuento con el código ${couponCode} como regalo. Solo el mensaje, sin comillas ni explicaciones.`;
  const answer = await askLeon(storeId, prompt, 40000);
  const clean = answer?.trim();
  if (clean && clean.includes(couponCode)) return clean;
  // Fallback (o si el modelo olvidó el código, usar plantilla que sí lo incluye)
  return `🎉 ¡Feliz cumpleaños, ${workerName}! 🥳\n\nDe parte de ${senderName || 'todo el equipo'}, te deseamos un día increíble. Gracias por ser parte de este equipo. 🎂\n\n🎁 Como regalo, tienes un *${percent}% de descuento* con el código *${couponCode}*. ¡Disfrútalo!`;
}

async function sendBirthdayGreetings(storeId, config) {
  let birthdayWorkers;
  try {
    birthdayWorkers = await getWorkersWithBirthdayToday(storeId);
  } catch (e) {
    console.warn(`[SRBrain] Error obteniendo cumpleaños tienda ${storeId}:`, e.message);
    return;
  }
  if (!birthdayWorkers.length) return;

  console.log(`[SRBrain] 🎂 ${birthdayWorkers.length} trabajador(es) cumplen años hoy en tienda ${storeId}`);
  const percent = Number(config.birthday_coupon_percent) || 15;
  const year = new Date().getFullYear();

  for (const worker of birthdayWorkers) {
    const couponCode = `CUMPLE-${worker.id}-${year}`;
    try {
      // Idempotencia: si el cupón ya existe, ya lo felicitamos hoy → no reenviar
      const [existing] = await pool.execute(
        `SELECT id FROM coupons WHERE store_id = ? AND code = ? LIMIT 1`,
        [storeId, couponCode]
      );
      if (existing.length > 0) {
        console.log(`[SRBrain] Cumpleaños de ${worker.name} ya procesado (${couponCode}) — omitiendo`);
        continue;
      }

      // Crear cupón personal de cumpleaños (un solo uso)
      await createCoupon(storeId, {
        code: couponCode,
        name: `Cumpleaños de ${worker.name}`,
        discount_type: 'percent',
        discount_value: percent,
        min_order_total: 0,
        usage_limit: 1,
        is_active: true
      });

      const message = await generateBirthdayMessage(storeId, worker.name, couponCode, percent, config.sender_name);
      const result = await sendMessage(storeId, worker.phone, message);
      if (result?.success) {
        console.log(`[SRBrain] 🎉 Felicitación de cumpleaños enviada a ${worker.name} (${result.channel})`);
        await logAiActivity(storeId, 'birthday_sent', `Felicitación de cumpleaños + cupón ${couponCode} (${percent}%) enviada a ${worker.name}`, { worker: worker.name, coupon: couponCode, percent });
      } else {
        console.warn(`[SRBrain] ⚠ No se pudo enviar felicitación a ${worker.name} — WhatsApp no conectado`);
        await logAiActivity(storeId, 'birthday_failed', `No se pudo enviar felicitación a ${worker.name} (WhatsApp no conectado). Cupón ${couponCode} creado.`, { worker: worker.name, coupon: couponCode });
      }
    } catch (e) {
      console.warn(`[SRBrain] Error en cumpleaños de ${worker.name}:`, e.message);
      await logAiActivity(storeId, 'birthday_error', `Error felicitando a ${worker.name}: ${e.message}`);
    }
  }
}

// ─── Run para una tienda ─────────────────────────────────────────────────────

async function runForStore(storeId) {
  const config = await getAiConfig(storeId);
  if (!config?.enabled) {
    console.log(`[SRBrain] Tienda ${storeId} deshabilitada — omitiendo`);
    return;
  }

  console.log(`[SRBrain] Ejecutando para tienda ${storeId}...`);

  try {
    console.log(`[SRBrain] Obteniendo datos de la tienda ${storeId}...`);
    const [salesHistory, yesterdayTasks, workers] = await Promise.all([
      getMonthlySalesHistory(storeId, 6),
      getYesterdayTaskStatus(storeId),
      getWorkersWithPhone(storeId)
    ]);
    console.log(`[SRBrain] Datos: ${salesHistory.length} meses historial, ${yesterdayTasks.length} tareas ayer, ${workers.length} trabajadores con teléfono`);

    // Calcular proyección del mes
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthData = salesHistory.find(r => r.month === currentMonthKey);
    const currentRevenue = parseFloat(currentMonthData?.revenue || 0);
    const projectedRevenue = dayOfMonth > 0 ? (currentRevenue / dayOfMonth) * daysInMonth : 0;

    const pastMonths = salesHistory.filter(r => r.month !== currentMonthKey);
    const avgRevenue = pastMonths.length > 0
      ? pastMonths.reduce((s, r) => s + parseFloat(r.revenue), 0) / pastMonths.length
      : 0;

    const pctDiff = avgRevenue > 0 ? ((projectedRevenue - avgRevenue) / avgRevenue) * 100 : 0;

    // Tareas perdidas ayer
    const missedTasks = yesterdayTasks.filter(t => !t.completed_at);
    console.log(`[SRBrain] Proyección: $${Math.round(projectedRevenue)} vs promedio $${Math.round(avgRevenue)} (${Math.round(pctDiff)}%) | Tareas fallidas ayer: ${missedTasks.length}`);

    const context = {
      store_id: storeId,
      today: now.toISOString().split('T')[0],
      current_month: currentMonthKey,
      day_of_month: dayOfMonth,
      current_revenue: Math.round(currentRevenue),
      projected_monthly_revenue: Math.round(projectedRevenue),
      avg_monthly_revenue_last_5_months: Math.round(avgRevenue),
      projected_vs_avg_percent: Math.round(pctDiff),
      sales_below_threshold: pctDiff < -(config.promotion_threshold || 20),
      sales_history: salesHistory,
      missed_tasks_yesterday: missedTasks.map(t => ({
        worker_id: t.worker_id,
        worker_name: t.worker_name,
        worker_phone: t.worker_phone,
        task_name: t.name
      })),
      workers_count: workers.length,
      promotion_threshold: config.promotion_threshold || 20
    };

    // ── 1. Mensaje de ánimo (siempre, prompt simple y rápido) ──────────────────
    if (config.morale_messages && workers.length > 0) {
      console.log(`[SRBrain] Generando mensaje de ánimo con Ollama...`);
      const msg = await generateMoraleMessage(storeId, workers.map(w => w.name));
      console.log(`[SRBrain] Mensaje: "${msg.slice(0, 80)}..."`);
      let sent = 0;
      for (const worker of workers) {
        try {
          const result = await sendMessage(storeId, worker.phone, msg);
          if (result?.success) { sent++; console.log(`[SRBrain] ✉ Enviado a ${worker.name} (${result.channel})`); }
          else console.warn(`[SRBrain] ⚠ No se pudo enviar a ${worker.name} — WhatsApp no conectado`);
        } catch (e) { console.warn(`[SRBrain] Error enviando a ${worker.name}:`, e.message); }
      }
      await logAiActivity(storeId, sent > 0 ? 'message_sent' : 'message_failed',
        `Mensaje de ánimo: ${sent}/${workers.length} enviados`, { message: msg });
    } else if (config.morale_messages && workers.length === 0) {
      console.warn(`[SRBrain] Ningún trabajador tiene teléfono registrado`);
    }

    // ── 1b. Felicitaciones de cumpleaños + cupón de descuento ──────────────────
    if (config.birthday_greetings !== false) {
      await sendBirthdayGreetings(storeId, config);
    }

    // ── 2. Análisis completo: cupones y recordatorios de tareas ────────────────
    if (config.auto_promotions || (config.worker_reminders && missedTasks.length > 0)) {
      console.log(`[SRBrain] Consultando a León IA para análisis de cupones/recordatorios...`);
      const decisions = await getDecisionsFromLeon(storeId, context);
      if (!decisions) {
        console.warn(`[SRBrain] ⚠ León IA no respondió para análisis completo`);
      } else {
        console.log(`[SRBrain] León IA — ${decisions.actions?.length || 0} acciones: ${(decisions.actions || []).map(a => a.type).join(', ') || 'ninguna'}`);
        await logAiActivity(storeId, 'brain_run', decisions.analysis || 'Análisis ejecutado', { projected_vs_avg_percent: context.projected_vs_avg_percent, missed_tasks: missedTasks.length });
        for (const action of (decisions.actions || [])) {
          if (action.type === 'send_morale') continue; // ya enviado arriba
          console.log(`[SRBrain] Ejecutando acción: ${action.type}`);
          await executeAction(storeId, action, config, workers);
        }
      }
    }

    await updateAiConfigLastRun(storeId);
    console.log(`[SRBrain] ✅ Tienda ${storeId} completada`);
  } catch (e) {
    console.error(`[SRBrain] ❌ Error en tienda ${storeId}:`, e.message);
    await logAiActivity(storeId, 'brain_error', `Error: ${e.message}`);
  }
}

// ─── Entry point: corre para todas las tiendas habilitadas ───────────────────

export async function runSrBrain() {
  console.log('[SRBrain] Iniciando ciclo diario...');
  try {
    const configs = await getAllEnabledAiConfigs();
    if (!configs.length) {
      console.log('[SRBrain] No hay tiendas con SRBrain habilitado.');
      return;
    }
    for (const cfg of configs) {
      await runForStore(cfg.store_id);
    }
    console.log('[SRBrain] Ciclo diario completado.');
  } catch (e) {
    console.error('[SRBrain] Error crítico:', e.message);
  }
}

// Permite ejecutar manualmente una sola tienda
export async function runSrBrainForStore(storeId) {
  await runForStore(storeId);
}

// ─── Reporte semanal de decisiones de ventas (correo al administrador) ───────

async function computeSalesContext(storeId, config) {
  const salesHistory = await getMonthlySalesHistory(storeId, 6);
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthData = salesHistory.find(r => r.month === currentMonthKey);
  const currentRevenue = parseFloat(currentMonthData?.revenue || 0);
  const projectedRevenue = dayOfMonth > 0 ? (currentRevenue / dayOfMonth) * daysInMonth : 0;
  const pastMonths = salesHistory.filter(r => r.month !== currentMonthKey);
  const avgRevenue = pastMonths.length > 0
    ? pastMonths.reduce((s, r) => s + parseFloat(r.revenue), 0) / pastMonths.length
    : 0;
  const pctDiff = avgRevenue > 0 ? ((projectedRevenue - avgRevenue) / avgRevenue) * 100 : 0;
  return {
    store_id: storeId,
    current_month: currentMonthKey,
    current_revenue: Math.round(currentRevenue),
    projected_monthly_revenue: Math.round(projectedRevenue),
    avg_monthly_revenue_last_months: Math.round(avgRevenue),
    projected_vs_avg_percent: Math.round(pctDiff),
    sales_history: salesHistory,
    promotion_threshold: config.promotion_threshold || 20
  };
}

async function askLeonWeeklyStrategy(storeId, context) {
  const prompt = `Eres el estratega de ventas de SRServi. Analiza estos datos de ventas y DECIDE acciones concretas para mejorar las ventas esta semana. Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin markdown.

DATOS DE VENTAS:
${JSON.stringify(context, null, 2)}

Responde con este JSON exacto:
{
  "summary": "diagnóstico breve del estado de las ventas en 1-2 oraciones",
  "decisions": [
    {
      "title": "título corto de la decisión",
      "reason": "por qué esta decisión mejora las ventas, basado en los datos reales",
      "expected_impact": "impacto esperado en 1 frase",
      "coupon": { "code": "PROMO15", "name": "Promoción de la semana", "discount_type": "percent", "discount_value": 15 }
    }
  ]
}

REGLAS:
- Entre 2 y 4 decisiones, concretas y accionables.
- El campo "coupon" es OPCIONAL: inclúyelo SOLO si la decisión implica crear un cupón de descuento.
- Explica siempre el "reason" con base en los números reales.
- SOLO JSON, nada más.`;

  const raw = await askLeon(storeId, prompt);
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Analiza, TOMA las decisiones (crea cupones propuestos) y devuelve el detalle
// para explicárselo por correo al administrador. Devuelve null si no aplica.
export async function runWeeklySalesReport(storeId) {
  const config = await getAiConfig(storeId);
  if (!config?.enabled) return null;

  const context = await computeSalesContext(storeId, config);
  const strategy = await askLeonWeeklyStrategy(storeId, context);
  const decisions = Array.isArray(strategy?.decisions) ? strategy.decisions : [];

  // Ejecutar (tomar) las decisiones que impliquen crear un cupón — idempotente
  for (const d of decisions) {
    if (d.coupon?.code) {
      try {
        const code = String(d.coupon.code).trim().toUpperCase();
        const [existing] = await pool.execute(
          `SELECT id FROM coupons WHERE store_id = ? AND code = ? LIMIT 1`, [storeId, code]
        );
        if (existing.length === 0) {
          await createCoupon(storeId, {
            code,
            name: d.coupon.name || d.title || 'Promoción de la semana',
            discount_type: d.coupon.discount_type || 'percent',
            discount_value: Number(d.coupon.discount_value) || 15,
            min_order_total: 0,
            usage_limit: 100,
            is_active: true
          });
          d.coupon_created = true;
        } else {
          d.coupon_created = false;
        }
        d.coupon_code = code;
      } catch (e) { console.warn('[SRBrain][semanal] cupón:', e.message); }
    }
  }

  await logAiActivity(storeId, 'weekly_report',
    strategy?.summary || 'Reporte semanal de ventas generado',
    { decisions: decisions.length });

  return { summary: strategy?.summary || '', decisions, context };
}
