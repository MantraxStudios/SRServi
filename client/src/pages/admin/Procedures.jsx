import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList, faPlus, faEdit, faTrash, faBrain, faImage,
  faSave, faTimes, faChevronUp, faChevronDown, faSpinner, faEye
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const emptyStep = () => ({ title: '', instruction: '', tip: '', image_url: '' });

export default function Procedures() {
  const { selectedStore } = useStore() || {};
  const { token } = useAuth();

  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', product_id: '', steps: [emptyStep()] });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProduct, setGenProduct] = useState('');
  const [genContext, setGenContext] = useState('');
  const [uploadingStep, setUploadingStep] = useState(null);
  const [previewProcedure, setPreviewProcedure] = useState(null);
  const fileRefs = useRef({});

  const storeId = selectedStore?.id;

  const load = async () => {
    if (!storeId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/procedures?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setProcedures(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [storeId, token]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', product_id: '', steps: [emptyStep()] });
    setShowModal(true);
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({ title: proc.title, product_id: proc.product_id || '', steps: proc.steps.length ? proc.steps : [emptyStep()] });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setGenProduct(''); setGenContext(''); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `${API}/api/procedures/${editing.id}` : `${API}/api/procedures`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...form, store_id: storeId })
      });
      if (res.ok) { closeModal(); load(); }
    } finally { setSaving(false); }
  };

  const deleteProcedure = async (id) => {
    if (!confirm('¿Eliminar este procedimiento?')) return;
    await fetch(`${API}/api/procedures/${id}?store_id=${storeId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
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
      } else {
        alert('León IA no disponible o error al generar. Puedes crear los pasos manualmente.');
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
      const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
      if (res.ok) {
        const data = await res.json();
        const url = data.url || data.path || data.file || '';
        updateStep(stepIdx, 'image_url', url);
      }
    } finally { setUploadingStep(null); }
  };

  if (loading) return <div className="loading">Cargando procedimientos...</div>;

  const cardStyle = { background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, overflow: 'hidden' };
  const inputStyle = { width: '100%', padding: '8px 11px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#faf7ee', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ color: GOLD, fontSize: 18 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Procedimientos</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Guías paso a paso para tus trabajadores</p>
          </div>
        </div>
        <button onClick={openNew}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faPlus} /> Nuevo procedimiento
        </button>
      </div>

      {/* List */}
      {procedures.length === 0 ? (
        <div style={{ ...cardStyle, padding: '50px 0', textAlign: 'center', color: '#bbb' }}>
          <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 36, marginBottom: 12 }} /><br />
          No hay procedimientos creados.<br />
          <span style={{ fontSize: 13 }}>Crea el primero para que tus trabajadores sepan cómo preparar cada producto.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {procedures.map(proc => (
            <div key={proc.id} style={{ ...cardStyle, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{proc.title}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{proc.steps?.length || 0} pasos</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPreviewProcedure(proc)}
                  style={{ padding: '7px 13px', borderRadius: 7, border: '1.5px solid #e2e2e2', background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#444' }}>
                  <FontAwesomeIcon icon={faEye} /> Ver
                </button>
                <button onClick={() => openEdit(proc)}
                  style={{ padding: '7px 13px', borderRadius: 7, border: '1.5px solid #e2e2e2', background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#444' }}>
                  <FontAwesomeIcon icon={faEdit} /> Editar
                </button>
                <button onClick={() => deleteProcedure(proc.id)}
                  style={{ padding: '7px 13px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing ? 'Editar procedimiento' : 'Nuevo procedimiento'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* AI Generation */}
            {!editing && (
              <div style={{ background: '#faf7ee', border: `1px solid ${GOLD}40`, borderRadius: 10, padding: '16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700, fontSize: 13, color: '#7a5c00' }}>
                  <FontAwesomeIcon icon={faBrain} /> Generar con León IA
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Nombre del producto</label>
                    <input style={inputStyle} value={genProduct} onChange={e => setGenProduct(e.target.value)} placeholder="ej: Hamburguesa Clásica" />
                  </div>
                  <div>
                    <label style={labelStyle}>Contexto adicional (opcional)</label>
                    <input style={inputStyle} value={genContext} onChange={e => setGenContext(e.target.value)} placeholder="ej: con queso derretido y lechuga fresca" />
                  </div>
                </div>
                <button onClick={generateWithAI} disabled={generating || !genProduct.trim()}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: GOLD, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: generating || !genProduct.trim() ? 0.6 : 1 }}>
                  <FontAwesomeIcon icon={generating ? faSpinner : faBrain} spin={generating} />
                  {generating ? 'Generando...' : 'Generar pasos con IA'}
                </button>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Título del procedimiento</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ej: Preparación de Hamburguesa Clásica" />
            </div>

            {/* Steps */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Pasos ({form.steps.length})</label>
                <button onClick={addStep}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e2e2e2', background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FontAwesomeIcon icon={faPlus} /> Agregar paso
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
                {form.steps.map((step, i) => (
                  <div key={i} style={{ border: '1.5px solid #e2e2e2', borderRadius: 10, padding: '14px', background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, background: '#faf7ee', padding: '3px 9px', borderRadius: 20 }}>Paso {i + 1}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => moveStep(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 13, padding: '2px 5px' }}>
                          <FontAwesomeIcon icon={faChevronUp} />
                        </button>
                        <button onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 13, padding: '2px 5px' }}>
                          <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                        <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: '2px 5px' }}>
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={labelStyle}>Título del paso</label>
                        <input style={inputStyle} value={step.title} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="ej: Preparar la carne" />
                      </div>
                      <div>
                        <label style={labelStyle}>Consejo (opcional)</label>
                        <input style={inputStyle} value={step.tip} onChange={e => updateStep(i, 'tip', e.target.value)} placeholder="ej: Mantén la plancha caliente" />
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={labelStyle}>Instrucción detallada</label>
                      <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={step.instruction}
                        onChange={e => updateStep(i, 'instruction', e.target.value)}
                        placeholder="Describe el paso en detalle para que cualquier trabajador pueda seguirlo..." />
                    </div>
                    {/* Image upload */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input ref={el => fileRefs.current[i] = el} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => uploadImage(i, e.target.files[0])} />
                      <button onClick={() => fileRefs.current[i]?.click()} disabled={uploadingStep === i}
                        style={{ padding: '5px 11px', borderRadius: 6, border: '1.5px solid #e2e2e2', background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
                        <FontAwesomeIcon icon={uploadingStep === i ? faSpinner : faImage} spin={uploadingStep === i} />
                        {uploadingStep === i ? 'Subiendo...' : 'Agregar imagen'}
                      </button>
                      {step.image_url && (
                        <img src={step.image_url.startsWith('http') ? step.image_url : API + step.image_url}
                          alt="paso" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e2e2' }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeModal} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e2e2', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
                <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (worker view) */}
      {previewProcedure && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9100, overflow: 'auto', padding: '20px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#111', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{previewProcedure.title}</div>
              <button onClick={() => setPreviewProcedure(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 20 }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Vista del trabajador · {previewProcedure.steps?.length} pasos</div>
              {(previewProcedure.steps || []).map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: GOLD, color: '#000', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    {step.title && <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>{step.title}</div>}
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{step.instruction}</div>
                    {step.tip && <div style={{ marginTop: 6, fontSize: 12, color: '#888', background: '#fffbe6', padding: '5px 10px', borderRadius: 6, borderLeft: `3px solid ${GOLD}` }}>💡 {step.tip}</div>}
                    {step.image_url && (
                      <img src={step.image_url.startsWith('http') ? step.image_url : API + step.image_url}
                        alt="" style={{ marginTop: 10, width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
