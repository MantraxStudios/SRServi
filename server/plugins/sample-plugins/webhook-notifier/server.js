let ctx = null;
let logEntries = [];

async function sendWebhook(url, eventType, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data
      })
    });

    const entry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      url,
      status: response.status,
      success: response.ok
    };
    logEntries.unshift(entry);
    if (logEntries.length > 50) logEntries = logEntries.slice(0, 50);

    ctx.logger.log(`Webhook sent: ${eventType} -> ${url} (${response.status})`);
  } catch (error) {
    const entry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      url,
      status: 0,
      success: false,
      error: error.message
    };
    logEntries.unshift(entry);
    if (logEntries.length > 50) logEntries = logEntries.slice(0, 50);

    ctx.logger.error(`Webhook failed: ${eventType} -> ${url}: ${error.message}`);
  }
}

export function init(context) {
  ctx = context;
  logEntries = [];

  ctx.hooks.on('order_created', async (data) => {
    const settings = await ctx.getSettings(data.store_id);
    if (settings.webhook_url && settings.notify_orders) {
      await sendWebhook(settings.webhook_url, 'order_created', {
        store_id: data.store_id,
        order_id: data.order?.id,
        total: data.order?.total,
        order_type: data.order?.order_type,
        payment_method: data.order?.payment_method
      });
    }
  });

  ctx.hooks.on('payment_completed', async (data) => {
    const settings = await ctx.getSettings(data.store_id);
    if (settings.webhook_url && settings.notify_payments) {
      await sendWebhook(settings.webhook_url, 'payment_completed', {
        store_id: data.store_id,
        order_id: data.order?.id,
        total: data.order?.total,
        payment_method: data.payment_method
      });
    }
  });

  ctx.hooks.on('payment_failed', async (data) => {
    const settings = await ctx.getSettings(data.store_id);
    if (settings.webhook_url && settings.notify_failures) {
      await sendWebhook(settings.webhook_url, 'payment_failed', {
        store_id: data.store_id,
        order_id: data.order_id,
        reason: data.reason
      });
    }
  });

  // Custom API routes
  ctx.router.get('/logs', async (req, res) => {
    res.json(logEntries);
  });

  ctx.router.get('/test', async (req, res) => {
    const storeId = req.query.store_id;
    if (!storeId) return res.status(400).json({ error: 'store_id required' });
    const settings = await ctx.getSettings(parseInt(storeId));
    if (!settings.webhook_url) {
      return res.json({ success: false, error: 'No webhook URL configured' });
    }
    await sendWebhook(settings.webhook_url, 'test', {
      message: 'Test webhook from SRServi',
      store_id: parseInt(storeId)
    });
    res.json({ success: true, url: settings.webhook_url });
  });

  ctx.logger.log('Webhook Notifier initialized');
}

export function destroy() {
  logEntries = [];
  ctx = null;
}
