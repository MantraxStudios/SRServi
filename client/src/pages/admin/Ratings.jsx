import { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faQrcode, faCommentAlt, faDownload, faArrowDown, faUsers, faChartBar, faGlobe, faLink } from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

const SURVEY_QUESTIONS = [
  { key: 'frequency',      label: 'Frecuencia de visita' },
  { key: 'how_found',      label: '¿Cómo nos conociste?' },
  { key: 'age_range',      label: 'Rango de edad' },
  { key: 'product_quality', label: 'Calidad del producto' },
  { key: 'disliked',       label: '¿Qué no te gustó?' },
  { key: 'wait_time',      label: 'Tiempo de espera' },
  { key: 'staff',          label: 'Atención del personal' },
  { key: 'price_fair',     label: '¿El precio es justo?' },
  { key: 'return',         label: '¿Volvería a visitarnos?' },
  { key: 'recommend',      label: '¿Recomendarías el lugar?' },
];

const EMOJIS = [
  { emoji: '😡', label: 'Muy malo',  min: 0,  max: 2  },
  { emoji: '😕', label: 'Malo',      min: 3,  max: 4  },
  { emoji: '😐', label: 'Regular',   min: 5,  max: 6  },
  { emoji: '😊', label: 'Bueno',     min: 7,  max: 8  },
  { emoji: '🤩', label: 'Excelente', min: 9,  max: 10 },
];

function getEmoji(val) {
  return EMOJIS.find(e => val >= e.min && val <= e.max) || EMOJIS[2];
}

function getRatingColor(r) {
  if (r <= 2) return '#ef4444';
  if (r <= 4) return '#f97316';
  if (r <= 6) return '#f59e0b';
  if (r <= 8) return '#84cc16';
  return '#22c55e';
}

function RatingBadge({ value }) {
  const e = getEmoji(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44 }}>
      <span style={{ fontSize: 28, lineHeight: 1 }}>{e.emoji}</span>
      <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{value}/10</span>
    </div>
  );
}

