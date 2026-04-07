(function() {
  window.__SRSERVI_PLUGINS__ = window.__SRSERVI_PLUGINS__ || {};

  window.__SRSERVI_PLUGINS__['welcome-animation'] = {
    slots: {
      'store-header': {
        render: function(container, ctx) {
          // Check if already shown this session
          var sessionKey = 'wa_shown_' + (ctx.storeId || '');
          if (sessionStorage.getItem(sessionKey)) return;
          sessionStorage.setItem(sessionKey, '1');

          // Fetch settings
          var storeId = ctx.storeId || '';
          fetch('/api/plugins/run/welcome-animation/settings?store_id=' + storeId)
            .then(function(r) { return r.json(); })
            .then(function(settings) {
              showWelcome(container, settings);
            })
            .catch(function() {
              showWelcome(container, {});
            });

          function showWelcome(el, s) {
            var title = s.title || 'Bienvenido';
            var subtitle = s.subtitle || 'Descubre nuestro menú';
            var duration = (s.duration || 3) * 1000;
            var emoji = s.emoji || '👋';
            var bg = s.bg_color || null;

            var primary = getComputedStyle(document.documentElement).getPropertyValue('--store-primary').trim() || '#000';
            var secondary = getComputedStyle(document.documentElement).getPropertyValue('--store-secondary').trim() || '#fff';
            var accent = getComputedStyle(document.documentElement).getPropertyValue('--store-accent').trim() || '#D4AF37';

            var overlay = document.createElement('div');
            overlay.id = 'wa-overlay';
            overlay.style.cssText = [
              'position:fixed',
              'top:0',
              'left:0',
              'width:100vw',
              'height:100vh',
              'z-index:99999',
              'display:flex',
              'flex-direction:column',
              'align-items:center',
              'justify-content:center',
              'background:' + (bg || primary),
              'color:' + secondary,
              'opacity:1',
              'transition:opacity 0.6s ease-out',
              'pointer-events:all',
              'overflow:hidden'
            ].join(';');

            overlay.innerHTML = [
              '<style>',
              '@keyframes wa-bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}',
              '@keyframes wa-fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}',
              '@keyframes wa-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}',
              '@keyframes wa-particles{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(0);opacity:0}}',
              '</style>',

              // Particles
              '<div id="wa-particles" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;"></div>',

              // Emoji
              '<div style="font-size:72px;animation:wa-bounce 1s ease infinite;margin-bottom:20px;">' + emoji + '</div>',

              // Title
              '<h1 style="',
                'font-size:32px;',
                'font-weight:800;',
                'margin:0 0 8px;',
                'animation:wa-fadeUp 0.8s ease both;',
                'background:linear-gradient(90deg,' + secondary + ',' + accent + ',' + secondary + ');',
                'background-size:200% auto;',
                'animation:wa-fadeUp 0.8s ease both,wa-shimmer 3s linear infinite;',
                '-webkit-background-clip:text;',
                '-webkit-text-fill-color:transparent;',
                'background-clip:text;',
              '">' + title + '</h1>',

              // Subtitle
              '<p style="',
                'font-size:16px;',
                'opacity:0.8;',
                'margin:0;',
                'animation:wa-fadeUp 0.8s ease 0.3s both;',
                'color:' + accent + ';',
              '">' + subtitle + '</p>',

              // Progress bar
              '<div style="',
                'position:absolute;',
                'bottom:0;left:0;',
                'height:4px;',
                'background:' + accent + ';',
                'transition:width linear;',
                'width:0%;',
              '" id="wa-progress"></div>'
            ].join('');

            document.body.appendChild(overlay);

            // Spawn particles
            var particlesEl = document.getElementById('wa-particles');
            for (var i = 0; i < 20; i++) {
              (function(index) {
                setTimeout(function() {
                  var p = document.createElement('div');
                  var size = Math.random() * 8 + 4;
                  var x = Math.random() * 100;
                  var delay = Math.random() * 2;
                  p.style.cssText = [
                    'position:absolute',
                    'bottom:-20px',
                    'left:' + x + '%',
                    'width:' + size + 'px',
                    'height:' + size + 'px',
                    'border-radius:50%',
                    'background:' + accent,
                    'opacity:0.5',
                    'animation:wa-particles ' + (1.5 + Math.random()) + 's ease ' + delay + 's infinite'
                  ].join(';');
                  if (particlesEl) particlesEl.appendChild(p);
                }, index * 100);
              })(i);
            }

            // Progress bar
            var prog = document.getElementById('wa-progress');
            if (prog) {
              requestAnimationFrame(function() {
                prog.style.width = '100%';
                prog.style.transitionDuration = (duration / 1000) + 's';
              });
            }

            // Fade out and remove
            setTimeout(function() {
              overlay.style.opacity = '0';
              overlay.style.pointerEvents = 'none';
              setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
              }, 600);
            }, duration);
          }
        }
      }
    }
  };
})();
