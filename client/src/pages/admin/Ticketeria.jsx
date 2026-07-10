import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faSave, faTimes, faTicketAlt,
  faCalendarAlt, faClock, faMapMarkerAlt, faUsers, faQrcode,
  faCheckCircle, faTimesCircle, faSpinner, faTag, faSyncAlt,
  faChevronDown, faChevronUp, faDollarSign, faImage, faUpload,
  faFilter, faSearch, faGlobe, faMusic, faToggleOn, faToggleOff
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi3.srautomatic.com';
const GOLD = '#C8A415';

const CATEGORY_PRESETS = ['Adulto', 'Niño', 'Adulto Mayor', 'Estudiante', 'VIP', 'General'];

/* ── Estilos comunes ── */
const card = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const inputS = { width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelS = { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' };
const btnPrimary = { padding: '8px 16px', background: GOLD, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const iconBtn = { background: 'transparent', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6 };

function EventForm({ event, onSave, onCancel, token, filterConfig }) {
  const [form, setForm] = useState({
    name: event?.name || '',
    description: event?.description || '',
    event_date: event?.event_date ? event.event_date.slice(0, 10) : '',
    time_start: event?.time_start ? event.time_start.slice(0, 5) : '',
    time_end: event?.time_end ? event.time_end.slice(0, 5) : '',
    location: event?.location || '',
    max_capacity: event?.max_capacity || '',
    status: event?.status || 'active',
    image_url: event?.image_url || '',
    genre: event?.genre || '',
    country: event?.country || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
      const data = await res.json();
      if (data.url) set('image_url', `${API}${data.url}`);
    } catch { alert('Error subiendo imagen'); }
    finally { setUploadingImg(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input required placeholder="Nombre del evento *" value={form.name} onChange={e => set('name', e.target.value)} style={inputS} />
      <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => set('description', e.target.value)}
        style={{ ...inputS, minHeight: 70, resize: 'vertical' }} />

      {/* Imagen */}
      <div>
        <label style={labelS}>Imagen del evento</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
            background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8,
            cursor: uploadingImg ? 'wait' : 'pointer', fontSize: 13, color: '#374151', fontWeight: 600, whiteSpace: 'nowrap'
          }}>
            {uploadingImg ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
            {uploadingImg ? 'Subiendo...' : 'Subir imagen'}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImg} />
          </label>
          {form.image_url && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={form.image_url} alt="preview" style={{ height: 60, borderRadius: 8, border: '1px solid #e5e7eb', objectFit: 'cover', maxWidth: 120 }} />
              <button type="button" onClick={() => set('image_url', '')}
                style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>
          )}
          {!form.image_url && (
            <div style={{ flex: 1 }}>
              <input placeholder="O pega una URL de imagen" value={form.image_url} onChange={e => set('image_url', e.target.value)} style={{ ...inputS, fontSize: 13 }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelS}>Fecha *</label>
          <input required type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Hora inicio *</label>
          <input required type="time" value={form.time_start} onChange={e => set('time_start', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Hora fin</label>
          <input type="time" value={form.time_end} onChange={e => set('time_end', e.target.value)} style={inputS} />
        </div>
      </div>
      <input placeholder="Lugar / Dirección" value={form.location} onChange={e => set('location', e.target.value)} style={inputS} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelS}>Género / Tipo</label>
          <input list="genre-opts" placeholder="Ej: Concierto, Teatro…" value={form.genre} onChange={e => set('genre', e.target.value)} style={inputS} />
          {filterConfig?.genres?.length > 0 && <datalist id="genre-opts">{filterConfig.genres.map(g => <option key={g} value={g} />)}</datalist>}
        </div>
        <div>
          <label style={labelS}>País</label>
          <input list="country-opts" placeholder="Ej: Chile, Argentina…" value={form.country} onChange={e => set('country', e.target.value)} style={inputS} />
          {filterConfig?.countries?.length > 0 && <datalist id="country-opts">{filterConfig.countries.map(c => <option key={c} value={c} />)}</datalist>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelS}>Capacidad máxima (opcional)</label>
          <input type="number" min="1" placeholder="Sin límite" value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={inputS}>
            <option value="active">Activo</option>
            <option value="finished">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
        <button type="submit" disabled={saving || uploadingImg} style={btnPrimary}>
          {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Guardar
        </button>
      </div>
    </form>
  );
}

function CategoryForm({ cat, onSave, onCancel }) {
  const [form, setForm] = useState({ name: cat?.name || '', description: cat?.description || '', price: cat?.price ?? '', max_qty: cat?.max_qty || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
      background: '#fffbeb', padding: '12px 14px', borderRadius: 8, marginBottom: 8,
      border: `1px solid ${GOLD}40`
    }}>
      <div style={{ flex: '0 0 auto', minWidth: 140 }}>
        <label style={labelS}>Categoría *</label>
        <input list="cat-presets" required value={form.name} onChange={e => set('name', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Ej: Adulto" />
        <datalist id="cat-presets">{CATEGORY_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 130 }}>
        <label style={labelS}>Descripción</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Opcional" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 100 }}>
        <label style={labelS}>Precio (CLP) *</label>
        <input required type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="0 = Gratis" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 90 }}>
        <label style={labelS}>Cupos máx.</label>
        <input type="number" min="1" value={form.max_qty} onChange={e => set('max_qty', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Sin límite" />
      </div>
      <button type="submit" disabled={saving} style={{ ...btnPrimary, height: 36, padding: '0 14px' }}>
        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
      </button>
      <button type="button" onClick={onCancel} style={{ ...btnSecondary, height: 36, padding: '0 14px' }}>
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </form>
  );
}

function ScannerTab({ token }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const extractCode = (raw) => {
    const m = raw.trim().match(/\/ticket\/([A-Z0-9]{7})(?:\?.*)?$/i);
    return m ? m[1].toUpperCase() : raw.trim().toUpperCase();
  };

  const scan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    const rawCode = extractCode(code);
    try {
      const res = await fetch(`${API}/api/ticketeria/public/ticket/${rawCode}`);
      const data = await res.json();
      if (!res.ok) { setResult({ ok: false, error: data.error || 'No encontrado' }); return; }
      setResult({ ok: true, purchase: data, code: rawCode });
    } catch {
      setResult({ ok: false, error: 'Error de red' });
    } finally {
      setLoading(false);
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const admit = async () => {
    if (!result?.code) return;
    setAdmitting(true);
    try {
      const res = await fetch(`${API}/api/ticketeria/admit/${result.code}`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setResult(r => ({ ...r, purchase: { ...r.purchase, admitted: 1, admitted_at: new Date().toISOString() } }));
    } catch { alert('Error de red'); }
    finally { setAdmitting(false); }
  };

  const p = result?.purchase;
  const isAdmitted = !!p?.admitted;
  const totalTickets = p?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  const formatDate = (raw) => {
    if (!raw) return '';
    const s = typeof raw === 'string' ? raw : String(raw);
    return new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 10 }}>
      <h3 style={{ color: '#111', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
        <FontAwesomeIcon icon={faQrcode} style={{ marginRight: 8, color: GOLD }} />Escáner de Entradas
      </h3>
      <form onSubmit={scan} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input ref={inputRef} value={code} onChange={e => setCode(e.target.value)}
          placeholder="Escanea el QR o escribe el código (7 caracteres)"
          style={{ ...inputS, flex: 1, fontFamily: 'monospace', fontSize: 15, letterSpacing: 2 }} />
        <button type="submit" disabled={loading} style={btnPrimary}>
          {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Buscar'}
        </button>
      </form>

      {result && !result.ok && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#dc2626', fontSize: 20 }} />
          <span style={{ fontWeight: 700, color: '#dc2626' }}>❌ {result.error}</span>
        </div>
      )}

      {result?.ok && p && (
        <div style={{ background: '#fff', borderRadius: 14, border: `2px solid ${isAdmitted ? '#fca5a5' : '#86efac'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          {/* Estado */}
          <div style={{ padding: '14px 18px', background: isAdmitted ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={isAdmitted ? faTimesCircle : faCheckCircle}
              style={{ color: isAdmitted ? '#dc2626' : '#16a34a', fontSize: 22 }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: isAdmitted ? '#dc2626' : '#16a34a' }}>
                {isAdmitted ? 'ENTRADA YA UTILIZADA' : 'ENTRADA VÁLIDA'}
              </div>
              {isAdmitted && p.admitted_at && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Admitida el {new Date(p.admitted_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 4 }}>{p.event_name}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>📅 {formatDate(p.event_date)}{p.time_start ? ` · ⏰ ${String(p.time_start).slice(0,5)}` : ''}{p.location ? ` · 📍 ${p.location}` : ''}</div>
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>👤 <strong>{p.buyer_name}</strong> — {p.buyer_email}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {(p.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 14 }}>
                  <span style={{ fontWeight: 600, color: '#111' }}>{item.category_name}</span>
                  <span style={{ color: '#374151' }}>{item.quantity} persona{item.quantity !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#fffbeb', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                <span style={{ color: '#111' }}>Total</span>
                <span style={{ color: GOLD }}>{totalTickets} persona{totalTickets !== 1 ? 's' : ''} · {p.total_amount === 0 ? 'Gratis' : `$${Number(p.total_amount).toLocaleString('es-CL')}`}</span>
              </div>
            </div>

            {!isAdmitted && (
              <button onClick={admit} disabled={admitting} style={{ width: '100%', padding: '12px', background: '#16a34a', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {admitting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
                {admitting ? 'Procesando...' : `Admitir ${totalTickets} persona${totalTickets !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FiltersTab({ storeId, token }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  const [newCountry, setNewCountry] = useState('');

  useEffect(() => {
    if (!storeId) return;
    fetch(`${API}/api/ticketeria/filter-config?store_id=${storeId}`)
      .then(r => r.json())
      .then(d => setCfg({ show_search:1, show_genre:1, show_country:0, show_price:1, show_date:1, genres:[], countries:[], ...d }))
      .catch(() => {});
  }, [storeId]);

  if (!cfg) return <div style={{ padding: 20, color: '#888', textAlign: 'center' }}><FontAwesomeIcon icon={faSpinner} spin /></div>;

  const toggle = (k) => setCfg(c => ({ ...c, [k]: c[k] ? 0 : 1 }));
  const addTag = (field, val, setter) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setCfg(c => ({ ...c, [field]: [...(c[field] || []).filter(x => x !== trimmed), trimmed] }));
    setter('');
  };
  const removeTag = (field, val) => setCfg(c => ({ ...c, [field]: (c[field] || []).filter(x => x !== val) }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/ticketeria/filter-config`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, ...cfg })
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const filters = [
    { key: 'show_search',  label: 'Búsqueda por nombre', desc: 'Teclado virtual para buscar eventos' },
    { key: 'show_genre',   label: 'Filtro por género',   desc: 'Chips: Concierto, Teatro, etc.' },
    { key: 'show_country', label: 'Filtro por país',     desc: 'Chips: Chile, Argentina, etc.' },
    { key: 'show_price',   label: 'Filtro por precio',   desc: 'Rango: Gratis / Bajo / Medio / Alto' },
    { key: 'show_date',    label: 'Filtro por fecha',    desc: 'Hoy / Esta semana / Este mes' },
  ];

  return (
    <div style={{ maxWidth: 600 }}>
      <h3 style={{ color: '#111', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Filtros visibles en el tótem</h3>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Elige qué filtros puede usar el cliente al comprar entradas en el tótem.</p>

      {/* Toggles */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
        {filters.map((f, i) => (
          <div key={f.key} onClick={() => toggle(f.key)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i < filters.length-1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{f.label}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{f.desc}</div>
            </div>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: cfg[f.key] ? GOLD : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: cfg[f.key] ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .2s' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Géneros */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 10 }}>Géneros disponibles</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {(cfg.genres || []).map(g => (
            <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fffbeb', border: `1px solid ${GOLD}50`, borderRadius: 20, fontSize: 13, color: '#111' }}>
              {g}
              <button onClick={() => removeTag('genres', g)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {(cfg.genres || []).length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Sin géneros configurados</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Agregar género (ej: Concierto)" value={newGenre} onChange={e => setNewGenre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag('genres', newGenre, setNewGenre); }}
            style={{ ...inputS, flex: 1, fontSize: 13 }} />
          <button onClick={() => addTag('genres', newGenre, setNewGenre)} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 13 }}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
      </div>

      {/* Países */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 10 }}>Países disponibles</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {(cfg.countries || []).map(c => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 20, fontSize: 13, color: '#111' }}>
              {c}
              <button onClick={() => removeTag('countries', c)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {(cfg.countries || []).length === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>Sin países configurados</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Agregar país (ej: Chile)" value={newCountry} onChange={e => setNewCountry(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag('countries', newCountry, setNewCountry); }}
            style={{ ...inputS, flex: 1, fontSize: 13 }} />
          <button onClick={() => addTag('countries', newCountry, setNewCountry)} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 13 }}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ ...btnPrimary, minWidth: 140 }}>
        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : saved ? <FontAwesomeIcon icon={faCheckCircle} /> : <FontAwesomeIcon icon={faSave} />}
        {saved ? 'Guardado' : 'Guardar filtros'}
      </button>
    </div>
  );
}

export default function Ticketeria() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [categories, setCategories] = useState({});
  const [addingCatFor, setAddingCatFor] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [filterEvent, setFilterEvent] = useState('');
  const [filterConfig, setFilterConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (storeId) {
      loadEvents();
      fetch(`${API}/api/ticketeria/filter-config?store_id=${storeId}`)
        .then(r => r.json()).then(d => setFilterConfig(d)).catch(() => {});
    }
  }, [storeId]);

  const loadEvents = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ticketeria/events?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch { setError('Error cargando eventos'); }
    finally { setLoading(false); }
  };

  const loadCategories = async (eventId) => {
    try {
      const res = await fetch(`${API}/api/ticketeria/events/${eventId}/categories`, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setCategories(prev => ({ ...prev, [eventId]: Array.isArray(data) ? data : [] }));
    } catch {}
  };

  const loadPurchases = async () => {
    if (!storeId) return;
    setPurchasesLoading(true);
    try {
      const url = filterEvent
        ? `${API}/api/ticketeria/purchases?store_id=${storeId}&event_id=${filterEvent}`
        : `${API}/api/ticketeria/purchases?store_id=${storeId}`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch { setError('Error cargando compras'); }
    finally { setPurchasesLoading(false); }
  };

  useEffect(() => { if (tab === 'purchases') loadPurchases(); }, [tab, filterEvent, storeId]);

  const handleSaveEvent = async (form) => {
    setError('');
    const method = editingEvent ? 'PUT' : 'POST';
    const url = editingEvent ? `${API}/api/ticketeria/events/${editingEvent.id}` : `${API}/api/ticketeria/events`;
    const body = editingEvent ? form : { ...form, store_id: storeId };
    const res = await fetch(url, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Error guardando'); return; }
    setShowEventForm(false);
    setEditingEvent(null);
    loadEvents();
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('¿Eliminar este evento y todas sus entradas?')) return;
    const res = await fetch(`${API}/api/ticketeria/events/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    if (res.ok) loadEvents();
  };

  const toggleExpand = async (eventId) => {
    if (expandedEvent === eventId) { setExpandedEvent(null); return; }
    setExpandedEvent(eventId);
    if (!categories[eventId]) await loadCategories(eventId);
  };

  const handleSaveCategory = async (form) => {
    setError('');
    if (editingCat) {
      const res = await fetch(`${API}/api/ticketeria/categories/${editingCat.id}`, {
        method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
      setEditingCat(null);
      loadCategories(expandedEvent);
    } else {
      const res = await fetch(`${API}/api/ticketeria/events/${addingCatFor}/categories`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
      const prev = addingCatFor;
      setAddingCatFor(null);
      loadCategories(prev);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await fetch(`${API}/api/ticketeria/categories/${catId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    loadCategories(expandedEvent);
  };

  const publicUrl = selectedStore ? `${window.location.origin}/tickets/${selectedStore.code}` : '';

  const statusBadge = (status) => ({
    active:    { bg: '#f0fdf4', color: '#16a34a', label: 'Activo' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelado' },
    finished:  { bg: '#f3f4f6', color: '#6b7280', label: 'Finalizado' },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status });

  const purchaseStatusBadge = (status) => ({
    paid:      { bg: '#f0fdf4', color: '#16a34a', label: 'Pagado' },
    pending:   { bg: '#fffbeb', color: '#d97706', label: 'Pendiente' },
    failed:    { bg: '#fef2f2', color: '#dc2626', label: 'Fallido' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelado' },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status });

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: '#111', display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }}>
            <FontAwesomeIcon icon={faTicketAlt} style={{ color: GOLD }} /> Ticketería
          </h2>
          {selectedStore && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
              URL pública:{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: GOLD, fontWeight: 600 }}>{publicUrl}</a>
            </div>
          )}
        </div>
        {tab === 'events' && (
          <button onClick={() => { setShowEventForm(true); setEditingEvent(null); }} style={btnPrimary}>
            <FontAwesomeIcon icon={faPlus} /> Nuevo Evento
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['events', faCalendarAlt, 'Eventos'], ['purchases', faUsers, 'Compras'], ['scanner', faQrcode, 'Escáner'], ['filters', faFilter, 'Filtros']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 8, border: tab === key ? 'none' : '1px solid #e5e7eb',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === key ? GOLD : '#fff',
            color: tab === key ? '#fff' : '#374151',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: tab === key ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <FontAwesomeIcon icon={icon} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── EVENTOS ── */}
      {tab === 'events' && (
        <div>
          {(showEventForm || editingEvent) && (
            <div style={{ ...card, border: `1px solid ${GOLD}50`, background: '#fffbeb' }}>
              <h3 style={{ margin: '0 0 14px', color: '#111', fontSize: 15, fontWeight: 700 }}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <EventForm event={editingEvent} token={token} filterConfig={filterConfig} onSave={handleSaveEvent} onCancel={() => { setShowEventForm(false); setEditingEvent(null); }} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><FontAwesomeIcon icon={faSpinner} spin /> Cargando...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 40, marginBottom: 12, display: 'block', color: '#d1d5db' }} />
              No hay eventos. Crea el primero.
            </div>
          ) : events.map(ev => {
            const badge = statusBadge(ev.status);
            const isOpen = expandedEvent === ev.id;
            const catList = categories[ev.id] || [];
            return (
              <div key={ev.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                {/* Imagen del evento si existe */}
                {ev.image_url && (
                  <img src={ev.image_url} alt={ev.name} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                )}

                {/* Info principal */}
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{ev.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
                        <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 4, color: GOLD }} />
                          {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 4, color: GOLD }} />{ev.time_start?.slice(0, 5)}{ev.time_end ? ` – ${ev.time_end.slice(0, 5)}` : ''}</span>
                        {ev.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 4, color: GOLD }} />{ev.location}</span>}
                        <span><FontAwesomeIcon icon={faUsers} style={{ marginRight: 4, color: GOLD }} />{ev.sold_count} vendidas{ev.max_capacity ? ` / ${ev.max_capacity}` : ''}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditingEvent(ev); setShowEventForm(false); }} style={iconBtn} title="Editar evento"><FontAwesomeIcon icon={faEdit} /></button>
                      <button onClick={() => handleDeleteEvent(ev.id)} style={{ ...iconBtn, color: '#ef4444' }} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </div>

                  {/* Botón Precios — siempre visible */}
                  <button
                    onClick={() => toggleExpand(ev.id)}
                    style={{
                      marginTop: 12, width: '100%', padding: '9px 14px',
                      background: isOpen ? '#fffbeb' : '#f9fafb',
                      border: `1px solid ${isOpen ? GOLD + '60' : '#e5e7eb'}`,
                      borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: '#374151', fontSize: 13, fontWeight: 600
                    }}
                  >
                    <span>
                      <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: 7, color: GOLD }} />
                      Precios por categoría
                      {catList.length > 0 && (
                        <span style={{ marginLeft: 8, background: GOLD, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                          {catList.length}
                        </span>
                      )}
                    </span>
                    <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} style={{ color: '#9ca3af', fontSize: 11 }} />
                  </button>
                </div>

                {/* Panel de categorías */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${GOLD}30`, padding: '14px 18px', background: '#fffbeb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                        <FontAwesomeIcon icon={faTag} style={{ marginRight: 6, color: GOLD }} />Adulto · Niño · Adulto Mayor · etc.
                      </span>
                      <button onClick={() => { setAddingCatFor(ev.id); setEditingCat(null); }} style={{ ...btnPrimary, fontSize: 12, padding: '5px 12px' }}>
                        <FontAwesomeIcon icon={faPlus} /> Nueva categoría
                      </button>
                    </div>

                    {addingCatFor === ev.id && (
                      <CategoryForm onSave={handleSaveCategory} onCancel={() => setAddingCatFor(null)} />
                    )}
                    {editingCat && editingCat.event_id === ev.id && (
                      <CategoryForm cat={editingCat} onSave={handleSaveCategory} onCancel={() => setEditingCat(null)} />
                    )}

                    {catList.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0', textAlign: 'center' }}>
                        Aún no hay categorías. Haz clic en "Nueva categoría" para agregar Adulto, Niño, Adulto Mayor, etc.
                      </div>
                    ) : catList.map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fff', borderRadius: 8, marginBottom: 6, border: '1px solid #e5e7eb' }}>
                        <FontAwesomeIcon icon={faTag} style={{ color: GOLD, fontSize: 12, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{cat.name}</span>
                          {cat.description && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{cat.description}</span>}
                        </div>
                        <span style={{ fontWeight: 800, color: GOLD, fontSize: 16, minWidth: 80, textAlign: 'right' }}>
                          {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
                        </span>
                        {cat.max_qty && <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>Máx {cat.max_qty}</span>}
                        <button onClick={() => { setEditingCat({ ...cat, event_id: ev.id }); setAddingCatFor(null); }} style={iconBtn} title="Editar precio"><FontAwesomeIcon icon={faEdit} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} style={{ ...iconBtn, color: '#ef4444' }} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMPRAS ── */}
      {tab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ ...inputS, maxWidth: 260, fontSize: 13 }}>
              <option value="">Todos los eventos</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <button onClick={loadPurchases} style={btnSecondary}>
              <FontAwesomeIcon icon={faSyncAlt} /> Actualizar
            </button>
          </div>

          {purchasesLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><FontAwesomeIcon icon={faSpinner} spin /></div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No hay compras registradas.</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Comprador', 'Evento', 'Total', 'Estado', 'Fecha', 'Referencia'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: '#6b7280', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const badge = purchaseStatusBadge(p.status);
                    return (
                      <tr key={p.id} style={{ borderBottom: i < purchases.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: '#111' }}>{p.buyer_name}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{p.buyer_email}</div>
                          {p.buyer_phone && <div style={{ color: '#9ca3af', fontSize: 11 }}>{p.buyer_phone}</div>}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#374151', verticalAlign: 'top' }}>{p.event_name}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: GOLD, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          ${p.total_amount.toLocaleString('es-CL')}
                        </td>
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <span style={{ padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#6b7280', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {new Date(p.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', verticalAlign: 'top' }}>{p.haulmer_reference}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ESCÁNER ── */}
      {tab === 'scanner' && <ScannerTab token={token} />}

      {/* ── FILTROS ── */}
      {tab === 'filters' && <FiltersTab storeId={storeId} token={token} />}
    </div>
  );
}
