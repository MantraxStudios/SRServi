(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};

  window.__SRSERVI_PLUGINS__['sidebar-categories'] = {
    slots: {
      'store-header': {
        render: function(container, ctx) {
          var storeId = ctx.storeId || '';

          fetch('/api/plugins/run/sidebar-categories/settings?store_id=' + storeId)
            .then(function(r) { return r.json(); })
            .then(function(settings) { applyLayout(settings); })
            .catch(function() { applyLayout({}); });

          function applyLayout(s) {
            var sw = (s.sidebar_width || 180) + 'px';
            var min = s.min_screen || 768;

            var css = [
              '@media (min-width: ' + min + 'px) {',

              // Sidebar fixed
              '  .category-tabs {',
              '    position: fixed; left: 0; top: 0; bottom: 0;',
              '    width: ' + sw + '; padding: 12px 8px;',
              '    background: var(--store-secondary);',
              '    border-right: 2px solid var(--store-primary);',
              '    z-index: 100; overflow-y: auto;',
              '    box-shadow: 2px 0 16px rgba(0,0,0,0.06);',
              '  }',

              '  .category-tabs-list {',
              '    flex-direction: column; flex-wrap: nowrap;',
              '    gap: 4px; justify-content: flex-start;',
              '  }',

              '  .category-tab {',
              '    width: 100%; text-align: left;',
              '    padding: 10px 12px; border-radius: 8px;',
              '    font-size: 13px; white-space: nowrap;',
              '    overflow: hidden; text-overflow: ellipsis;',
              '  }',

              '  .category-tab.active {',
              '    background: var(--store-primary);',
              '    color: var(--store-secondary);',
              '    border-color: var(--store-primary);',
              '    font-weight: 700;',
              '  }',

              // Header se desplaza
              '  .store-header { margin-left: ' + sw + '; }',

              // Plugin slots
              '  .plugin-slot { margin-left: ' + sw + '; }',

              // Contenido principal
              '  .category-sections { margin-left: ' + sw + '; }',
              '  .products-grid:not(.category-sections .products-grid) { margin-left: ' + sw + '; }',
              '  .store-empty { margin-left: ' + sw + '; }',
              '  .store-editor-bar { margin-left: ' + sw + '; }',
              '  .store-editor-complements { margin-left: ' + sw + '; }',

              // Cart bar
              '  .cart-bar {',
              '    left: ' + sw + ';',
              '    width: calc(100% - ' + sw + ');',
              '  }',

              // Toast
              '  .toast { margin-left: ' + sw + '; }',

              // Edit mode
              '  .cat-tab-add { width: 100%; }',
              '  .cat-tab-edit-icons { margin-left: auto; }',

              '}',

              '@media (max-width: ' + (min - 1) + 'px) {',
              '  .category-tabs { position: relative; }',
              '}'
            ].join('\n');

            var old = document.getElementById('sc-plugin-styles');
            if (old) old.remove();
            var el = document.createElement('style');
            el.id = 'sc-plugin-styles';
            el.textContent = css;
            document.head.appendChild(el);
          }
        }
      }
    }
  };
})();
