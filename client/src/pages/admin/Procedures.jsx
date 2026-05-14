import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList, faPlus, faEdit, faTrash, faBrain,
  faImage, faSave, faTimes, faChevronUp, faChevronDown,
  faSpinner, faArrowLeft, faLightbulb, faGripLines,
  faEye, faEyeSlash, faCheck
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const emptyStep = () => ({ title: '', instruction: '', tip: '', image_url: '' });

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : API + url;
}

/* ── Zona de imagen de un paso ── */
function ImageZone({ stepIdx, imageUrl, uploading, onUpload, onClear }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(stepIdx, file);
  };

  if (imageUrl) {
    return (
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
        <img src={imgSrc(imageUrl)} alt="paso"
          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
        <button onClick={onClear}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 8,
            color: '#fff', width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13
          }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        marginTop: 12, borderRadius: 12, border: `2px dashed ${dragging ? GOLD : '#d1d5db'}`,
        background: dragging ? '#fffdf0' : '#f9fafb',
        padding: '22px 16px', textAlign: 'center', cursor: 'pointer',
        transition: 'all 0.15s'
      }}
    >
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => onUpload(stepIdx, e.target.files[0])} />
      {uploading ? (
        <div style={{ color: '#888', fontSize: 13 }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7, color: GOLD }} />
          Subiendo imagen...
        </div>
      ) : (
        <>
          <FontAwesomeIcon icon={faImage} style={{ fontSize: 24, color: '#d1d5db', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Haz clic o arrastra una imagen</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>PNG, JPG, WEBP</div>
        </>
      )}
    </div>
  );
}

