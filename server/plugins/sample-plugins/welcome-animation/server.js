export function init(ctx) {
  ctx.router.get('/settings', async (req, res) => {
    const storeId = req.query.store_id;
    if (!storeId) return res.json({});
    const settings = await ctx.getSettings(parseInt(storeId));
    res.json(settings);
  });

  ctx.logger.log('Welcome Animation initialized');
}

export function destroy() {}
