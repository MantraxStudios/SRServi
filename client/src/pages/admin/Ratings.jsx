import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faQrcode, faCommentAlt, faDownload } from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

function getRatingColor(r) {
  if (r <= 3) return '#ef4444';
  if (r <= 6) return '#f59e0b';
  return '#22c55e';
}

function RatingBadge({ value }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 36, borderRadius: '50%',
      background: getRatingColor(value), color: '#fff',
      fontWeight: 800, fontSize: 15,
    }}>
      {value}
    </span>
  );
}

function StarsDisplay({ value }) {
  const filled = Math.round(value);
  return (
    <span style={{ fontSize: 18, letterSpacing: 2 }}>
      {[...Array(11)].map((_, i) => (
        <span key={i} style={{ color: i < filled ? '#f59e0b' : '#e5e7eb' }}>●</span>
      ))}
    </span>
  );
}

export default function Ratings() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [ratings, setRatings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'high' | 'mid' | 'low'

  const ratingUrl = selectedStore ? `${BASE_URL}/rate/${selectedStore.code}` : '';

  useEffect(() => {
    if (!selectedStore?.id || !token) return;
    setLoading(true);
    fetch(`/api/ratings?store_id=${selectedStore.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setRatings(data.ratings || []);
        setSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedStore?.id, token]);

  const filtered = ratings.filter(r => {
    if (filter === 'high') return r.rating >= 8;
    if (filter === 'mid') return r.rating >= 5 && r.rating < 8;
    if (filter === 'low') return r.rating < 5;
    return true;
  });

  const downloadQR = () => {
    const canvas = document.getElementById('rating-qr-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-calificacion-${selectedStore?.code || 'tienda'}.png`;
    a.click();
  };

  if (!selectedStore) {
    return (
      <div style={styles.page}>
        <div style={styles.empty}>
          <FontAwesomeIcon icon={faStar} style={{ fontSize: 40, color: '#d1d5db', marginBottom: 12 }} />
          <p>Selecciona una tienda para ver las calificaciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>
        <FontAwesomeIcon icon={faStar} style={{ color: '#f59e0b', marginRight: 10 }} />
        Calificaciones — {selectedStore.name}
      </h1>

      <div style={styles.grid}>
        {/* Summary card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Resumen</h3>
          {loading ? (
            <p style={{ color: '#9ca3af' }}>Cargando...</p>
          ) : summary ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: getRatingColor(Math.round(parseFloat(summary.avg_rating) || 0)),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: 28,
                }}>
                  {summary.avg_rating ? parseFloat(summary.avg_rating).toFixed(1) : '—'}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Promedio</p>
                  <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{summary.total} calificación{summary.total !== 1 ? 'es' : ''}</p>
                </div>
              </div>
              {summary.avg_rating && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(parseFloat(summary.avg_rating) / 10) * 100}%`,
                      background: getRatingColor(Math.round(parseFloat(summary.avg_rating))),
                      borderRadius: 4,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' }}>sobre 10</p>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#9ca3af' }}>Sin calificaciones aún.</p>
          )}
        </div>

        {/* QR card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            <FontAwesomeIcon icon={faQrcode} style={{ marginRight: 8, color: '#6b7280' }} />
            QR de calificación
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 12, background: '#fff', borderRadius: 12, border: '2px solid #e5e7eb' }}>
              <QRCodeCanvas
                id="rating-qr-canvas"
                value={ratingUrl}
                size={160}
                level="H"
                includeMargin={false}
              />
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', margin: 0, wordBreak: 'break-all' }}>
              {ratingUrl}
            </p>
            <button onClick={downloadQR} style={styles.downloadBtn}>
              <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} />
              Descargar QR
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={styles.filterRow}>
        {[
          { key: 'all', label: 'Todas' },
          { key: 'high', label: '8-10 ✅' },
          { key: 'mid', label: '5-7 🟡' },
          { key: 'low', label: '0-4 🔴' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...styles.filterBtn,
              background: filter === f.key ? '#1e293b' : '#f1f5f9',
              color: filter === f.key ? '#fff' : '#374151',
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af', lineHeight: '32px' }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Ratings list */}
      {loading ? (
        <div style={styles.empty}>
          <p>Cargando calificaciones...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <FontAwesomeIcon icon={faCommentAlt} style={{ fontSize: 36, color: '#d1d5db', marginBottom: 10 }} />
          <p style={{ color: '#9ca3af' }}>No hay calificaciones en este rango aún.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={styles.ratingItem}>
              <RatingBadge value={r.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {r.comment ? (
                  <p style={{ margin: 0, fontSize: 14, color: '#374151', wordBreak: 'break-word' }}>"{r.comment}"</p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Sin comentario</p>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={styles.tag}>{r.source === 'post_order' ? '📦 Post-pedido' : '📷 QR'}</span>
                  {r.order_id && <span style={styles.tag}>Pedido #{r.order_id}</span>}
                  <span style={{ ...styles.tag, color: '#9ca3af' }}>
                    {new Date(r.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '28px 24px',
    maxWidth: 860,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: 24,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    border: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 14,
    marginTop: 0,
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: 20,
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    lineHeight: '20px',
  },
  ratingItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    background: '#fff',
    borderRadius: 12,
    padding: '14px 16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #f1f5f9',
  },
  tag: {
    fontSize: 11,
    color: '#6b7280',
    background: '#f1f5f9',
    borderRadius: 6,
    padding: '2px 7px',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#6b7280',
    fontSize: 15,
  },
  downloadBtn: {
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
