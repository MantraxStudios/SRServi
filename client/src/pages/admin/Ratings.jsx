import { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faQrcode, faCommentAlt, faDownload, faArrowDown, faUsers, faChartBar, faGlobe, faLink, faTimes, faFilter, faCalendarAlt, faImage } from '@fortawesome/free-solid-svg-icons';
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

  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyDateFrom, setSurveyDateFrom] = useState('');
  const [surveyDateTo, setSurveyDateTo] = useState('');

  const [promoImages, setPromoImages] = useState([null, null]);
  const [promoGiftText, setPromoGiftText] = useState('');

  const handlePromoImage = (index, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setPromoImages(prev => {
      const next = [...prev]; next[index] = e.target.result; return next;
    });
    reader.readAsDataURL(file);
  };

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

  const [clasificacionSaving, setClasificacionSaving] = useState(false);
  const [clasificacionSaved, setClasificacionSaved] = useState(false);

  // Load clasificacion settings from DB
  useEffect(() => {
    if (!selectedStore?.id || !token) return;
    fetch(`/api/store-clasificacion?store_id=${selectedStore.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        setGoogleUrl(d.google_url || '');
        setGoogleQrDesc(d.google_qr_desc || '');
        setIdealQrDesc(d.ideal_qr_desc || '');
        setPromoGiftText(d.promo_gift_text || '');
        setPromoImages([d.promo_image1 || null, d.promo_image2 || null]);
      })
      .catch(() => {});
  }, [selectedStore?.id, token]);

  const saveClasificacion = async () => {
    if (!selectedStore?.id || !token) return;
    setClasificacionSaving(true);
    try {
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('google_url', googleUrl);
      fd.append('google_qr_desc', googleQrDesc);
      fd.append('ideal_qr_desc', idealQrDesc);
      fd.append('promo_gift_text', promoGiftText);

      for (const [i, img] of promoImages.entries()) {
        if (!img) {
          fd.append(`image${i + 1}_existing`, '');
        } else if (img.startsWith('data:')) {
          // New upload — convert base64 to Blob
          const res = await fetch(img);
          const blob = await res.blob();
          fd.append(`image${i + 1}`, blob, `promo_image_${i + 1}.jpg`);
        } else {
          // Existing server URL — keep as-is
          fd.append(`image${i + 1}_existing`, img);
        }
      }

      const res = await fetch('/api/store-clasificacion', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        // Update state to server URLs so next save won't re-upload
        setPromoImages([data.promo_image1 || null, data.promo_image2 || null]);
        setClasificacionSaved(true);
        setTimeout(() => setClasificacionSaved(false), 2500);
      }
    } catch (e) { console.error(e); }
    finally { setClasificacionSaving(false); }
  };

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

  const downloadCombinedQR = async () => {
    setDownloadingGoogle(true);
    try {
      const googleQrCanvas = document.getElementById('google-qr-canvas');
      const idealQrCanvas = document.getElementById('ideal-qr-canvas-clasi');
      if (!idealQrCanvas) return;

      // ── 1. Load all images async FIRST (logo + promo) ──
      let logoImg = null;
      if (selectedStore?.logo_url) {
        try {
          logoImg = await new Promise((res, rej) => {
            const img = new Image(); img.crossOrigin = 'anonymous';
            img.onload = () => res(img); img.onerror = () => rej();
            img.src = selectedStore.logo_url;
          });
        } catch {}
      }
      const loadedPromo = await Promise.all(
        promoImages.map(src => src
          ? new Promise(res => {
              const img = new Image();
              img.onload = () => res(img); img.onerror = () => res(null);
              img.src = src;
            })
          : Promise.resolve(null)
        )
      );
      const activePromo = loadedPromo.filter(Boolean);

      // ── 2. Layout — computed before canvas creation so H is correct ──
      const W = 800;
      const cx = W / 2;
      const pad = 22;
      const gap = 12;
      const logoSize = 120;
      const logoY = 55;
      const nameY = logoY + logoSize + 48;    // 223
      const badgeY = nameY + 108;             // 331
      const cardW = (W - pad * 2 - gap) / 2; // 372px each
      const qrSize = 240;
      const cardH = 420;
      const promoImgH = 240;
      const hasPromo = activePromo.length > 0;
      const hasGiftText = !!promoGiftText.trim();
      const promoSectionH = hasPromo ? promoImgH + 60 : 0;
      const cardY = 460 + promoSectionH;
      const card1X = pad;
      const card2X = pad + cardW + gap;
      const H = cardY + cardH + 80;           // portrait: ~1040–1286px

      // ── 3. Create canvas ──
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // ── Fondo blanco ──
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // ── Bolitas de colores decorativas ──
      const bubbles = [
        { x: 35,    y: 70,   r: 55,  color: '#FF6B9D', alpha: 0.18 },
        { x: W-35,  y: 90,   r: 60,  color: '#FFE66D', alpha: 0.20 },
        { x: 50,    y: H-90, r: 65,  color: '#4ECDC4', alpha: 0.16 },
        { x: W-50,  y: H-110,r: 70,  color: '#A78BFA', alpha: 0.16 },
        { x: cx,    y: 25,   r: 42,  color: '#F97316', alpha: 0.14 },
        { x: cx,    y: H-45, r: 50,  color: '#34D399', alpha: 0.15 },
        { x: 24,    y: H/2,  r: 36,  color: '#60A5FA', alpha: 0.14 },
        { x: W-24,  y: H/2,  r: 42,  color: '#F472B6', alpha: 0.14 },
        { x: 180,   y: 28,   r: 26,  color: '#FBBF24', alpha: 0.20 },
        { x: W-180, y: H-32, r: 28,  color: '#818CF8', alpha: 0.18 },
        { x: 130,   y: H-40, r: 22,  color: '#2DD4BF', alpha: 0.18 },
        { x: W-130, y: 38,   r: 24,  color: '#FB7185', alpha: 0.20 },
        { x: cx-70, y: cardY-28, r: 18, color: '#D4AF37', alpha: 0.28 },
        { x: cx+70, y: cardY-28, r: 18, color: '#D4AF37', alpha: 0.28 },
      ];
      bubbles.forEach(b => {
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Borde exterior dorado ──
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 5;
      roundRect(ctx, 12, 12, W - 24, H - 24, 28);
      ctx.stroke();

      // ── Franja dorada superior ──
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, 12, 12, W - 24, 10, 28);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.restore();

      // ── 7. Logo ──
      if (logoImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logoImg, cx - logoSize / 2, logoY, logoSize, logoSize);
        ctx.restore();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, logoY + logoSize / 2, logoSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(cx, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(logoSize * 0.42)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(storeName[0]?.toUpperCase() || '★', cx, logoY + logoSize / 2);
      }

      // ── 8. Nombre tienda ──
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(storeName.toUpperCase(), cx, nameY);
      ctx.fillStyle = accentColor;
      ctx.fillRect(cx - 50, nameY + 12, 100, 3);
      ctx.fillStyle = '#475569';
      ctx.font = '500 17px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('¡Gracias por visitarnos!', cx, nameY + 50);
      ctx.fillStyle = '#64748b';
      ctx.font = '15px Arial';
      ctx.fillText('Tus opiniones nos ayudan a mejorar.', cx, nameY + 74);

      // ── 9. Texto principal GRATIS ──
      if (hasGiftText) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Escanea los códigos y lleva', cx, badgeY + 14);
        ctx.shadowColor = `${accentColor}99`;
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 30px Arial';
        ctx.fillText(`🎁 GRATIS ${promoGiftText.trim().toUpperCase()}`, cx, badgeY + 52);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = accentColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('↓  Escanea los códigos QR abajo  ↓', cx, badgeY + 28);
      }

      // ── 10. Imágenes de producto/premio (si hay) ──
      if (hasPromo) {
        const promoTopY = badgeY + 68;
        if (activePromo.length === 1) {
          const iw = 340;
          drawImageCover(ctx, activePromo[0], cx - iw / 2, promoTopY, iw, promoImgH, 36);
        } else {
          const iw = (W - pad * 2 - 12) / 2;
          drawImageCover(ctx, activePromo[0], pad, promoTopY, iw, promoImgH, 36);
          drawImageCover(ctx, activePromo[1], W - pad - iw, promoTopY, iw, promoImgH, 36);
        }
      }

      // ── 11. Separador sutil sobre los QR ──
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pad + 16, cardY - 10);
      ctx.lineTo(W - pad - 16, cardY - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── 12. Tarjetas QR en la parte inferior ──
      const drawQRPanel = (cardX, qrCvs, icon, title, desc) => {
        const pcx = cardX + cardW / 2;

        // Sombra + fondo blanco
        ctx.shadowColor = 'rgba(0,0,0,0.10)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

        // Borde
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        roundRect(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.stroke();

        // Barra dorada superior
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, cardX, cardY, cardW, 8, 20);
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.restore();

        // Ícono
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, pcx, cardY + 32);

        // Título
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(title, pcx, cardY + 58);

        // Línea dorada
        ctx.fillStyle = accentColor;
        ctx.fillRect(pcx - 24, cardY + 66, 48, 2);

        // QR code
        const qrX = pcx - qrSize / 2;
        const qrTop = cardY + 78;
        if (qrCvs) {
          ctx.drawImage(qrCvs, qrX, qrTop, qrSize, qrSize);
        } else {
          ctx.fillStyle = '#f1f5f9';
          roundRect(ctx, qrX, qrTop, qrSize, qrSize, 10);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Sin link', pcx, qrTop + qrSize / 2);
        }

        // "Escanea aquí"
        ctx.fillStyle = '#64748b';
        ctx.font = '600 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('▲  Escanea aquí  ▲', pcx, qrTop + qrSize + 18);

        // Descripción
        if (desc) {
          ctx.fillStyle = '#475569';
          ctx.font = 'italic 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          const maxDescW = cardW - 28;
          const words = desc.split(' ');
          let line = '';
          let y = qrTop + qrSize + 36;
          for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxDescW && line) {
              ctx.fillText(line, pcx, y); line = word; y += 15;
            } else { line = test; }
          }
          if (line) ctx.fillText(line, pcx, y);
        }
      };

      drawQRPanel(card1X, googleQrCanvas, '🌐', 'Clasificar en Google', googleQrDesc);

      // ── Separador vertical entre tarjetas ──
      ctx.save();
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cardY + 20);
      ctx.lineTo(cx, cardY + cardH - 20);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      const dmY = cardY + cardH / 2;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.translate(cx, dmY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.restore();
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('&', cx, dmY);

      drawQRPanel(card2X, idealQrCanvas, '🎯', 'Cliente Ideal', idealQrDesc);

      // ── Franja dorada inferior ──
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, 12, H - 22, W - 24, 10, 28);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.restore();

      // ── Branding ──
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Powered by SRAutomatic.cl', cx, H - 46);

      return new Promise(resolve => {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `qr-clasificacion-${selectedStore?.code || 'tienda'}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/jpeg', 0.95);
      });
    } finally {
      setDownloadingGoogle(false);
    }
  };

  // Helper: rounded rect path (uses native API when available for perfect arcs)
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Helper: draw image cropped to fill a rounded rect (cover)
  function drawImageCover(ctx, img, x, y, w, h, r) {
    if (!img) return;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    const makeRoundPath = () => {
      ctx.beginPath();
      // Use native roundRect (Chrome 99+, FF 112+, Safari 15.4+) for perfect arcs
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        roundRect(ctx, x, y, w, h, r);
      }
    };

    // Clip + draw
    ctx.save();
    makeRoundPath();
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();

    // Subtle border (drawn outside clip so it doesn't get cut)
    ctx.save();
    makeRoundPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (!selectedStore) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

  const filteredSurveysModal = surveys.filter(s => {
    const date = new Date(s.created_at);
    if (surveyDateFrom && date < new Date(surveyDateFrom)) return false;
    if (surveyDateTo && date > new Date(surveyDateTo + 'T23:59:59')) return false;
    return true;
  });

  const modalSurveyStats = SURVEY_QUESTIONS.map(q => {
    const counts = {};
    filteredSurveysModal.forEach(s => {
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc' }}>

      {/* ── Header fijo ── */}
      <div style={{ padding: '12px 24px 0', background: '#fff', borderBottom: '2px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            <FontAwesomeIcon icon={faStar} style={{ color: '#f59e0b', marginRight: 8 }} />
            Calificaciones — {selectedStore.name}
          </h1>
          <button
            onClick={() => setShowSurveyModal(true)}
            style={{
              padding: '7px 15px', borderRadius: 8, border: 'none',
              background: accentColor, color: '#fff', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 2px 8px ${accentColor}55`,
            }}
          >
            <FontAwesomeIcon icon={faChartBar} />
            Resumen Cliente Ideal
          </button>
        </div>
        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { key: 'ratings', icon: faStar, label: 'Calificaciones' },
            { key: 'survey', icon: faUsers, label: 'Cliente Ideal' },
            { key: 'clasificacion', icon: faGlobe, label: 'Clasificación' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '9px 18px', border: 'none', background: 'none',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                color: activeTab === t.key ? '#1e293b' : '#9ca3af',
                borderBottom: activeTab === t.key ? '3px solid #1e293b' : '3px solid transparent',
                marginBottom: -2, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <FontAwesomeIcon icon={t.icon} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Área de contenido scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

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
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0, padding: 0, overflow: 'hidden',
        }}>
          {/* Franja dorada superior */}
          <div style={{ width: '100%', height: 6, background: accentColor }} />

          {/* Header */}
          <div style={{ width: '100%', padding: '18px 20px 0', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              fontSize: 22, fontWeight: 900, color: '#fff',
              boxShadow: `0 4px 16px ${accentColor}55`,
            }}>
              {storeName[0]?.toUpperCase() || '★'}
            </div>
            <p style={{ color: '#1e293b', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{storeName}</p>
            <p style={{ color: accentColor, fontSize: 12, fontWeight: 700, margin: '0 0 14px', letterSpacing: 1 }}>
              CALIFICA TU EXPERIENCIA
            </p>
          </div>

          {/* QR + marco */}
          <div style={{
            background: '#f9fafb',
            borderRadius: 16,
            padding: 14,
            margin: '0 20px',
            border: '1.5px solid #e5e7eb',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <QRCodeCanvas
              id="rating-qr-canvas"
              value={ratingUrl}
              size={180}
              level="H"
              includeMargin={false}
              imageSettings={{ src: '', excavate: false }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              {EMOJIS.map(e => (
                <span key={e.label} style={{ fontSize: 20 }} title={e.label}>{e.emoji}</span>
              ))}
            </div>
          </div>

          {/* URL */}
          <p style={{ color: '#9ca3af', fontSize: 10, margin: '8px 20px 0', textAlign: 'center', wordBreak: 'break-all' }}>
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
              borderRadius: 12,
              border: `2px solid ${accentColor}`,
              background: downloading ? '#f9fafb' : accentColor,
              color: downloading ? accentColor : '#fff',
              fontWeight: 800,
              fontSize: 14,
              cursor: downloading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
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
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 0, padding: 0, overflow: 'hidden',
          }}>
            {/* Franja dorada superior */}
            <div style={{ width: '100%', height: 6, background: accentColor }} />

            <div style={{ width: '100%', padding: '18px 20px 0', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                fontSize: 22, fontWeight: 900, color: '#fff',
                boxShadow: `0 4px 16px ${accentColor}55`,
              }}>🎯</div>
              <p style={{ color: '#1e293b', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{storeName}</p>
              <p style={{ color: accentColor, fontSize: 12, fontWeight: 700, margin: '0 0 14px', letterSpacing: 1 }}>
                ENCUESTA · CLIENTE IDEAL
              </p>
            </div>

            <div style={{
              background: '#f9fafb',
              borderRadius: 16, padding: 14,
              margin: '0 20px',
              border: '1.5px solid #e5e7eb',
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

            <p style={{ color: '#9ca3af', fontSize: 10, margin: '8px 20px 20px', textAlign: 'center', wordBreak: 'break-all' }}>
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
        <div style={{ background: '#fff' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            Genera y descarga un diseño con los 2 QR para compartir con tus clientes.
          </p>
          <div style={styles.grid}>
            {/* Google QR config */}
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
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Descripción
                </label>
                <textarea
                  value={googleQrDesc}
                  onChange={e => setGoogleQrDesc(e.target.value)}
                  placeholder="Ej: Escanea y ayúdanos dejando tu reseña en Google"
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
              {googleUrl ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                    <QRCodeCanvas id="google-qr-canvas" value={googleUrl} size={240} level="H" includeMargin={false} style={{ width: '130px', height: '130px' }} />
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 80, background: '#f9fafb', borderRadius: 10, marginTop: 10,
                  border: '2px dashed #e5e7eb',
                }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Ingresa el link para ver el QR</span>
                </div>
              )}
            </div>

            {/* Cliente Ideal QR config */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <FontAwesomeIcon icon={faUsers} style={{ color: accentColor, marginRight: 8 }} />
                QR Cliente Ideal
              </h3>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Descripción
                </label>
                <textarea
                  value={idealQrDesc}
                  onChange={e => setIdealQrDesc(e.target.value)}
                  placeholder="Ej: Escanea y cuéntanos quién eres"
                  rows={2}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <QRCodeCanvas id="ideal-qr-canvas-clasi" value={surveyUrl} size={240} level="H" includeMargin={false} style={{ width: '130px', height: '130px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Promo images + gift text */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <FontAwesomeIcon icon={faImage} style={{ color: accentColor, marginRight: 8 }} />
              Producto / Premio
              <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>(máx. 2 imágenes)</span>
            </h3>

            {/* Image upload slots */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ flex: 1 }}>
                  {promoImages[i] ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={promoImages[i]}
                        alt={`Producto ${i + 1}`}
                        style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 18, border: '1.5px solid #e5e7eb', display: 'block' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPromoImages(prev => { const n = [...prev]; n[i] = null; return n; })}
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 26, height: 26, borderRadius: '50%',
                          border: 'none', background: 'rgba(0,0,0,0.55)',
                          color: '#fff', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      height: 150, borderRadius: 10, border: '2px dashed #d1d5db',
                      background: '#f9fafb', cursor: 'pointer', gap: 6,
                    }}>
                      <FontAwesomeIcon icon={faImage} style={{ fontSize: 24, color: '#d1d5db' }} />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Imagen {i + 1}</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => { if (e.target.files[0]) handlePromoImage(i, e.target.files[0]); e.target.value = ''; }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {/* Gift text */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                ¿Qué se lleva gratis?
              </label>
              <input
                type="text"
                value={promoGiftText}
                onChange={e => setPromoGiftText(e.target.value)}
                placeholder="Ej: una pizza mediana, un café, un postre…"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid #e5e7eb', fontSize: 13,
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
              {promoGiftText.trim() && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: '#fffbeb', border: '1px solid #fde68a',
                  fontSize: 13, color: '#92400e', fontWeight: 600,
                }}>
                  En la imagen: "Escanea los códigos y lleva GRATIS {promoGiftText.trim().toUpperCase()}"
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={saveClasificacion}
              disabled={clasificacionSaving}
              style={{
                marginTop: 16, width: '100%', padding: '11px',
                borderRadius: 10, border: 'none',
                background: clasificacionSaved ? '#16a34a' : accentColor,
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: clasificacionSaving ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {clasificacionSaving ? 'Guardando…' : clasificacionSaved ? '✓ Guardado' : '💾 Guardar configuración'}
            </button>
          </div>

          {/* Preview + download */}
          <div style={{ ...styles.card, marginTop: 0, background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: 16, color: '#0f172a' }}>
              Vista previa del diseño
            </h3>

            {/* Combined preview card */}
            <div style={{
              background: '#fff',
              border: `2px solid ${accentColor}`,
              borderRadius: 18,
              overflow: 'hidden',
              marginBottom: 18,
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            }}>
              {/* Franja dorada */}
              <div style={{ height: 6, background: accentColor }} />

              {/* Header */}
              <div style={{ textAlign: 'center', padding: '18px 16px 12px' }}>
                {selectedStore?.logo_url ? (
                  <img
                    src={selectedStore.logo_url}
                    alt={storeName}
                    style={{
                      width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                      border: `3px solid ${accentColor}`, display: 'block', margin: '0 auto 8px',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: accentColor,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8,
                  }}>
                    {storeName[0]?.toUpperCase() || '★'}
                  </div>
                )}
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: 0.5 }}>
                  {storeName.toUpperCase()}
                </p>
                <div style={{ height: 2, background: accentColor, borderRadius: 2, margin: '0 auto', width: 48 }} />
              </div>

              {/* QR panels */}
              <div style={{ display: 'flex', gap: 0, padding: '8px 16px 20px' }}>
                {/* Google QR */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: '#f8fafc', borderRadius: 12, padding: '14px 10px',
                  border: '1px solid #e2e8f0', margin: '0 6px 0 0',
                }}>
                  <span style={{ fontSize: 16 }}>🌐</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Clasificar en Google</span>
                  <div style={{ height: 1.5, background: accentColor, width: 32, borderRadius: 2 }} />
                  <div style={{
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8,
                    padding: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    {googleUrl
                      ? <QRCodeCanvas value={googleUrl} size={100} level="H" includeMargin={false} />
                      : <div style={{
                          width: 100, height: 100, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#cbd5e1', fontSize: 11, textAlign: 'center',
                        }}>Sin link</div>
                    }
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>▲ Escanea aquí ▲</span>
                  {googleQrDesc && (
                    <span style={{ fontSize: 10, color: '#475569', textAlign: 'center', maxWidth: 140, lineHeight: 1.4 }}>{googleQrDesc}</span>
                  )}
                </div>

                {/* Separador */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', gap: 4,
                }}>
                  <div style={{ flex: 1, width: 1, background: '#e2e8f0' }} />
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, background: '#fff',
                    border: `1.5px solid ${accentColor}`, transform: 'rotate(45deg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }} />
                  <div style={{ flex: 1, width: 1, background: '#e2e8f0' }} />
                </div>

                {/* Ideal QR */}
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: '#f8fafc', borderRadius: 12, padding: '14px 10px',
                  border: '1px solid #e2e8f0', margin: '0 0 0 6px',
                }}>
                  <span style={{ fontSize: 16 }}>🎯</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Cliente Ideal</span>
                  <div style={{ height: 1.5, background: accentColor, width: 32, borderRadius: 2 }} />
                  <div style={{
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8,
                    padding: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                    <QRCodeCanvas value={surveyUrl} size={100} level="H" includeMargin={false} />
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>▲ Escanea aquí ▲</span>
                  {idealQrDesc && (
                    <span style={{ fontSize: 10, color: '#475569', textAlign: 'center', maxWidth: 140, lineHeight: 1.4 }}>{idealQrDesc}</span>
                  )}
                </div>
              </div>

              {/* Franja dorada inferior */}
              <div style={{ height: 5, background: accentColor }} />
            </div>

            <button
              onClick={downloadCombinedQR}
              disabled={downloadingGoogle}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: downloadingGoogle ? '#e2e8f0' : accentColor,
                color: downloadingGoogle ? '#94a3b8' : '#fff',
                fontWeight: 700, fontSize: 14,
                cursor: downloadingGoogle ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: downloadingGoogle ? 'none' : `0 4px 14px ${accentColor}55`,
                transition: 'all 0.2s',
              }}
            >
              <FontAwesomeIcon icon={faDownload} />
              {downloadingGoogle ? 'Generando imagen...' : 'Descargar diseño completo (.jpg)'}
            </button>
          </div>
        </div>
      )}

      </div>{/* fin scrollable */}

      {/* ── Modal Resumen Cliente Ideal ── */}
      {showSurveyModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowSurveyModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 660, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
                  <FontAwesomeIcon icon={faUsers} style={{ color: accentColor, marginRight: 8 }} />
                  Resumen Cliente Ideal
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {filteredSurveysModal.length} respuesta{filteredSurveysModal.length !== 1 ? 's' : ''}
                  {(surveyDateFrom || surveyDateTo) ? ' en el rango seleccionado' : ' en total'}
                </p>
              </div>
              <button
                onClick={() => setShowSurveyModal(false)}
                style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid #e5e7eb', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6b7280' }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* Filtros de fecha */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <FontAwesomeIcon icon={faCalendarAlt} style={{ color: accentColor, fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Filtrar por fecha:</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Desde</span>
                  <input
                    type="date"
                    value={surveyDateFrom}
                    onChange={e => setSurveyDateFrom(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: 12, outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Hasta</span>
                  <input
                    type="date"
                    value={surveyDateTo}
                    onChange={e => setSurveyDateTo(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: 12, outline: 'none' }}
                  />
                </div>
                {(surveyDateFrom || surveyDateTo) && (
                  <button
                    onClick={() => { setSurveyDateFrom(''); setSurveyDateTo(''); }}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Contenido scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {surveyLoading ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>Cargando...</p>
              ) : filteredSurveysModal.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                  <FontAwesomeIcon icon={faUsers} style={{ fontSize: 32, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ margin: 0 }}>Sin respuestas en este rango de fechas.</p>
                </div>
              ) : (
                modalSurveyStats.map(q => q.total > 0 && (
                  <div key={q.key} style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 8px', display: 'flex', justifyContent: 'space-between' }}>
                      {q.label}
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>{q.total} resp.</span>
                    </p>
                    {q.sorted.slice(0, 5).map(([opt, count]) => {
                      const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0;
                      return (
                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: '#475569', minWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt}</span>
                          <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: accentColor, borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                          <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 24 }}>({count})</span>
                        </div>
                      );
                    })}
                    <div style={{ height: 1, background: '#f1f5f9', marginTop: 12 }} />
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  page: { padding: '20px 24px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title: { fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 },
  card: { background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 14, marginTop: 0 },
  filterRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  filterBtn: { padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', lineHeight: '20px' },
  ratingItem: { display: 'flex', alignItems: 'flex-start', gap: 14, background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  tag: { fontSize: 11, color: '#6b7280', background: '#f1f5f9', borderRadius: 6, padding: '2px 7px' },
  empty: { textAlign: 'center', padding: '48px 24px', color: '#6b7280', fontSize: 15 },
};
