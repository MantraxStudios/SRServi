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
          '<p style="color:#666;font-size:14px;margin:0 0 20px;">Terminales POS - Configuración</p>' +

          // API Key
          '<div class="ts"><h3 class="tl">API Key</h3>' +
          '<div style="display:flex;gap:8px;">' +
          '<input id="t-key" type="password" placeholder="API Key de Tuu" class="ti" style="flex:1;" />' +
          '<select id="t-dte" class="ti" style="width:auto;"><option value="0">Sin doc</option><option value="33">Factura</option><option value="48">Boleta NA</option><option value="99">Boleta</option></select>' +
          '<button id="t-save" class="tb p">Guardar</button></div>' +
          '<div id="t-msg" style="margin-top:6px;font-size:13px;"></div></div>' +

          // POS devices
          '<div class="ts"><div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<h3 class="tl">Dispositivos POS</h3>' +
          '<button id="t-add-toggle" class="tb a" style="font-size:13px;">+ Agregar POS</button></div>' +
          '<div id="t-add" style="display:none;margin:10px 0;padding:12px;background:#f8f8f8;border-radius:8px;">' +
          '<div style="display:flex;gap:8px;">' +
          '<input id="t-dn" placeholder="Nombre (Ej: Caja 1)" class="ti" style="flex:1;" />' +
          '<input id="t-ds" placeholder="Serial (Ej: TJ44...)" class="ti" style="flex:1;" />' +
          '<button id="t-da" class="tb p" style="font-size:13px;">Agregar</button></div></div>' +
          '<div id="t-pos-list"></div></div>' +

          // Device-POS Assignment
          '<div class="ts"><h3 class="tl">Asignar POS a Dispositivos</h3>' +
          '<p style="font-size:13px;color:#666;margin:0 0 10px;">Cada tablet/celular que accede a tu tienda se registra automáticamente. Asigna qué POS usa cada uno.</p>' +
          '<div id="t-assign-list"></div></div>' +

          // Haulmer QR
          '<div class="ts" style="border-color:#D4AF37;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<h3 class="tl" style="margin:0;"><span style="color:#D4AF37;">QR</span> Pasarela Haulmer</h3>' +
          '<span id="h-status" style="font-size:12px;padding:3px 10px;border-radius:6px;"></span></div>' +
          '<p style="font-size:13px;color:#666;margin:0 0 12px;">Configura las credenciales de Haulmer para pagos con QR.</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<input id="h-account" type="text" placeholder="Account ID" class="ti" />' +
          '<input id="h-secret" type="password" placeholder="Secret Key" class="ti" />' +
          '<input id="h-name" type="text" placeholder="Nombre del comercio" class="ti" />' +
          '<div style="display:flex;gap:8px;">' +
          '<button id="h-save" class="tb" style="background:#D4AF37;color:#000;flex:1;">Guardar Haulmer</button>' +
          '<button id="h-remove" class="tb" style="background:#dc3545;color:#fff;display:none;">Desvincular</button></div>' +
          '<div id="h-msg" style="font-size:13px;"></div></div></div>' +

          // Transactions
          '<div class="ts"><h3 class="tl">Últimas transacciones</h3>' +
          '<div id="t-txs" style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;max-height:300px;overflow:auto;">Cargando...</div></div>' +

          '<style>' +
          '.ts{background:#fff;border:2px solid #e0e0e0;border-radius:12px;padding:16px;margin-bottom:16px;}' +
          '.tl{margin:0 0 10px;font-size:15px;}' +
          '.ti{padding:9px 12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;}' +
          '.ti:focus{border-color:#000;}' +
          '.tb{padding:9px 16px;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;}' +
          '.tb.p{background:#000;color:#fff;}.tb.a{background:#D4AF37;color:#000;}' +
          '.t-row{display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #f0f0f0;}' +
          '.t-row:last-child{border-bottom:none;}' +
          '.t-del{background:#dc3545;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;}' +
          '.t-assign-row{display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #f0f0f0;flex-wrap:wrap;}' +
          '.t-assign-row:last-child{border-bottom:none;}' +
          '.t-uid{font-family:monospace;font-size:11px;color:#888;background:#f5f5f5;padding:2px 6px;border-radius:4px;}' +
          '</style></div>';

        // --- Load config ---
        fetch(API + '/config?store_id=' + storeId).then(function(r){return r.json()}).then(function(c) {
          if (c.api_key) document.getElementById('t-key').value = c.api_key;
          if (c.dte_type) document.getElementById('t-dte').value = String(c.dte_type);
        });

        document.getElementById('t-save').addEventListener('click', function() {
          fetch(API + '/config', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, api_key: document.getElementById('t-key').value, dte_type: parseInt(document.getElementById('t-dte').value) })
          }).then(function() {
            document.getElementById('t-msg').innerHTML = '<span style="color:#155724;">Guardado</span>';
            setTimeout(function(){ document.getElementById('t-msg').innerHTML = ''; }, 2000);
          });
        });

        // --- Devices + Assignments ---
        var posDevices = [];

        function loadDevices() {
          fetch(API + '/devices?store_id=' + storeId).then(function(r){return r.json()}).then(function(data) {
            posDevices = data.posDevices || [];
            var list = document.getElementById('t-pos-list');
            if (!list) return;

            if (!posDevices.length) {
              list.innerHTML = '<p style="color:#999;font-size:13px;padding:8px;">Sin POS. Agrega uno.</p>';
            } else {
              list.innerHTML = posDevices.map(function(d) {
                return '<div class="t-row"><div><strong>' + d.name + '</strong><br/><span style="font-size:12px;color:#666;">' + d.serial + '</span></div>' +
                  '<button class="t-del" data-id="' + d.id + '">Eliminar</button></div>';
              }).join('');
              list.querySelectorAll('.t-del').forEach(function(btn) {
                btn.addEventListener('click', function() {
                  if (!confirm('¿Eliminar este POS?')) return;
                  fetch(API + '/devices/' + btn.dataset.id, { method: 'DELETE' }).then(loadDevices);
                });
              });
            }

            // Render assignments
            var assignList = document.getElementById('t-assign-list');
            var storeDevs = data.storeDevices || [];
            var assignments = data.assignments || [];

            if (!storeDevs.length) {
              assignList.innerHTML = '<p style="color:#999;font-size:13px;">No hay dispositivos registrados. Abre la tienda desde un dispositivo para que se registre.</p>';
              return;
            }

            assignList.innerHTML = storeDevs.map(function(sd) {
              var assigned = assignments.find(function(a) { return a.device_uid === sd.device_uid; });
              var lastSeen = sd.last_seen ? new Date(sd.last_seen).toLocaleString('es-ES') : 'Nunca';
              return '<div class="t-assign-row">' +
                '<div style="flex:1;min-width:0;">' +
                '<strong>' + (sd.label || 'Sin nombre') + '</strong> ' +
                '<span class="t-uid">' + sd.device_uid.substring(0, 16) + '...</span>' +
                '<div style="font-size:11px;color:#999;">Último acceso: ' + lastSeen + '</div>' +
                '</div>' +
                '<input data-uid="' + sd.device_uid + '" data-sdid="' + sd.id + '" class="t-label-input ti" value="' + (sd.label || '') + '" placeholder="Nombre" style="width:100px;font-size:12px;padding:6px;" />' +
                '<select data-uid="' + sd.device_uid + '" class="t-pos-select ti" style="font-size:12px;padding:6px;">' +
                '<option value="">Sin POS</option>' +
                posDevices.map(function(p) {
                  return '<option value="' + p.id + '"' + (assigned && assigned.tuu_device_id === p.id ? ' selected' : '') + '>' + p.name + '</option>';
                }).join('') +
                '</select>' +
                '<button data-uid="' + sd.device_uid + '" class="t-assign-btn tb p" style="font-size:11px;padding:6px 10px;">OK</button>' +
                '</div>';
            }).join('');

            // Assign handlers
            assignList.querySelectorAll('.t-assign-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                var uid = btn.dataset.uid;
                var row = btn.closest('.t-assign-row');
                var posId = row.querySelector('.t-pos-select').value;
                var label = row.querySelector('.t-label-input').value;
                var sdId = row.querySelector('.t-label-input').dataset.sdid;

                // Save label
                if (label !== undefined) {
                  fetch('/api/store-devices/' + sdId + '/label', {
                    method: 'PUT', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer ' + ctx.token},
                    body: JSON.stringify({ label: label })
                  });
                }

                // Assign POS
                if (posId) {
                  fetch(API + '/devices/assign', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ store_id: storeId, device_uid: uid, tuu_device_id: parseInt(posId) })
                  }).then(function() {
                    btn.textContent = 'OK!';
                    btn.style.background = '#28a745';
                    setTimeout(function() { btn.textContent = 'OK'; btn.style.background = '#000'; }, 1500);
                  });
                }
              });
            });
          });
        }
        loadDevices();

        document.getElementById('t-add-toggle').addEventListener('click', function() {
          var f = document.getElementById('t-add');
          f.style.display = f.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('t-da').addEventListener('click', function() {
          var n = document.getElementById('t-dn').value;
          var s = document.getElementById('t-ds').value;
          if (!n || !s) return;
          fetch(API + '/devices', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, name: n, serial: s })
          }).then(function() {
            document.getElementById('t-dn').value = '';
            document.getElementById('t-ds').value = '';
            document.getElementById('t-add').style.display = 'none';
            loadDevices();
          });
        });

        // --- Haulmer Config ---
        function loadHaulmer() {
          fetch(API + '/haulmer-config?store_id=' + storeId).then(function(r){return r.json()}).then(function(c) {
            var st = document.getElementById('h-status');
            var rm = document.getElementById('h-remove');
            if (c.configured) {
              st.textContent = 'Configurado';
              st.style.background = '#dcfce7';
              st.style.color = '#166534';
              document.getElementById('h-account').value = c.account_id || '';
              document.getElementById('h-secret').placeholder = 'Secret Key (' + (c.secret_key || '') + ')';
              document.getElementById('h-name').value = c.commerce_name || '';
              rm.style.display = 'block';
            } else {
              st.textContent = 'No configurado';
              st.style.background = '#fef3c7';
              st.style.color = '#92400e';
              rm.style.display = 'none';
            }
          });
        }
        loadHaulmer();

        document.getElementById('h-save').addEventListener('click', function() {
          var acc = document.getElementById('h-account').value;
          var sec = document.getElementById('h-secret').value;
          var nam = document.getElementById('h-name').value;
          if (!acc || !sec) { document.getElementById('h-msg').innerHTML = '<span style="color:#dc3545;">Account ID y Secret Key requeridos</span>'; return; }
          fetch(API + '/haulmer-config', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ store_id: storeId, account_id: acc, secret_key: sec, commerce_name: nam })
          }).then(function(r){return r.json()}).then(function(d) {
            if (d.success) {
              document.getElementById('h-msg').innerHTML = '<span style="color:#166534;">Haulmer configurado</span>';
              loadHaulmer();
            } else {
              document.getElementById('h-msg').innerHTML = '<span style="color:#dc3545;">' + (d.error||'Error') + '</span>';
            }
            setTimeout(function(){ document.getElementById('h-msg').innerHTML=''; }, 3000);
          });
        });

        document.getElementById('h-remove').addEventListener('click', function() {
          if (!confirm('Desvincular Haulmer?')) return;
          fetch(API + '/haulmer-config?store_id=' + storeId, { method: 'DELETE' }).then(function() {
            document.getElementById('h-account').value = '';
            document.getElementById('h-secret').value = '';
            document.getElementById('h-name').value = '';
            loadHaulmer();
          });
        });

        // --- Transactions ---
        function loadTxs() {
          fetch(API + '/transactions?store_id=' + storeId).then(function(r){return r.json()}).then(function(txs) {
            var el = document.getElementById('t-txs');
            if (!el) return;
            if (!txs.length) { el.innerHTML = '<span style="color:#888;">Sin transacciones</span>'; return; }
            el.innerHTML = txs.map(function(t) {
              var c = t.status === 'Completed' ? '#4ec9b0' : t.status === 'Pending' ? '#dcdcaa' : '#f44747';
              return '<div style="margin-bottom:4px;"><span style="color:#888;">' + (t.created_at||'').replace('T',' ').split('.')[0] + '</span> ' +
                '<span style="color:#4ec9b0;">$' + t.amount + '</span> <span style="color:' + c + ';">' + t.status + '</span> ' +
                '<span style="color:#888;">' + t.device_serial + '</span> ' +
                (t.order_id ? '<span style="color:#569cd6;">Orden #' + t.order_id + '</span>' : '') + '</div>';
            }).join('');
          });
        }
        loadTxs();
        var ri = setInterval(loadTxs, 15000);
        container._cleanup = function() { clearInterval(ri); };
      }
    }
  };
})();
