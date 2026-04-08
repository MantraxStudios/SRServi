(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};
  var API = '/api/plugins/run/tuu-payments';

  window.__SRSERVI_PLUGINS__['tuu-payments'] = {
    slots: {
      'sidebar': { label: 'Tuu POS', path: '/admin/plugins/tuu-payments' }
    },
    adminPage: {
      render: function(container, ctx) {
        var storeId = ctx.storeId;

        container.innerHTML = '<div style="padding:20px;">' +
          '<h1 style="margin:0 0 4px;">Tuu Payments</h1>' +
          '<p style="color:#666;font-size:14px;margin:0 0 20px;">Configuración de terminales POS</p>' +

          // API Key section
          '<div class="tuu-section">' +
          '<h3 class="tuu-section-title">API Key</h3>' +
          '<div style="display:flex;gap:8px;">' +
          '<input id="tuu-apikey" type="password" placeholder="Tu API Key de Tuu" class="tuu-input" style="flex:1;" />' +
          '<select id="tuu-dte" class="tuu-input" style="width:auto;">' +
          '<option value="0">Sin documento</option><option value="33">Factura</option><option value="48">Boleta no afecta</option><option value="99">Boleta electrónica</option>' +
          '</select>' +
          '<button id="tuu-save-key" class="tuu-btn primary">Guardar</button>' +
          '</div>' +
          '<div id="tuu-key-msg" style="margin-top:6px;font-size:13px;"></div>' +
          '</div>' +

          // Devices section
          '<div class="tuu-section">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<h3 class="tuu-section-title">Dispositivos POS</h3>' +
          '<button id="tuu-add-device-btn" class="tuu-btn accent" style="font-size:13px;">+ Agregar POS</button>' +
          '</div>' +
          '<div id="tuu-add-form" style="display:none;margin:10px 0;padding:12px;background:#f8f8f8;border-radius:8px;">' +
          '<div style="display:flex;gap:8px;">' +
          '<input id="tuu-dev-name" placeholder="Nombre (Ej: Caja 1)" class="tuu-input" style="flex:1;" />' +
          '<input id="tuu-dev-serial" placeholder="Serial (Ej: TJ44245N20440)" class="tuu-input" style="flex:1;" />' +
          '<button id="tuu-dev-save" class="tuu-btn primary" style="font-size:13px;">Agregar</button>' +
          '</div>' +
          '</div>' +
          '<div id="tuu-devices-list"></div>' +
          '</div>' +

          // Store assignment
          '<div class="tuu-section">' +
          '<h3 class="tuu-section-title">POS asignado a esta tienda</h3>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
          '<select id="tuu-store-device" class="tuu-input" style="flex:1;"></select>' +
          '<button id="tuu-assign-btn" class="tuu-btn primary" style="font-size:13px;">Asignar</button>' +
          '<button id="tuu-test-btn" class="tuu-btn" style="font-size:13px;background:#28a745;color:#fff;">Test</button>' +
          '</div>' +
          '<div id="tuu-assign-msg" style="margin-top:6px;font-size:13px;"></div>' +
          '</div>' +

          // Transactions
          '<div class="tuu-section">' +
          '<h3 class="tuu-section-title">Últimas transacciones</h3>' +
          '<div id="tuu-transactions" style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;max-height:300px;overflow:auto;">Cargando...</div>' +
          '</div>' +

          '<style>' +
          '.tuu-section{background:#fff;border:2px solid #e0e0e0;border-radius:12px;padding:16px;margin-bottom:16px;}' +
          '.tuu-section-title{margin:0 0 10px;font-size:15px;}' +
          '.tuu-input{padding:9px 12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;}' +
          '.tuu-input:focus{border-color:#000;}' +
          '.tuu-btn{padding:9px 16px;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;}' +
          '.tuu-btn.primary{background:#000;color:#fff;}' +
          '.tuu-btn.accent{background:#D4AF37;color:#000;}' +
          '.tuu-device-item{display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #f0f0f0;}' +
          '.tuu-device-item:last-child{border-bottom:none;}' +
          '.tuu-del-btn{background:#dc3545;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;}' +
          '</style>' +
          '</div>';

        // --- Load config ---
        fetch(API + '/config?store_id=' + storeId).then(function(r){return r.json()}).then(function(c) {
          var el = document.getElementById('tuu-apikey');
          var dte = document.getElementById('tuu-dte');
          if (el && c.api_key) el.value = c.api_key;
          if (dte && c.dte_type) dte.value = String(c.dte_type);
        });

        // Save API Key
        document.getElementById('tuu-save-key').addEventListener('click', function() {
          var key = document.getElementById('tuu-apikey').value;
          var dte = document.getElementById('tuu-dte').value;
          fetch(API + '/config', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, api_key: key, dte_type: parseInt(dte) })
          }).then(function(r){return r.json()}).then(function() {
            document.getElementById('tuu-key-msg').innerHTML = '<span style="color:#155724;">Guardado</span>';
            setTimeout(function(){ document.getElementById('tuu-key-msg').innerHTML = ''; }, 2000);
          });
        });

        // --- Devices ---
        function loadDevices() {
          fetch(API + '/devices?store_id=' + storeId).then(function(r){return r.json()}).then(function(data) {
            var list = document.getElementById('tuu-devices-list');
            var sel = document.getElementById('tuu-store-device');
            if (!list || !sel) return;

            if (!data.devices || !data.devices.length) {
              list.innerHTML = '<p style="color:#999;font-size:13px;padding:8px;">Sin dispositivos. Agrega un POS.</p>';
              sel.innerHTML = '<option value="">Sin dispositivos</option>';
              return;
            }

            list.innerHTML = data.devices.map(function(d) {
              return '<div class="tuu-device-item">' +
                '<div><strong>' + d.name + '</strong><br/><span style="font-size:12px;color:#666;">' + d.serial + '</span></div>' +
                '<button class="tuu-del-btn" data-id="' + d.id + '">Eliminar</button>' +
                '</div>';
            }).join('');

            sel.innerHTML = '<option value="">Selecciona un POS</option>' +
              data.devices.map(function(d) {
                return '<option value="' + d.id + '"' + (d.id === data.selectedDeviceId ? ' selected' : '') + '>' + d.name + ' (' + d.serial + ')</option>';
              }).join('');

            // Delete buttons
            list.querySelectorAll('.tuu-del-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                if (!confirm('¿Eliminar este POS?')) return;
                fetch(API + '/devices/' + btn.dataset.id, { method: 'DELETE' }).then(function() { loadDevices(); });
              });
            });
          });
        }
        loadDevices();

        // Toggle add form
        document.getElementById('tuu-add-device-btn').addEventListener('click', function() {
          var form = document.getElementById('tuu-add-form');
          form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });

        // Add device
        document.getElementById('tuu-dev-save').addEventListener('click', function() {
          var name = document.getElementById('tuu-dev-name').value;
          var serial = document.getElementById('tuu-dev-serial').value;
          if (!name || !serial) return;
          fetch(API + '/devices', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, name: name, serial: serial })
          }).then(function() {
            document.getElementById('tuu-dev-name').value = '';
            document.getElementById('tuu-dev-serial').value = '';
            document.getElementById('tuu-add-form').style.display = 'none';
            loadDevices();
          });
        });

        // Assign to store
        document.getElementById('tuu-assign-btn').addEventListener('click', function() {
          var deviceId = document.getElementById('tuu-store-device').value;
          if (!deviceId) return;
          fetch(API + '/devices/assign', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, device_id: parseInt(deviceId) })
          }).then(function() {
            document.getElementById('tuu-assign-msg').innerHTML = '<span style="color:#155724;">POS asignado a esta tienda</span>';
            setTimeout(function(){ document.getElementById('tuu-assign-msg').innerHTML = ''; }, 2000);
          });
        });

        // Test
        document.getElementById('tuu-test-btn').addEventListener('click', function() {
          var btn = document.getElementById('tuu-test-btn');
          btn.textContent = '...';
          fetch(API + '/test?store_id=' + storeId).then(function(r){return r.json()}).then(function(d) {
            document.getElementById('tuu-assign-msg').innerHTML = d.success
              ? '<span style="color:#155724;">Conexión OK - ' + d.device + '</span>'
              : '<span style="color:#721c24;">' + (d.error||'Error') + '</span>';
            btn.textContent = 'Test';
          }).catch(function() { btn.textContent = 'Test'; });
        });

        // --- Transactions ---
        function loadTransactions() {
          fetch(API + '/transactions?store_id=' + storeId).then(function(r){return r.json()}).then(function(txs) {
            var el = document.getElementById('tuu-transactions');
            if (!el) return;
            if (!txs.length) { el.innerHTML = '<span style="color:#888;">Sin transacciones</span>'; return; }
            el.innerHTML = txs.map(function(t) {
              var color = t.status === 'Completed' ? '#4ec9b0' : t.status === 'Pending' ? '#dcdcaa' : '#f44747';
              return '<div style="margin-bottom:4px;">' +
                '<span style="color:#888;">' + (t.created_at||'').replace('T',' ').split('.')[0] + '</span> ' +
                '<span style="color:#4ec9b0;">$' + t.amount + '</span> ' +
                '<span style="color:' + color + ';">' + t.status + '</span> ' +
                '<span style="color:#888;">' + t.device_serial + '</span> ' +
                (t.order_id ? '<span style="color:#569cd6;">Orden #' + t.order_id + '</span>' : '') +
                '</div>';
            }).join('');
          });
        }
        loadTransactions();
        var refreshInterval = setInterval(loadTransactions, 10000);
        container._cleanup = function() { clearInterval(refreshInterval); };
      }
    }
  };
})();
