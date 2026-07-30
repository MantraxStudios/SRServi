import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getProductImageUrl } from '../config.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils } from '@fortawesome/free-solid-svg-icons';
import NoSleep from 'nosleep.js';

// Pantalla de TV que muestra el catálogo de la tienda en tarjetitas (5 arriba, 5 abajo)
// que van rotando en bucle con una animación tipo "toon" (rebote). Se empareja por
// código de tienda: /tv-menu/:code
const PAGE_SIZE = 10;       // 5 arriba + 5 abajo
const ROTATE_MS = 7000;     // cada cuánto cambia de página

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function TvMenu() {
  const { code } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  // Mantener la pantalla encendida
  useEffect(() => {
    const noSleep = new NoSleep();
    noSleep.enable().catch(() => {
      const enable = () => { noSleep.enable().catch(() => {}); document.removeEventListener('click', enable); };
      document.addEventListener('click', enable, { once: true });
    });
    return () => noSleep.disable();
  }, []);

  // Cargar tienda + productos
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/${code}`);
        if (!res.ok) throw new Error('Tienda no encontrada');
        const json = await res.json();
        if (cancelled) return;
        setStore(json.store || null);
        // Solo productos disponibles y con nombre
        const list = (json.products || []).filter(p =>
          p && p.name && (p.available === undefined || p.available)
        );
        setProducts(list);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    load();
    // Refrescar el catálogo cada 5 minutos por si cambian precios/productos
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [code]);

  const pages = useMemo(() => chunk(products, PAGE_SIZE), [products]);

  // Rotar de página en bucle
  useEffect(() => {
    if (pages.length <= 1) return;
    const iv = setInterval(() => {
      setPage(p => (p + 1) % pages.length);
    }, ROTATE_MS);
    return () => clearInterval(iv);
  }, [pages.length]);

  // Si cambia la cantidad de páginas y la actual queda fuera de rango
  useEffect(() => {
    if (page >= pages.length) setPage(0);
  }, [pages.length, page]);

  const accent = store?.accent_color || '#D4AF37';
  const symbol = store?.currency_symbol || '$';
  const hideDecimals = store?.hide_decimals;
  const money = (v) => {
    const n = Number(v || 0);
    return `${symbol}${n.toLocaleString('es-CL', {
      minimumFractionDigits: hideDecimals ? 0 : 0,
      maximumFractionDigits: hideDecimals ? 0 : 0,
    })}`;
  };

  if (error) {
    return (
      <div style={styles.center}>
        <div style={{ textAlign: 'center' }}>
          <FontAwesomeIcon icon={faUtensils} style={{ fontSize: 40, color: '#52525b', marginBottom: 16 }} />
          <div style={{ color: '#e4e4e7', fontSize: 22, fontWeight: 700 }}>{error}</div>
          <div style={{ color: '#71717a', fontSize: 14, marginTop: 8 }}>Verificá el código de la tienda.</div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={styles.center}>
        <div style={{ ...styles.spinner, borderTopColor: accent }} />
      </div>
    );
  }

  const current = pages[page] || [];

  return (
    <div style={styles.root}>
      <style>{keyframes}</style>

      {/* Encabezado */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {store.logo_url
            ? <img src={store.logo_url} alt="" style={styles.logo} />
            : <div style={{ ...styles.logoFallback, background: accent }}>
                <FontAwesomeIcon icon={faUtensils} />
              </div>}
          <div>
            <div style={styles.storeName}>{store.name}</div>
            <div style={{ color: accent, fontSize: '1.4vmin', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
              Nuestro menú
            </div>
          </div>
        </div>
        {pages.length > 1 && (
          <div style={styles.dots}>
            {pages.map((_, i) => (
              <span key={i} style={{
                ...styles.dot,
                background: i === page ? accent : 'rgba(255,255,255,0.18)',
                width: i === page ? '3.2vmin' : '1.4vmin',
              }} />
            ))}
          </div>
        )}
      </header>

      {/* Grilla de tarjetitas — key por página para relanzar la animación toon */}
      {current.length === 0 ? (
        <div style={{ ...styles.center, flex: 1 }}>
          <div style={{ color: '#a1a1aa', fontSize: 22, fontWeight: 700 }}>No hay productos para mostrar</div>
        </div>
      ) : (
        <div key={page} style={styles.grid}>
          {current.map((p, i) => (
            <article
              key={p.id ?? i}
              style={{ ...styles.card, animationDelay: `${i * 70}ms` }}
            >
              <div style={styles.imgWrap}>
                <img
                  src={getProductImageUrl(p.image)}
                  alt={p.name}
                  loading="eager"
                  style={styles.img}
                />
              </div>
              <div style={styles.info}>
                <div style={styles.name}>{p.name}</div>
                <div style={{ ...styles.price, color: accent }}>{money(p.price)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const keyframes = `
  @keyframes tvmenu-pop {
    0%   { opacity: 0; transform: scale(0.2) rotate(-12deg) translateY(24px); }
    60%  { opacity: 1; transform: scale(1.12) rotate(3deg) translateY(-6px); }
    80%  { transform: scale(0.96) rotate(-1deg) translateY(2px); }
    100% { opacity: 1; transform: scale(1) rotate(0deg) translateY(0); }
  }
  @keyframes tvmenu-spin { to { transform: rotate(360deg); } }
`;

const styles = {
  root: {
    width: '100vw', height: '100vh', overflow: 'hidden',
    background: 'radial-gradient(120% 120% at 50% 0%, #1a1a1f 0%, #09090b 60%)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#fafafa', padding: '2.4vmin',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '2.2vmin', flexShrink: 0,
  },
  logo: { width: '7vmin', height: '7vmin', borderRadius: '1.6vmin', objectFit: 'cover' },
  logoFallback: {
    width: '7vmin', height: '7vmin', borderRadius: '1.6vmin',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#000', fontSize: '3.2vmin',
  },
  storeName: { fontSize: '3.4vmin', fontWeight: 900, lineHeight: 1 },
  dots: { display: 'flex', alignItems: 'center', gap: '1vmin' },
  dot: { height: '1.4vmin', borderRadius: 999, transition: 'all 0.4s ease' },
  grid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap: '2vmin', minHeight: 0,
  },
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '2vmin', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', minHeight: 0,
    boxShadow: '0 1.2vmin 3vmin rgba(0,0,0,0.45)',
    animation: 'tvmenu-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
  },
  imgWrap: { flex: 1, minHeight: 0, background: '#000', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  info: { padding: '1.4vmin 1.6vmin', flexShrink: 0 },
  name: {
    fontSize: '2vmin', fontWeight: 800, lineHeight: 1.15,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  price: { fontSize: '2.6vmin', fontWeight: 900, marginTop: '0.6vmin' },
  center: {
    width: '100vw', height: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: '#09090b',
  },
  spinner: {
    width: 54, height: 54, border: '5px solid rgba(255,255,255,0.12)',
    borderTopColor: '#D4AF37', borderRadius: '50%',
    animation: 'tvmenu-spin 1s linear infinite',
  },
};

export default TvMenu;
