(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};
  var API = '/api/plugins/run/tuu-payments';

  window.__SRSERVI_PLUGINS__['tuu-payments'] = {
    slots: {},

    // Public API for store integration
    isAvailable: function(storeId) {
      return fetch(API + '/available?store_id=' + storeId)
        .then(function(r) { return r.json(); })
        .then(function(d) { return d.available; })
        .catch(function() { return false; });
    },

    pay: function(storeId, amount, orderId, description) {
      return fetch(API + '/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, order_id: orderId, amount: Math.round(amount), description: description })
      }).then(function(r) { return r.json(); });
    },

    checkStatus: function(idempotencyKey) {
      return fetch(API + '/status/' + idempotencyKey).then(function(r) { return r.json(); });
    },

    cancel: function(idempotencyKey) {
      return fetch(API + '/cancel/' + idempotencyKey, { method: 'POST' }).then(function(r) { return r.json(); });
    }
  };
})();
