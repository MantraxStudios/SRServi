import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList, faPlus, faTrash, faGripVertical,
  faSave, faUndo, faEdit, faCheck, faTimes,
} from '@fortawesome/free-solid-svg-icons';

function genKey() {
  return 'q_' + Math.random().toString(36).slice(2, 8);
}

function QuestionEditor({ q, index, total, onChange, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q);

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(q); setEditing(false); };

  const setOption = (i, val) => setDraft(d => {
    const opts = [...d.options]; opts[i] = val; return { ...d, options: opts };
  });
  const addOption = () => {
    if (draft.options.length >= 4) return;
    setDraft(d => ({ ...d, options: [...d.options, ''] }));
  };
  const removeOption = (i) => {
    if (draft.options.length <= 2) return;
    setDraft(d => ({ ...d, options: d.options.filter((_, idx) => idx !== i) }));
  };

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14,
      marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: '#f8fafc', borderBottom: editing ? '1px solid #e5e7eb' : 'none',
      }}>
        <span style={{ color: '#9ca3af', cursor: 'grab', fontSize: 14 }}>
          <FontAwesomeIcon icon={faGripVertical} />
        </span>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', background: '#1e293b',
          color: '#fff', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{index + 1}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>
          {q.text || <em style={{ color: '#9ca3af' }}>Sin texto</em>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            title="Subir" style={iconBtn('#6b7280')}>▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            title="Bajar" style={iconBtn('#6b7280')}>▼</button>
          <button onClick={() => setEditing(true)} style={iconBtn('#3b82f6')} title="Editar">
            <FontAwesomeIcon icon={faEdit} />
          </button>
          <button onClick={onDelete} style={iconBtn('#ef4444')} title="Eliminar">
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ padding: '14px 16px' }}>
          <label style={labelStyle}>Pregunta</label>
          <input
            value={draft.text}
            onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
            placeholder="Escribe la pregunta..."
            style={inputStyle}
          />
          <label style={{ ...labelStyle, marginTop: 12 }}>
            Opciones ({draft.options.length}/4)
          </label>
          {draft.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={opt}
                onChange={e => setOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button onClick={() => removeOption(i)} disabled={draft.options.length <= 2}
                style={{ ...iconBtn('#ef4444'), opacity: draft.options.length <= 2 ? 0.4 : 1 }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          ))}
          {draft.options.length < 4 && (
            <button onClick={addOption} style={{ ...smallBtn('#6b7280'), marginTop: 4 }}>
              <FontAwesomeIcon icon={faPlus} /> Agregar opción
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} style={smallBtn('#16a34a')}>
              <FontAwesomeIcon icon={faCheck} /> Guardar
            </button>
            <button onClick={cancel} style={smallBtn('#6b7280')}>
              <FontAwesomeIcon icon={faTimes} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurveyConfig() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const [questions, setQuestions] = useState(null);
  const [defaults, setDefaults] = useState([]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedStore) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/survey-config?store_id=${selectedStore.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setDefaults(data.defaults || []);
        if (data.questions) {
          setQuestions(data.questions);
          setIsCustom(true);
        } else {
          setQuestions(null);
          setIsCustom(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedStore, token]);

  const activeQuestions = isCustom ? (questions || []) : defaults;

  const save = async (qs, custom) => {
    setSaving(true);
    try {
      await fetch('/api/survey-config', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, questions: custom ? qs : null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const enableCustom = () => {
    const copy = defaults.map(q => ({ ...q, key: genKey(), options: [...q.options] }));
    setQuestions(copy);
    setIsCustom(true);
  };

  const resetToDefaults = async () => {
    if (!confirm('¿Volver a las preguntas por defecto? Se perderán las personalizadas.')) return;
    setIsCustom(false);
    setQuestions(null);
    await save(null, false);
  };

  const addQuestion = () => {
    const newQ = { key: genKey(), text: '', options: ['', '', '', ''] };
    setQuestions(qs => [...(qs || []), newQ]);
  };

  const updateQuestion = (index, updated) => {
    setQuestions(qs => qs.map((q, i) => i === index ? updated : q));
  };

  const deleteQuestion = (index) => {
    setQuestions(qs => qs.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, dir) => {
    setQuestions(qs => {
      const arr = [...qs];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  if (loading) return <div className="loading">Cargando...</div>;

  if (!selectedStore) return (
    <div className="admin-main">
      <div className="card empty-state">
        <FontAwesomeIcon icon={faClipboardList} className="empty-state-icon" />
        <h2 className="empty-state-title">Selecciona una tienda</h2>
      </div>
    </div>
  );

  return (
    <>
      <header className="admin-header">
        <h1>Configurar encuesta</h1>
        {isCustom && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={resetToDefaults} disabled={saving}>
              <FontAwesomeIcon icon={faUndo} /> Usar defaults
            </button>
            <button
              className="btn btn-primary"
              onClick={() => save(activeQuestions, true)}
              disabled={saving}
            >
              <FontAwesomeIcon icon={faSave} />
              {saving ? ' Guardando...' : saved ? ' ¡Guardado!' : ' Guardar cambios'}
            </button>
          </div>
        )}
      </header>
      <div className="admin-main" style={{ maxWidth: 680 }}>

        {/* Toggle card */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {isCustom ? 'Preguntas personalizadas' : 'Preguntas por defecto'}
            </div>
            <div className="text-sm text-muted">
              {isCustom
                ? `${activeQuestions.length} preguntas — editables a tu gusto`
                : 'Las preguntas estándar de SRServi se usan para todos tus clientes'}
            </div>
          </div>
          {!isCustom && (
            <button className="btn btn-primary" onClick={enableCustom}>
              <FontAwesomeIcon icon={faEdit} /> Personalizar
            </button>
          )}
        </div>

        {/* Questions list */}
        <div>
          {activeQuestions.map((q, i) => (
            isCustom ? (
              <QuestionEditor
                key={q.key || i}
                q={q}
                index={i}
                total={activeQuestions.length}
                onChange={updated => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
                onMove={(idx, dir) => moveQuestion(idx, dir)}
              />
            ) : (
              <div key={q.key || i} style={{
                background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14,
                padding: '12px 16px', marginBottom: 10,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb',
                  color: '#6b7280', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{q.text}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {q.options.map(opt => (
                      <span key={opt} style={{
                        fontSize: 12, background: '#f1f5f9', color: '#64748b',
                        padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                      }}>{opt}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          ))}

          {isCustom && (
            <button
              onClick={addQuestion}
              style={{
                width: '100%', padding: '12px', marginTop: 4,
                background: 'transparent', border: '2px dashed #d1d5db',
                borderRadius: 14, color: '#6b7280', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <FontAwesomeIcon icon={faPlus} /> Agregar pregunta
            </button>
          )}
        </div>
      </div>
    </>
  );
}

const iconBtn = (color) => ({
  background: 'transparent', border: 'none', cursor: 'pointer',
  color, fontSize: 13, padding: '4px 6px', borderRadius: 6,
  display: 'flex', alignItems: 'center',
});
const smallBtn = (color) => ({
  background: color, border: 'none', cursor: 'pointer', color: '#fff',
  fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
  display: 'inline-flex', alignItems: 'center', gap: 6,
});
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 };
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #d1d5db', fontSize: 14, color: '#1e293b',
  outline: 'none', boxSizing: 'border-box', marginBottom: 0,
};