/* ── Card de un paso en el editor ── */
function StepCard({ step, index, total, onChange, onMove, onRemove, onUpload, uploadingStep }) {
  const [showTip, setShowTip] = useState(!!step.tip);

  const field = (label, key, multiline = false, placeholder = '') => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={step[key]}
          onChange={e => onChange(index, key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
            borderRadius: 9, fontSize: 14, outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
            transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = GOLD}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      ) : (
        <input
          type="text"
          value={step[key]}
          onChange={e => onChange(index, key, e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
            borderRadius: 9, fontSize: 14, outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = GOLD}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      )}
    </div>
  );

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1.5px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden'
    }}>
      {/* Cabecera del paso */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', background: '#f9fafb',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: GOLD, color: '#000', fontWeight: 900,
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          {index + 1}
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#374151', flex: 1 }}>
          Paso {index + 1}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <FontAwesomeIcon icon={faChevronUp} />
          </button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: index === total - 1 ? 'default' : 'pointer', color: index === total - 1 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {total > 1 && (
            <button onClick={() => onRemove(index)}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido del paso */}
      <div style={{ padding: '18px 18px 14px' }}>
        {field('Título del paso', 'title', false, 'Ej: Preparar los ingredientes')}
        {field('Instrucción', 'instruction', true, 'Describe exactamente qué debe hacer el trabajador en este paso...')}

        {/* Imagen */}
        <ImageZone
          stepIdx={index}
          imageUrl={step.image_url}
          uploading={uploadingStep === index}
          onUpload={onUpload}
          onClear={() => onChange(index, 'image_url', '')}
        />

        {/* Consejo (toggle) */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowTip(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: showTip ? '#92400e' : '#9ca3af',
              fontWeight: 600, padding: 0
            }}
          >
            <FontAwesomeIcon icon={faLightbulb} style={{ color: showTip ? GOLD : '#d1d5db' }} />
            {showTip ? 'Ocultar consejo' : 'Agregar consejo (opcional)'}
          </button>
          {showTip && (
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                value={step.tip}
                onChange={e => onChange(index, 'tip', e.target.value)}
                placeholder="Ej: Asegúrate de que la plancha esté bien caliente"
                style={{
                  width: '100%', padding: '9px 12px', border: '1.5px solid #fde68a',
                  borderRadius: 9, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box', background: '#fffdf0'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export default function Procedures() {
  const { selectedStore } = useStore() || {};
  const { token } = useAuth();

  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', steps: [emptyStep()] });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProduct, setGenProduct] = useState('');
  const [genContext, setGenContext] = useState('');
  const [uploadingStep, setUploadingStep] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const storeId = selectedStore?.id;

  const load = async () => {
    if (!storeId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/procedures?store_id=${storeId}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) setProcedures(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [storeId, token]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', steps: [emptyStep()] });
    setGenProduct(''); setGenContext('');
    setPreviewMode(false); setSaveOk(false);
    setView('editor');
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({ title: proc.title, steps: proc.steps.length ? proc.steps : [emptyStep()] });
    setGenProduct(''); setGenContext('');
    setPreviewMode(false); setSaveOk(false);
    setView('editor');
  };

  const backToList = () => { setView('list'); setEditing(null); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `${API}/api/procedures/${editing.id}` : `${API}/api/procedures`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...form, store_id: storeId })
      });
      if (res.ok) {
        setSaveOk(true);
        await load();
        setTimeout(() => { setSaveOk(false); backToList(); }, 900);
      }
    } finally { setSaving(false); }
  };

  const deleteProcedure = async (id) => {
    if (!confirm('¿Eliminar este procedimiento?')) return;
    await fetch(`${API}/api/procedures/${id}?store_id=${storeId}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
    });
    load();
  };

  const generateWithAI = async () => {
    if (!genProduct.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/brain/generate-procedure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: storeId, product_name: genProduct, extra_context: genContext })
      });
      const data = await res.json();
      if (res.ok && data.steps) {
        setForm(prev => ({
          ...prev,
          title: data.title || `Procedimiento: ${genProduct}`,
          steps: data.steps.map(s => ({ title: s.title || '', instruction: s.instruction || '', tip: s.tip || '', image_url: '' }))
        }));
        setGenProduct(''); setGenContext('');
      } else {
        alert('León IA no disponible. Puedes crear los pasos manualmente.');
      }
    } finally { setGenerating(false); }
  };

  const updateStep = (i, field, value) => {
    setForm(prev => {
      const steps = [...prev.steps];
      steps[i] = { ...steps[i], [field]: value };
      return { ...prev, steps };
    });
  };

  const addStep = () => setForm(prev => ({ ...prev, steps: [...prev.steps, emptyStep()] }));

  const removeStep = (i) => setForm(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }));

  const moveStep = (i, dir) => {
    setForm(prev => {
      const steps = [...prev.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return prev;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...prev, steps };
    });
  };

  const uploadImage = async (stepIdx, file) => {
    if (!file) return;
    setUploadingStep(stepIdx);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('store_id', storeId);
      const res = await fetch(`${API}/api/upload`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
      });
      if (res.ok) {
        const data = await res.json();
        updateStep(stepIdx, 'image_url', data.url || data.path || data.file || '');
      }
    } finally { setUploadingStep(null); }
  };

  /* ── Vista lista ── */
  if (loading) return <div className="loading">Cargando procedimientos...</div>;

  if (view === 'list') {
    return (
      <>
        <header className="admin-header">
          <div>
            <h1>Procedimientos</h1>
            <p className="text-sm text-muted">Guías paso a paso para tus trabajadores</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            <FontAwesomeIcon icon={faPlus} /> Nueva guía
          </button>
        </header>

        <div className="admin-main">
          {procedures.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0'
            }}>
              <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 40, color: '#d1d5db', marginBottom: 14, display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', marginBottom: 6 }}>Sin guías todavía</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>
                Crea guías paso a paso para que tus trabajadores sepan exactamente cómo preparar cada producto.
              </div>
              <button className="btn btn-primary" onClick={openNew}>
                <FontAwesomeIcon icon={faPlus} /> Crear primera guía
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {procedures.map(proc => (
                <div key={proc.id} style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ padding: '18px 18px 14px', flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>
                      {proc.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(proc.steps || []).slice(0, 3).map((s, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '2px 9px', borderRadius: 20,
                          background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb'
                        }}>
                          {i + 1}. {s.title || s.instruction?.slice(0, 22) || 'Paso'}
                        </span>
                      ))}
                      {proc.steps?.length > 3 && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>+{proc.steps.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '10px 18px', borderTop: '1px solid #f5f5f5', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(proc)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#374151' }}>
                      <FontAwesomeIcon icon={faEdit} /> Editar
                    </button>
                    <button onClick={() => deleteProcedure(proc.id)}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 12, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── Vista editor (página completa) ── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Barra superior del editor */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14
      }}>
        <button onClick={backToList}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 600, fontSize: 13, padding: 0 }}>
          <FontAwesomeIcon icon={faArrowLeft} /> Volver
        </button>
        <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111', flex: 1 }}>
          {editing ? 'Editar guía' : 'Nueva guía'}
        </span>
        <button
          onClick={() => setPreviewMode(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: `1.5px solid ${previewMode ? GOLD : '#e5e7eb'}`,
            background: previewMode ? '#fffdf0' : '#fff',
            color: previewMode ? '#92400e' : '#6b7280',
            fontWeight: 600, fontSize: 13, cursor: 'pointer'
          }}>
          <FontAwesomeIcon icon={previewMode ? faEyeSlash : faEye} />
          {previewMode ? 'Editar' : 'Vista previa'}
        </button>
        <button onClick={save} disabled={saving || !form.title.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: saveOk ? '#16a34a' : saving ? '#555' : '#111',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            transition: 'background 0.2s', opacity: !form.title.trim() ? 0.5 : 1
          }}>
          <FontAwesomeIcon icon={saveOk ? faCheck : saving ? faSpinner : faSave} spin={saving} />
          {saveOk ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 80px' }}>

        {previewMode ? (
          /* ── VISTA PREVIA ── */
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: '#111', padding: '20px 24px' }}>
              <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Guía de preparación
              </div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>
                {form.title || 'Sin título'}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                {form.steps.length} paso{form.steps.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              {form.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: GOLD,
                    color: '#000', fontWeight: 900, fontSize: 16, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    {step.title && <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 5 }}>{step.title}</div>}
                    {step.instruction && <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{step.instruction}</div>}
                    {step.tip && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#92400e', background: '#fffdf0', borderLeft: `3px solid ${GOLD}`, padding: '6px 12px', borderRadius: '0 8px 8px 0' }}>
                        💡 {step.tip}
                      </div>
                    )}
                    {step.image_url && (
                      <img src={imgSrc(step.image_url)} alt=""
                        onClick={() => setLightboxImg(imgSrc(step.image_url))}
                        style={{ marginTop: 12, width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── EDITOR ── */
          <>
            {/* León IA */}
            {!editing && (
              <div style={{
                background: '#fffdf0', border: `1.5px solid ${GOLD}60`,
                borderRadius: 14, padding: '18px 20px', marginBottom: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FontAwesomeIcon icon={faBrain} style={{ color: GOLD, fontSize: 16 }} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#7a5c00' }}>Generar con León IA</span>
                  <span style={{ fontSize: 12, color: '#a0804a', marginLeft: 4 }}>— escribe el nombre del producto y la IA crea los pasos</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    value={genProduct}
                    onChange={e => setGenProduct(e.target.value)}
                    placeholder="Nombre del producto (ej: Hamburguesa Clásica)"
                    style={{
                      flex: 2, minWidth: 180, padding: '10px 13px', border: '1.5px solid #e5c84a',
                      borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff'
                    }}
                  />
                  <input
                    value={genContext}
                    onChange={e => setGenContext(e.target.value)}
                    placeholder="Detalles extras (opcional)"
                    style={{
                      flex: 1, minWidth: 120, padding: '10px 13px', border: '1.5px solid #e5c84a',
                      borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff'
                    }}
                  />
                  <button onClick={generateWithAI} disabled={generating || !genProduct.trim()}
                    style={{
                      padding: '10px 18px', borderRadius: 9, border: 'none',
                      background: generating || !genProduct.trim() ? '#ccc' : GOLD,
                      color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap'
                    }}>
                    <FontAwesomeIcon icon={generating ? faSpinner : faBrain} spin={generating} />
                    {generating ? 'Generando...' : 'Generar pasos'}
                  </button>
                </div>
              </div>
            )}

            {/* Título */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Título de la guía
              </label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ej: Cómo preparar la Hamburguesa Clásica"
                style={{
                  width: '100%', padding: '13px 16px', border: '2px solid #e5e7eb',
                  borderRadius: 12, fontSize: 18, fontWeight: 700, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = GOLD}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Pasos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  total={form.steps.length}
                  onChange={updateStep}
                  onMove={moveStep}
                  onRemove={removeStep}
                  onUpload={uploadImage}
                  uploadingStep={uploadingStep}
                />
              ))}
            </div>

            {/* Agregar paso */}
            <button onClick={addStep}
              style={{
                width: '100%', marginTop: 16, padding: '14px',
                border: '2px dashed #d1d5db', borderRadius: 14,
                background: 'transparent', color: '#9ca3af',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
            >
              <FontAwesomeIcon icon={faPlus} /> Agregar paso
            </button>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, objectFit: 'contain' }} />
          <button onClick={() => setLightboxImg(null)}
            style={{ position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