export default function Ratings() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [ratings, setRatings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef(null);

  const [surveys, setSurveys] = useState([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ratings');

  const [googleUrl, setGoogleUrl] = useState('');
  const [googleQrDesc, setGoogleQrDesc] = useState('');
  const [idealQrDesc, setIdealQrDesc] = useState('');
  const [downloadingGoogle, setDownloadingGoogle] = useState(false);
  const [downloadingIdeal, setDownloadingIdeal] = useState(false);

  const ratingUrl = selectedStore ? `${BASE_URL}/rate/${selectedStore.code}` : '';
  const surveyUrl = selectedStore ? `${BASE_URL}/survey/${selectedStore.code}` : '';
  const storeName = selectedStore?.name || '';
  const storeColor = selectedStore?.primary_color || '#1a1a2e';
  const accentColor = selectedStore?.accent_color || '#D4AF37';

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

  useEffect(() => {
    if (!selectedStore?.id || !token) return;
    setSurveyLoading(true);
    fetch(`/api/client-surveys?store_id=${selectedStore.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setSurveys(data.surveys || []))
      .catch(() => {})
      .finally(() => setSurveyLoading(false));
  }, [selectedStore?.id, token]);

  useEffect(() => {
    if (!selectedStore?.code) return;
    const saved = localStorage.getItem(`srservi_clasificacion_${selectedStore.code}`);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setGoogleUrl(d.googleUrl || '');
        setGoogleQrDesc(d.googleQrDesc || '');
        setIdealQrDesc(d.idealQrDesc || '');
      } catch {}
    }
  }, [selectedStore?.code]);

  useEffect(() => {
    if (!selectedStore?.code) return;
    localStorage.setItem(
      `srservi_clasificacion_${selectedStore.code}`,
      JSON.stringify({ googleUrl, googleQrDesc, idealQrDesc })
    );
  }, [googleUrl, googleQrDesc, idealQrDesc, selectedStore?.code]);

  const filtered = ratings.filter(r => {
    if (filter === 'high') return r.rating >= 8;
    if (filter === 'mid') return r.rating >= 5 && r.rating < 8;
    if (filter === 'low') return r.rating < 5;
    return true;
  });

  const downloadQRCard = async () => {
    setDownloading(true);
    try {
      const qrCanvas = document.getElementById('rating-qr-canvas');
      if (!qrCanvas) return;

      const W = 800;
      const H = 1000;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // ── Fondo degradado ──────────────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, storeColor);
      grad.addColorStop(1, '#0d0d1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── Círculos decorativos ─────────────────────────────────────────────
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = accentColor;
      ctx.beginPath(); ctx.arc(680, 120, 200, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(80, 900, 160, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.04;
      ctx.beginPath(); ctx.arc(400, 500, 320, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // ── Línea dorada superior ────────────────────────────────────────────
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, W, 6);

      // ── Logo / inicial tienda ────────────────────────────────────────────
      const logoSize = 90;
      const logoX = W / 2 - logoSize / 2;
      const logoY = 50;
      ctx.fillStyle = accentColor;
      roundRect(ctx, logoX, logoY, logoSize, logoSize, 20);
      ctx.fill();
      ctx.fillStyle = storeColor;
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(storeName[0]?.toUpperCase() || '★', W / 2, logoY + logoSize / 2);

      // ── Nombre de la tienda ──────────────────────────────────────────────
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(storeName, W / 2, logoY + logoSize + 50);

      // ── Subtítulo ────────────────────────────────────────────────────────
      ctx.fillStyle = accentColor;
      ctx.font = '500 22px Arial';
      ctx.fillText('Califica tu experiencia', W / 2, logoY + logoSize + 90);

      // ── Estrellas decorativas ────────────────────────────────────────────
      ctx.font = '28px Arial';
      ctx.fillStyle = accentColor;
      ctx.fillText('★  ★  ★  ★  ★', W / 2, logoY + logoSize + 130);

      // ── Tarjeta blanca del QR ────────────────────────────────────────────
      const cardW = 400;
      const cardH = 420;
      const cardX = W / 2 - cardW / 2;
      const cardY = 320;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, cardX, cardY, cardW, cardH, 28);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // ── QR code dentro de la tarjeta ─────────────────────────────────────
      const qrSize = 300;
      const qrX = W / 2 - qrSize / 2;
      const qrY = cardY + 30;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // ── Texto "Escanea aquí" ──────────────────────────────────────────────
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Escanea para calificar', W / 2, cardY + cardH - 30);

      // ── URL abreviada ────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px Arial';
      const shortUrl = ratingUrl.replace('https://', '').replace('http://', '');
      ctx.fillText(shortUrl, W / 2, cardY + cardH + 44);

      // ── Escala de emojis ─────────────────────────────────────────────────
      const scaleY = cardY + cardH + 90;
      const emojiList = ['😡','😕','😐','😊','🤩'];
      const emojiLabels = ['Muy malo','Malo','Regular','Bueno','Excelente'];
      const emojiSpacing = (W - 120) / (emojiList.length - 1);
      ctx.font = '52px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      emojiList.forEach((em, i) => {
        const x = 60 + i * emojiSpacing;
        ctx.fillText(em, x, scaleY);
      });
      ctx.font = '13px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textBaseline = 'top';
      emojiLabels.forEach((lb, i) => {
        const x = 60 + i * emojiSpacing;
        ctx.fillText(lb, x, scaleY + 36);
      });

      // ── Línea dorada inferior ─────────────────────────────────────────────
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, H - 60, W, 4);

      // ── Branding ─────────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Powered by SRAutomatic.cl', W / 2, H - 30);

      // ── Exportar como JPG ─────────────────────────────────────────────────
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr-calificacion-${selectedStore?.code || 'tienda'}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.95);

    } finally {
      setDownloading(false);
    }
  };

  const downloadGenericQRCard = async ({ canvasId, title, subtitle, description, filename, bgColor }) => {
    const color = bgColor || storeColor;
    const qrCanvas = document.getElementById(canvasId);
    if (!qrCanvas) return;

    const W = 800;
    const H = 1100;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.arc(680, 120, 200, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, 900, 160, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, W, 6);

    const logoSize = 80;
    const logoX = W / 2 - logoSize / 2;
    const logoY = 40;
    ctx.fillStyle = accentColor;
    roundRect(ctx, logoX, logoY, logoSize, logoSize, 18);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(storeName[0]?.toUpperCase() || '★', W / 2, logoY + logoSize / 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(storeName, W / 2, logoY + logoSize + 46);

    ctx.fillStyle = accentColor;
    ctx.font = '600 20px Arial';
    ctx.fillText(title, W / 2, logoY + logoSize + 82);

    const cardW = 400;
    const cardH = 420;
    const cardX = W / 2 - cardW / 2;
    const cardY = 280;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    const qrSize = 300;
    ctx.drawImage(qrCanvas, W / 2 - qrSize / 2, cardY + 30, qrSize, qrSize);

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(subtitle, W / 2, cardY + cardH - 28);

    if (description) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '15px Arial';
      ctx.textAlign = 'center';
      const maxWidth = W - 100;
      const words = description.split(' ');
      let line = '';
      let y = cardY + cardH + 52;
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, W / 2, y);
          line = word;
          y += 26;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, W / 2, y);
    }

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, H - 60, W, 4);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Powered by SRAutomatic.cl', W / 2, H - 30);

    return new Promise(resolve => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/jpeg', 0.95);
    });
  };

  const downloadGoogleQR = async () => {
    setDownloadingGoogle(true);
    try {
      await downloadGenericQRCard({
        canvasId: 'google-qr-canvas',
        title: 'Clasifícanos en Google',
        subtitle: 'Escanea para dejar tu reseña',
        description: googleQrDesc,
        filename: `qr-google-${selectedStore?.code || 'tienda'}.jpg`,
        bgColor: '#1a237e',
      });
    } finally {
      setDownloadingGoogle(false);
    }
  };

  const downloadIdealQR = async () => {
    setDownloadingIdeal(true);
    try {
      await downloadGenericQRCard({
        canvasId: 'ideal-qr-canvas-clasi',
        title: 'Cliente Ideal',
        subtitle: 'Escanea para responder',
        description: idealQrDesc,
        filename: `qr-cliente-ideal-${selectedStore?.code || 'tienda'}.jpg`,
      });
    } finally {
      setDownloadingIdeal(false);
    }
  };

  // Helper: rounded rect path
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

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

  // Build survey stats per question
  const surveyStats = SURVEY_QUESTIONS.map(q => {
    const counts = {};
    surveys.forEach(s => {
      let ans;
      try { ans = typeof s.answers === 'string' ? JSON.parse(s.answers) : s.answers; } catch { ans = {}; }
      const v = ans[q.key];
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { ...q, counts, total, sorted };
  });

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>
        <FontAwesomeIcon icon={faStar} style={{ color: '#f59e0b', marginRight: 10 }} />
        Calificaciones — {selectedStore.name}
      </h1>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        {[
          { key: 'ratings', icon: faStar, label: 'Calificaciones' },
          { key: 'survey', icon: faUsers, label: 'Cliente Ideal' },
          { key: 'clasificacion', icon: faGlobe, label: 'Clasificación' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              color: activeTab === t.key ? '#1e293b' : '#9ca3af',
              borderBottom: activeTab === t.key ? '3px solid #1e293b' : '3px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <FontAwesomeIcon icon={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ratings' && <>
      <div style={styles.grid}>
        {/* Summary card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Resumen</h3>
          {loading ? (
            <p style={{ color: '#9ca3af' }}>Cargando...</p>
          ) : summary && summary.total > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, lineHeight: 1 }}>
                    {getEmoji(Math.round(parseFloat(summary.avg_rating) || 0)).emoji}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 800, marginTop: 2,
                    color: getRatingColor(Math.round(parseFloat(summary.avg_rating) || 0)),
                  }}>
                    {parseFloat(summary.avg_rating).toFixed(1)}/10
                  </div>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Promedio</p>
                  <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{summary.total} calificación{summary.total !== 1 ? 'es' : ''}</p>
                </div>
              </div>
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(parseFloat(summary.avg_rating) / 10) * 100}%`,
                  background: getRatingColor(Math.round(parseFloat(summary.avg_rating))),
                  borderRadius: 4, transition: 'width 0.5s',
                }} />
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' }}>sobre 10</p>

              {/* Per-emoji breakdown */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {EMOJIS.slice().reverse().map(e => {
                  const count = ratings.filter(r => r.rating >= e.min && r.rating <= e.max).length;
                  const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                  return (
                    <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, lineHeight: 1, minWidth: 22 }}>{e.emoji}</span>
                      <span style={{ fontSize: 11, color: '#6b7280', minWidth: 58 }}>{e.label}</span>
                      <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: getRatingColor(Math.round((e.min + e.max) / 2)),
                          borderRadius: 4,
                          transition: 'width 0.5s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 34, textAlign: 'right' }}>
                        {pct}%
                      </span>
                      <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 20 }}>({count})</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p style={{ color: '#9ca3af' }}>Sin calificaciones aún.</p>
          )}
        </div>

        {/* QR card */}
        <div style={{
          ...styles.card,
          background: `linear-gradient(135deg, ${storeColor} 0%, #0d0d1a 100%)`,
          border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0, padding: 0, overflow: 'hidden',
        }}>
          {/* Header de la card */}
          <div style={{ width: '100%', padding: '20px 20px 0', textAlign: 'center' }}>
            {/* Inicial / logo */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              fontSize: 22, fontWeight: 900, color: storeColor,
              boxShadow: `0 4px 20px ${accentColor}66`,
            }}>
              {storeName[0]?.toUpperCase() || '★'}
            </div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{storeName}</p>
            <p style={{ color: accentColor, fontSize: 12, fontWeight: 600, margin: '0 0 14px', letterSpacing: 1 }}>
              CALIFICA TU EXPERIENCIA
            </p>
          </div>

          {/* QR + marco */}
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: 16,
            margin: '0 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <QRCodeCanvas
              id="rating-qr-canvas"
              value={ratingUrl}
              size={180}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: '',
                excavate: false,
              }}
            />
            {/* Escala mini emojis */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              {EMOJIS.map(e => (
                <span key={e.label} style={{ fontSize: 20 }} title={e.label}>{e.emoji}</span>
              ))}
            </div>
          </div>

          {/* URL */}
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, margin: '8px 20px 0', textAlign: 'center', wordBreak: 'break-all' }}>
            {ratingUrl}
          </p>

          {/* Botón descargar */}
          <button
            onClick={downloadQRCard}
            disabled={downloading}
            style={{
              margin: '14px 20px 20px',
              width: 'calc(100% - 40px)',
              padding: '13px',
              borderRadius: 14,
              border: `2px solid ${accentColor}`,
              background: downloading ? 'rgba(255,255,255,0.08)' : accentColor,
              color: downloading ? accentColor : storeColor,
              fontWeight: 800,
              fontSize: 14,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              letterSpacing: 0.5,
            }}
          >
            <FontAwesomeIcon icon={faDownload} />
            {downloading ? 'Generando...' : 'Descargar QR (.jpg)'}
          </button>
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
        <div style={styles.empty}><p>Cargando calificaciones...</p></div>
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
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
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
      </>}

      {/* ── SURVEY TAB ── */}
      {activeTab === 'survey' && <>
        <div style={styles.grid}>
          {/* Survey QR card */}
          <div style={{
            ...styles.card,
            background: `linear-gradient(135deg, ${storeColor} 0%, #0d0d1a 100%)`,
            border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 0, padding: 0, overflow: 'hidden',
          }}>
            <div style={{ width: '100%', padding: '20px 20px 0', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: 22, fontWeight: 900, color: storeColor,
                boxShadow: `0 4px 20px ${accentColor}66`,
              }}>🎯</div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{storeName}</p>
              <p style={{ color: accentColor, fontSize: 12, fontWeight: 600, margin: '0 0 14px', letterSpacing: 1 }}>
                ENCUESTA · CLIENTE IDEAL
              </p>
            </div>

            <div style={{
              background: '#fff', borderRadius: 20, padding: 16,
              margin: '0 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <QRCodeCanvas
                id="survey-qr-canvas"
                value={surveyUrl}
                size={180}
                level="H"
                includeMargin={false}
              />
              <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, margin: 0 }}>Escanea para responder</p>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, margin: '8px 20px 20px', textAlign: 'center', wordBreak: 'break-all' }}>
              {surveyUrl}
            </p>
          </div>

          {/* Survey summary card */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <FontAwesomeIcon icon={faChartBar} style={{ color: accentColor, marginRight: 8 }} />
              Resumen encuestas
            </h3>
            {surveyLoading ? (
              <p style={{ color: '#9ca3af' }}>Cargando...</p>
            ) : surveys.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>Sin respuestas aún.</p>
            ) : (
              <>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>
                  {surveys.length} respuesta{surveys.length !== 1 ? 's' : ''} recibida{surveys.length !== 1 ? 's' : ''}
                </p>
                {surveyStats.map(q => (
                  <div key={q.key} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>{q.label}</p>
                    {q.sorted.map(([opt, count]) => {
                      const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
                      return (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 120 }}>{opt}</span>
                          <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: accentColor, borderRadius: 4, transition: 'width 0.5s',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                          <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 20 }}>({count})</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Survey responses list */}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '8px 0 12px' }}>
          Respuestas individuales
        </h3>
        {surveyLoading ? (
          <div style={styles.empty}><p>Cargando...</p></div>
        ) : surveys.length === 0 ? (
          <div style={styles.empty}>
            <FontAwesomeIcon icon={faUsers} style={{ fontSize: 36, color: '#d1d5db', marginBottom: 10 }} />
            <p style={{ color: '#9ca3af' }}>Aún no hay respuestas de encuesta.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {surveys.map(s => {
              let ans;
              try { ans = typeof s.answers === 'string' ? JSON.parse(s.answers) : s.answers; } catch { ans = {}; }
              return (
                <div key={s.id} style={{ ...styles.ratingItem, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Respuesta #{s.id}</span>
                    <span style={{ ...styles.tag, color: '#9ca3af' }}>
                      {new Date(s.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {SURVEY_QUESTIONS.map(q => (
                    <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{q.label}</span>
                      <span style={{ ...styles.tag, background: `${accentColor}20`, color: '#1e293b', fontWeight: 700 }}>
                        {ans[q.key] || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </>}

      {/* ── CLASIFICACIÓN TAB ── */}
      {activeTab === 'clasificacion' && (
        <div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            Genera y descarga QR personalizados para compartir con tus clientes. Escribe una descripción para cada uno.
          </p>
          <div style={styles.grid}>
            {/* Google QR card */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <FontAwesomeIcon icon={faGlobe} style={{ color: '#4285F4', marginRight: 8 }} />
                QR Google — Clasificar tienda
              </h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Link de Google Maps / Reseñas
                </label>
                <input
                  type="url"
                  value={googleUrl}
                  onChange={e => setGoogleUrl(e.target.value)}
                  placeholder="https://g.page/tu-negocio/review"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Descripción
                </label>
                <textarea
                  value={googleQrDesc}
                  onChange={e => setGoogleQrDesc(e.target.value)}
                  placeholder="Ej: Escanea y ayúdanos a crecer dejando tu reseña en Google"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
              {googleUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <QRCodeCanvas
                      id="google-qr-canvas"
                      value={googleUrl}
                      size={160}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  {googleQrDesc && (
                    <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', margin: 0 }}>{googleQrDesc}</p>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 100, background: '#f9fafb', borderRadius: 12, marginBottom: 14,
                  border: '2px dashed #e5e7eb',
                }}>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>Ingresa el link para ver el QR</span>
                </div>
              )}
              <button
                onClick={downloadGoogleQR}
                disabled={!googleUrl || downloadingGoogle}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: googleUrl ? '#4285F4' : '#e5e7eb',
                  color: googleUrl ? '#fff' : '#9ca3af',
                  fontWeight: 700, fontSize: 14,
                  cursor: googleUrl && !downloadingGoogle ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <FontAwesomeIcon icon={faDownload} />
                {downloadingGoogle ? 'Generando...' : 'Descargar QR Google (.jpg)'}
              </button>
            </div>

            {/* Cliente Ideal QR card */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <FontAwesomeIcon icon={faUsers} style={{ color: accentColor, marginRight: 8 }} />
                QR Cliente Ideal
              </h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Descripción
                </label>
                <textarea
                  value={idealQrDesc}
                  onChange={e => setIdealQrDesc(e.target.value)}
                  placeholder="Ej: Escanea y cuéntanos quién eres para mejorar nuestro servicio"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <QRCodeCanvas
                    id="ideal-qr-canvas-clasi"
                    value={surveyUrl}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                {idealQrDesc && (
                  <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', margin: 0 }}>{idealQrDesc}</p>
                )}
              </div>
              <button
                onClick={downloadIdealQR}
                disabled={downloadingIdeal}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: accentColor, color: storeColor,
                  fontWeight: 700, fontSize: 14,
                  cursor: downloadingIdeal ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <FontAwesomeIcon icon={faDownload} />
                {downloadingIdeal ? 'Generando...' : 'Descargar QR Cliente Ideal (.jpg)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: '28px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title: { fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 14, marginTop: 0 },
  filterRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  filterBtn: { padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', lineHeight: '20px' },
  ratingItem: { display: 'flex', alignItems: 'flex-start', gap: 14, background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  tag: { fontSize: 11, color: '#6b7280', background: '#f1f5f9', borderRadius: 6, padding: '2px 7px' },
  empty: { textAlign: 'center', padding: '48px 24px', color: '#6b7280', fontSize: 15 },
};
