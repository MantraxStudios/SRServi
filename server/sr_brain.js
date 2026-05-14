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
  getWorkers,
  createCoupon,
  pool
} from './database.js';

const LEON_URL = 'http://localhost:7777';

// ─── SMS via Twilio (opcional, solo si está configurado) ─────────────────────

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
    return res.ok;
  } catch { return false; }
}

// ─── León IA — análisis y decisiones ────────────────────────────────────────

async function askLeon(storeId, prompt) {
  try {
    const res = await fetch(`${LEON_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: prompt, store_id: storeId, history: [] }),
      signal: AbortSignal.timeout(90000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.answer || null;
  } catch { return null; }
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
    const worker = workers.find(w => w.id === data.worker_id);
    const phone = data.worker_phone || worker?.phone;
    const name = data.worker_name || worker?.name || 'equipo';
    const message = data.message
      .replace('[nombre]', name)
      .replace('[tarea]', data.missed_task || 'la tarea asignada');
    const senderLine = `\n— ${config.sender_name}`;
    const smsText = message + senderLine;

    if (phone) {
      const sent = await sendSMS(phone, smsText);
      await logAiActivity(storeId, 'worker_reminder_sent', `Recordatorio enviado a ${name} (${phone}): ${data.missed_task}`, { sent, phone, message });
    } else {
      await logAiActivity(storeId, 'worker_reminder_skipped', `${name} no tiene teléfono registrado`, { worker_id: data.worker_id });
    }
  }

  if (type === 'send_morale' && config.morale_messages) {
    const message = (data.message || getRandomMorale()) + `\n— ${config.sender_name}`;
    let sentCount = 0;
    for (const w of workers) {
      if (w.phone) {
        await sendSMS(w.phone, message);
        sentCount++;
      }
    }
    await logAiActivity(storeId, 'morale_sent', `Mensaje de ánimo enviado a ${sentCount}/${workers.length} trabajadores`, { message: data.message });
  }
}

// ─── Run para una tienda ─────────────────────────────────────────────────────

async function runForStore(storeId) {
  const config = await getAiConfig(storeId);
  if (!config?.enabled) return;

  console.log(`[SRBrain] Ejecutando para tienda ${storeId}...`);

  try {
    const [salesHistory, yesterdayTasks, workers] = await Promise.all([
      getMonthlySalesHistory(storeId, 6),
      getYesterdayTaskStatus(storeId),
      getWorkers(storeId)
    ]);

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

    // Pedir decisiones a León IA
    const decisions = await getDecisionsFromLeon(storeId, context);

    if (!decisions) {
      // Fallback: ejecutar acciones básicas sin IA
      await logAiActivity(storeId, 'brain_run', 'León IA no disponible — ejecutando acciones básicas');
      if (config.morale_messages) {
        const message = getRandomMorale() + `\n— ${config.sender_name}`;
        let sentCount = 0;
        for (const w of workers) {
          if (w.phone) { await sendSMS(w.phone, message); sentCount++; }
        }
        await logAiActivity(storeId, 'morale_sent', `Mensaje de ánimo (fallback) enviado a ${sentCount} trabajadores`, { message });
      }
      await updateAiConfigLastRun(storeId);
      return;
    }

    await logAiActivity(storeId, 'brain_run', decisions.analysis || 'Análisis diario ejecutado', { context_summary: { projected_vs_avg_percent: context.projected_vs_avg_percent, missed_tasks: missedTasks.length } });

    for (const action of (decisions.actions || [])) {
      await executeAction(storeId, action, config, workers);
    }

    await updateAiConfigLastRun(storeId);
    console.log(`[SRBrain] ✅ Tienda ${storeId} — ${decisions.actions?.length || 0} acciones ejecutadas`);
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
