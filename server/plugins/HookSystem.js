/**
 * HookSystem - Event bus for plugin hooks
 * Plugins register handlers for specific events.
 * Core app emits events at key moments (order created, payment, etc.)
 */
class HookSystem {
  constructor() {
    this.hooks = new Map();
  }

  /**
   * Register a handler for a hook
   * @param {string} hookName - e.g. 'order_created', 'payment_completed'
   * @param {string} pluginId - The plugin registering the handler
   * @param {Function} handler - async (data) => result
   */
  register(hookName, pluginId, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push({ pluginId, handler });
    console.log(`🔌 [HookSystem] ${pluginId} registered for "${hookName}"`);
  }

  /**
   * Unregister all handlers for a specific plugin
   * @param {string} pluginId
   */
  unregister(pluginId) {
    for (const [hookName, handlers] of this.hooks.entries()) {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.hooks.delete(hookName);
      } else {
        this.hooks.set(hookName, filtered);
      }
    }
    console.log(`🔌 [HookSystem] Unregistered all hooks for "${pluginId}"`);
  }

  /**
   * Emit a hook - calls all registered handlers
   * @param {string} hookName
   * @param {object} data - Event data passed to handlers
   * @returns {Array} Results from all handlers
   */
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
   * Get list of all registered hooks
   */
  getRegisteredHooks() {
    const result = {};
    for (const [hookName, handlers] of this.hooks.entries()) {
      result[hookName] = handlers.map(h => h.pluginId);
    }
    return result;
  }
}

export default HookSystem;
