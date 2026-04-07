/**
 * Webhook Notifier - Admin Panel Client Script
 *
 * This registers the plugin in the admin panel.
 * Plugins use window.__SRSERVI_PLUGINS__ to register their UI.
 */
(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};

  window.__SRSERVI_PLUGINS__['webhook-notifier'] = {
    slots: {
      'sidebar': {
        label: 'Webhooks',
        path: '/admin/plugins/webhook-notifier'
      }
    },
    adminPage: {
      render: function(container, ctx) {
        container.innerHTML = `
          <div style="padding: 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <h1 style="margin:0;">Webhook Notifier</h1>
              <button id="wh-test-btn" style="padding:8px 16px;background:#D4AF37;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
                Enviar Test
              </button>
            </div>
            <div id="wh-logs" style="background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;max-height:400px;overflow:auto;">
              Cargando logs...
            </div>
          </div>
        `;

        // Load logs
        function loadLogs() {
          fetch('/api/plugins/run/webhook-notifier/logs')
            .then(r => r.json())
            .then(logs => {
              var el = document.getElementById('wh-logs');
              if (!el) return;
              if (logs.length === 0) {
                el.innerHTML = '<span style="color:#888;">No hay logs todavía. Los webhooks aparecerán aquí.</span>';
                return;
              }
              el.innerHTML = logs.map(function(log) {
                var color = log.success ? '#4ec9b0' : '#f44747';
                return '<div style="margin-bottom:6px;">' +
                  '<span style="color:#888;">' + log.timestamp.split('T')[1].split('.')[0] + '</span> ' +
                  '<span style="color:#569cd6;">[' + log.event + ']</span> ' +
                  '<span style="color:' + color + ';">' + (log.success ? 'OK' : 'FAIL') + ' ' + log.status + '</span>' +
                  (log.error ? ' <span style="color:#f44747;">' + log.error + '</span>' : '') +
                  '</div>';
              }).join('');
            })
            .catch(function() {
              var el = document.getElementById('wh-logs');
              if (el) el.innerHTML = '<span style="color:#f44747;">Error cargando logs</span>';
            });
        }

        loadLogs();

        // Test button
        var testBtn = document.getElementById('wh-test-btn');
        if (testBtn && ctx.storeId) {
          testBtn.addEventListener('click', function() {
            testBtn.textContent = 'Enviando...';
            testBtn.disabled = true;
            fetch('/api/plugins/run/webhook-notifier/test?store_id=' + ctx.storeId)
              .then(function(r) { return r.json(); })
              .then(function(data) {
                testBtn.textContent = data.success ? 'Enviado!' : 'Error: ' + (data.error || 'unknown');
                setTimeout(function() {
                  testBtn.textContent = 'Enviar Test';
                  testBtn.disabled = false;
                  loadLogs();
                }, 2000);
              })
              .catch(function() {
                testBtn.textContent = 'Error';
                setTimeout(function() {
                  testBtn.textContent = 'Enviar Test';
                  testBtn.disabled = false;
                }, 2000);
              });
          });
        }

        // Auto refresh logs
        var interval = setInterval(loadLogs, 10000);
        // Store cleanup ref
        container._cleanup = function() { clearInterval(interval); };
      }
    }
  };
})();
