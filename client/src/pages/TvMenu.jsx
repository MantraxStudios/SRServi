import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getProductImageUrl } from '../config.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils } from '@fortawesome/free-solid-svg-icons';
import NoSleep from 'nosleep.js';

// Pantalla de TV que muestra el catálogo de la tienda con el MISMO diseño de tarjeta
// que Store.jsx (tarjeta blanca, imagen arriba, nombre y precio abajo), pero sin las
// barras de arriba ni el botón "+" para agregar. 5 tarjetas arriba y 5 abajo, que
// rotan en bucle con una animación tipo "toon". Se empareja por código: /tv-menu/:code
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
    const iv = setInterval(() => setPage(p => (p + 1) % pages.length), ROTATE_MS);
    return () => clearInterval(iv);
  }, [pages.length]);

  useEffect(() => {
    if (page >= pages.length) setPage(0);
  }, [pages.length, page]);

  const accent = store?.accent_color || '#D4AF37';
  const symbol = store?.currency_symbol || '$';
  const hideDecimals = store?.hide_decimals;
  const formatPrice = (v) => {
    const n = Number(v || 0);
    if (hideDecimals || Number.isInteger(n)) return Math.round(n).toLocaleString('es-CL');
    return n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (error) {
    return (
      <div style={styles.center}>
        <div style={{ textAlign: 'center' }}>
          <FontAwesomeIcon icon={faUtensils} style={{ fontSize: 40, color: '#c9bfa8', marginBottom: 16 }} />
          <div style={{ color: '#232028', fontSize: 22, fontWeight: 800 }}>{error}</div>
          <div style={{ color: '#8f8a80', fontSize: 14, marginTop: 8 }}>Verificá el código de la tienda.</div>
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
    <div
      className="store-container store-framed"
      style={{
        '--store-primary': store.primary_color || '#000000',
        '--store-secondary': store.secondary_color || '#FFFFFF',
        '--store-accent': accent,
        justifyContent: 'center',
      }}
    >
      <style>{extraCss}</style>

      {current.length === 0 ? (
        <div style={{ ...styles.center, background: 'transparent' }}>
          <div style={{ color: '#8f8a80', fontSize: 22, fontWeight: 800 }}>No hay productos para mostrar</div>
        </div>
      ) : (
        // key por página: relanza la animación toon en cada rotación
        <div key={page} className="products-grid tvmenu-grid">
          {current.map((p, i) => (
            <div
              key={p.id ?? i}
              className="store-product-wrapper tvmenu-card"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="store-product-card">
                <div className="store-product-image">
                  <img src={getProductImageUrl(p.image)} alt={p.name} loading="eager" decoding="async" />
                </div>
              </div>
              <div className="store-product-info">
                <div className="store-product-name">{p.name}</div>
                <div className="store-product-details">
                  <span className="store-product-price">{symbol}{formatPrice(p.price)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Fuerza la grilla a 5 columnas × 2 filas ocupando la pantalla y añade la animación toon.
const extraCss = `
  .tvmenu-grid {
    grid-template-columns: repeat(5, 1fr) !important;
    grid-auto-rows: 1fr;
    align-content: center;
    gap: 1.6vmin !important;
    padding: 2vmin 2.4vmin !important;
    width: 100%;
    max-height: 100vh;
    box-sizing: border-box;
  }
  .tvmenu-card {
    animation: tvmenu-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }
  @keyframes tvmenu-pop {
    0%   { opacity: 0; transform: scale(0.2) rotate(-12deg) translateY(24px); }
    60%  { opacity: 1; transform: scale(1.12) rotate(3deg) translateY(-6px); }
    80%  { transform: scale(0.96) rotate(-1deg) translateY(2px); }
    100% { opacity: 1; transform: scale(1) rotate(0deg) translateY(0); }
  }
`;

const styles = {
  center: {
    width: '100vw', height: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: '#FAF4E9',
  },
  spinner: {
    width: 54, height: 54, border: '5px solid rgba(0,0,0,0.10)',
    borderTopColor: '#D4AF37', borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default TvMenu;
