/**
 * HookSystem - Event bus + service providers for plugins
 */
class HookSystem {
  constructor() {
    this.hooks = new Map();
    this.paymentProviders = new Map(); // pluginId -> { name, charge, status, cancel, isAvailable }
    this.qrProviders = new Map(); // pluginId -> { name, isAvailable, createPayment }
  }

  register(hookName, pluginId, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push({ pluginId, handler });
    console.log(`🔌 [HookSystem] ${pluginId} registered for "${hookName}"`);
  }

  unregister(pluginId) {
    for (const [hookName, handlers] of this.hooks.entries()) {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.hooks.delete(hookName);
      } else {
        this.hooks.set(hookName, filtered);
      }
    }
    this.paymentProviders.delete(pluginId);
    this.qrProviders.delete(pluginId);
    console.log(`🔌 [HookSystem] Unregistered all hooks for "${pluginId}"`);
  }

  async emit(hookName, data) {
    const handlers = this.hooks.get(hookName) || [];
    if (handlers.length === 0) return [];

    const results = [];
    for (const { pluginId, handler } of handlers) {
      try {
        const result = await handler(data);
        results.push({ pluginId, success: true, result });
      } catch (error) {
        console.error(`🔌 [HookSystem] Error in "${pluginId}" handler for "${hookName}":`, error.message);
        results.push({ pluginId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Register a payment provider
   * @param {string} pluginId
   * @param {object} provider
   *   - name: Display name (e.g. "Tuu POS")
   *   - isAvailable(storeId): async -> bool
   *   - charge(storeId, amount, orderId, description): async -> { success, paymentKey, ... }
   *   - status(paymentKey): async -> { status: 'Pending'|'Completed'|'Canceled'|'Failed'|'Timeout', ... }
   *   - cancel(paymentKey): async -> { success }
   */
  registerPaymentProvider(pluginId, provider) {
    this.paymentProviders.set(pluginId, provider);
    console.log(`🔌 [HookSystem] ${pluginId} registered as payment provider "${provider.name}"`);
  }

  getPaymentProviders() {
    return this.paymentProviders;
  }

  registerQrProvider(pluginId, provider) {
    this.qrProviders.set(pluginId, provider);
    console.log(`🔌 [HookSystem] ${pluginId} registered as QR provider "${provider.name}"`);
  }

  getQrProviders() {
    return this.qrProviders;
  }

  getRegisteredHooks() {
    const result = {};
    for (const [hookName, handlers] of this.hooks.entries()) {
      result[hookName] = handlers.map(h => h.pluginId);
    }
    return result;
  }
}

export default HookSystem;
