const CACHE = 'srservi-v3';

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SRServi - Mantenimiento</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
.c{max-width:400px}
.spinner{width:48px;height:48px;border:4px solid rgba(212,175,55,0.3);border-top-color:#D4AF37;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 24px}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:22px;font-weight:800;margin-bottom:12px;color:#D4AF37}
p{font-size:15px;color:#94a3b8;line-height:1.6;margin-bottom:8px}
.dots::after{content:'';animation:dots 1.5s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.status{margin-top:24px;padding:12px 16px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);border-radius:10px;font-size:13px;color:#D4AF37}
</style>
</head>
<body>
<div class="c">
<div class="spinner"></div>
<h1>Estamos en mantenimiento</h1>
<p>Por favor espera, estamos actualizando el servidor<span class="dots"></span></p>
<p style="font-size:13px;color:#64748b">La página se reiniciará automáticamente cuando el servicio esté disponible.</p>
<div class="status" id="status">Verificando conexión...</div>
</div>
<script>
(function(){
  var el=document.getElementById('status');
  var attempt=0;
  function check(){
    attempt++;
    el.textContent='Intento #'+attempt+' — verificando...';
    fetch('/api/apps/android/version/launcher',{cache:'no-store'}).then(function(r){
      if(r.ok){
        el.textContent='¡Servidor disponible! Recargando...';
        setTimeout(function(){location.reload()},1000);
      } else { setTimeout(check,5000); }
    }).catch(function(){ setTimeout(check,5000); });
  }
  setTimeout(check,5000);
})();
</script>
</body>
</html>`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

function isServerDown(response) {
  return response.status === 502 || response.status === 503 || response.status === 504;
}

function maintenanceResponse() {
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  const isNavigate = e.request.mode === 'navigate';
  const isApi = url.pathname.startsWith('/api/');

  // API requests: no cache, but show maintenance on navigate if server down
  if (isApi) return;

  if (isNavigate) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (isServerDown(res)) return maintenanceResponse();
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(cached => cached || maintenanceResponse())
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok && res.status !== 206) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
