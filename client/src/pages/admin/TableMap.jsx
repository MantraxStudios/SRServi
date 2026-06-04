import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faSave, faTimes, faEdit, faChair,
  faCircle, faSquare, faSync
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';
const CANVAS_W = 900;
const CANVAS_H = 540;

const inputStyle = {
  width: '100%', padding: '9px 12px',
  background: '#1a1a2e', border: '1px solid #2d2d4e',
  borderRadius: 8, color: '#e4e4f0', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 11, color: '#7c7ca0', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 };

// ── Table Shape ────────────────────────────────────────────────────────────────
function TableShape({ table, selected, onClick, onDragStart, onTouchStart }) {
  const isCircle = table.shape === 'circle';
  const occupied = !!table.occupied;
  const w = table.w;
  const h = isCircle ? table.w : table.h;

  const borderColor = selected ? '#D4AF37' : occupied ? '#f87171' : '#4ade80';
  const bgColor = selected
    ? 'rgba(212,175,55,0.15)'
    : occupied
      ? 'rgba(248,113,113,0.12)'
      : 'rgba(74,222,128,0.08)';
  const glowColor = selected
    ? 'rgba(212,175,55,0.4)'
    : occupied
      ? 'rgba(248,113,113,0.3)'
      : 'rgba(74,222,128,0.2)';

  const labelSize = Math.min(14, Math.max(9, w / 9));

  return (
    <div
      style={{
        position: 'absolute',
        left: table.x,
        top: table.y,
        width: w,
        height: h,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        borderRadius: isCircle ? '50%' : '12px',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: selected
          ? `0 0 0 3px ${glowColor}, 0 6px 24px rgba(0,0,0,0.5)`
          : `0 0 12px ${glowColor}, 0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        zIndex: selected ? 10 : 1,
      }}
      onClick={onClick}
      onMouseDown={onDragStart}
      onTouchStart={onTouchStart}
    >
      {/* Status glow dot */}
      <div style={{
        position: 'absolute', top: 7, right: 8,
        width: 7, height: 7, borderRadius: '50%',
        background: occupied ? '#f87171' : '#4ade80',
        boxShadow: `0 0 8px ${occupied ? '#f87171' : '#4ade80'}, 0 0 3px ${occupied ? '#f87171' : '#4ade80'}`,
      }} />

      <span style={{
        fontSize: labelSize,
        fontWeight: 800,
        color: '#fff',
        lineHeight: 1.2,
        textAlign: 'center',
        padding: '0 6px',
        letterSpacing: 0.3,
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>
        {table.label}
      </span>
      <span style={{
        fontSize: Math.max(9, labelSize - 2),
        color: occupied ? '#fca5a5' : 'rgba(255,255,255,0.5)',
        marginTop: 3,
        fontWeight: 600,
      }}>
        {occupied ? 'OCUPADA' : `${table.capacity}p`}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TableMap() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', capacity: 4, w: 120, h: 80, shape: 'rect' });
  const [dirty, setDirty] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchTables = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/restaurant-tables?store_id=${selectedStore.id}`, { headers: authHeaders });
      if (res.ok) setTables(await res.json());
    } finally { setLoading(false); }
  }, [selectedStore, token]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // ── Shared drag logic ──────────────────────────────────────────────────────
  const startDrag = (clientX, clientY, tableId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = {
      id: tableId,
      startMouseX: clientX,
      startMouseY: clientY,
      startX: table.x,
      startY: table.y,
      scaleX,
      scaleY
    };
    setSelectedId(tableId);
  };

  const moveDrag = (clientX, clientY) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (clientX - d.startMouseX) * d.scaleX;
    const dy = (clientY - d.startMouseY) * d.scaleY;
    setTables(prev => prev.map(t => {
      if (t.id !== d.id) return t;
      const newX = Math.max(0, Math.min(CANVAS_W - t.w, Math.round(d.startX + dx)));
      const newY = Math.max(0, Math.min(CANVAS_H - (t.shape === 'circle' ? t.w : t.h), Math.round(d.startY + dy)));
      return { ...t, x: newX, y: newY };
    }));
    setDirty(true);
  };

  const endDrag = () => { dragRef.current = null; };

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleMouseDown = (e, tableId) => {
    e.preventDefault(); e.stopPropagation();
    startDrag(e.clientX, e.clientY, tableId);
  };

  const handleMouseMove = useCallback((e) => { moveDrag(e.clientX, e.clientY); }, []);
  const handleMouseUp = useCallback(() => { endDrag(); }, []);

  // ── Touch handlers (Android / iOS) ─────────────────────────────────────────
  const handleTouchStart = (e, tableId) => {
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, tableId);
  };

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.preventDefault(); // block scroll while dragging
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  }, []);

  const handleTouchEnd = useCallback(() => { endDrag(); }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      await Promise.all(tables.map(t =>
        fetch(`${API}/api/restaurant-tables/${t.id}`, {
          method: 'PUT', headers: authHeaders,
          body: JSON.stringify({ store_id: selectedStore.id, label: t.label, capacity: t.capacity, x: t.x, y: t.y, w: t.w, h: t.h, shape: t.shape, sort_order: t.sort_order || 0 })
        })
      ));
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleEditSave = async () => {
    if (!selectedId || !editForm || !selectedStore) return;
    setSaving(true);
    try {
      const t = tables.find(t => t.id === selectedId);
      const cleanForm = {
        ...editForm,
        capacity: editForm.capacity || 1,
        w: editForm.w || (editForm.shape === 'circle' ? 100 : 120),
        h: editForm.h || 80,
      };
      const res = await fetch(`${API}/api/restaurant-tables/${selectedId}`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ store_id: selectedStore.id, ...cleanForm, x: t.x, y: t.y, sort_order: t.sort_order || 0 })
      });
      if (res.ok) {
        const updated = await res.json();
        setTables(prev => prev.map(tb => tb.id === selectedId ? { ...tb, ...updated } : tb));
        setEditForm(null); setDirty(false);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!selectedStore || !window.confirm('¿Eliminar esta mesa?')) return;
    await fetch(`${API}/api/restaurant-tables/${id}?store_id=${selectedStore.id}`, { method: 'DELETE', headers: authHeaders });
    setTables(prev => prev.filter(t => t.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditForm(null); }
  };

  const handleAdd = async () => {
    if (!selectedStore || !addForm.label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/restaurant-tables`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ store_id: selectedStore.id, ...addForm, x: 50, y: 50, sort_order: tables.length })
      });
      if (res.ok) {
        const created = await res.json();
        setTables(prev => [...prev, created]);
        setShowAddForm(false);
        setAddForm({ label: '', capacity: 4, w: 120, h: 80, shape: 'rect' });
      }
    } finally { setSaving(false); }
  };

  if (!selectedStore) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#7c7ca0' }}>
        <FontAwesomeIcon icon={faChair} style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: 14 }}>Selecciona una tienda para gestionar las mesas.</p>
      </div>
    );
  }

  const selectedTable = tables.find(t => t.id === selectedId);
  const totalAvailable = tables.filter(t => !t.occupied).length;
  const totalOccupied = tables.filter(t => t.occupied).length;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>Mapa de Mesas</h1>
          <p style={{ margin: '4px 0 0', color: '#7c7ca0', fontSize: 12 }}>
            Arrastrá las mesas para posicionarlas en el plano
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={fetchTables}
            style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: '#a0a0c0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <FontAwesomeIcon icon={faSync} />
            Actualizar
          </button>
          <button
            onClick={() => { setShowAddForm(true); setAddForm({ label: '', capacity: 4, w: 120, h: 80, shape: 'rect' }); }}
            style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', color: '#000', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
          >
            <FontAwesomeIcon icon={faPlus} />
            Nueva Mesa
          </button>
          {dirty && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={{ background: saving ? '#1a1a2e' : 'linear-gradient(135deg,#D4AF37,#B8952D)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: saving ? 'default' : 'pointer', color: saving ? '#555' : '#000', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, boxShadow: saving ? 'none' : '0 4px 16px rgba(212,175,55,0.4)' }}
            >
              <FontAwesomeIcon icon={faSave} />
              {saving ? 'Guardando...' : 'Guardar Posiciones'}
            </button>
          )}
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 12, fontWeight: 700, padding: '9px 14px', background: 'rgba(74,222,128,0.1)', borderRadius: 10, border: '1px solid rgba(74,222,128,0.2)' }}>
              ✓ Guardado
            </div>
          )}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: tables.length, color: '#a0a0c0', bg: '#1a1a2e', border: '#2d2d4e' },
          { label: 'Disponibles', value: totalAvailable, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
          { label: 'Ocupadas', value: totalOccupied, color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 10, padding: '7px 14px' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
            <span style={{ fontSize: 11, color: stat.color, fontWeight: 600, opacity: 0.8 }}>{stat.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { color: '#4ade80', label: 'Disponible' },
            { color: '#f87171', label: 'Ocupada' },
            { color: '#D4AF37', label: 'Seleccionada' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7c7ca0' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: '1 1 580px',
            position: 'relative',
            width: '100%',
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            background: '#0b0b18',
            border: '1.5px solid #1e1e3a',
            borderRadius: 16,
            overflow: 'hidden',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px)',
            backgroundSize: '32px 32px',
            backgroundPosition: '16px 16px',
            cursor: 'default',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setSelectedId(null); setEditForm(null); }
          }}
        >
          {/* Room border decoration */}
          <div style={{ position: 'absolute', inset: 10, border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, pointerEvents: 'none' }} />

          {loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#7c7ca0', gap: 10 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #1e1e3a', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Cargando mesas...</span>
            </div>
          ) : tables.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3a3a5c', gap: 10 }}>
              <FontAwesomeIcon icon={faChair} style={{ fontSize: 40 }} />
              <span style={{ fontSize: 13, color: '#5a5a80' }}>No hay mesas. Creá la primera con el botón de arriba.</span>
            </div>
          ) : (
            tables.map(table => (
              <TableShape
                key={table.id}
                table={table}
                selected={selectedId === table.id}
                onClick={() => {
                  setSelectedId(table.id);
                  setEditForm({ label: table.label, capacity: table.capacity, w: table.w, h: table.h, shape: table.shape });
                }}
                onDragStart={(e) => handleMouseDown(e, table.id)}
                onTouchStart={(e) => handleTouchStart(e, table.id)}
              />
            ))
          )}
        </div>

        {/* Side panel */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editForm && selectedTable ? (
            <div style={{ background: '#0f0f1e', border: '1.5px solid #1e1e3a', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#e4e4f0' }}>Editar mesa</div>
                <button onClick={() => { setEditForm(null); setSelectedId(null); }} style={{ background: '#1a1a2e', border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#7c7ca0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>×</button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Nombre</label>
                <input style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Capacidad</label>
                <input style={inputStyle} type="number" min="1" value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value === '' ? '' : parseInt(e.target.value) }))} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Forma</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['rect', 'circle'].map(s => (
                    <button key={s}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: editForm.shape === s ? '1.5px solid #D4AF37' : '1px solid #2d2d4e', background: editForm.shape === s ? 'rgba(212,175,55,0.12)' : '#1a1a2e', cursor: 'pointer', fontSize: 11, fontWeight: editForm.shape === s ? 800 : 500, color: editForm.shape === s ? '#D4AF37' : '#7c7ca0' }}
                      onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                    >
                      <FontAwesomeIcon icon={s === 'circle' ? faCircle : faSquare} style={{ marginRight: 4, fontSize: 10 }} />
                      {s === 'circle' ? 'Redonda' : 'Cuadrada'}
                    </button>
                  ))}
                </div>
              </div>
              {editForm.shape === 'rect' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Ancho</label>
                    <input style={inputStyle} type="number" min="60" max="300" value={editForm.w} onChange={e => setEditForm(f => ({ ...f, w: e.target.value === '' ? '' : parseInt(e.target.value) }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Alto</label>
                    <input style={inputStyle} type="number" min="40" max="200" value={editForm.h} onChange={e => setEditForm(f => ({ ...f, h: e.target.value === '' ? '' : parseInt(e.target.value) }))} />
                  </div>
                </div>
              )}
              {editForm.shape === 'circle' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Diámetro</label>
                  <input style={inputStyle} type="number" min="60" max="250" value={editForm.w} onChange={e => setEditForm(f => ({ ...f, w: e.target.value === '' ? '' : parseInt(e.target.value) }))} />
                </div>
              )}

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#1a1a2e', marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedTable.occupied ? '#f87171' : '#4ade80', boxShadow: `0 0 6px ${selectedTable.occupied ? '#f87171' : '#4ade80'}` }} />
                <span style={{ fontSize: 12, color: selectedTable.occupied ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                  {selectedTable.occupied ? 'Ocupada' : 'Disponible'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  style={{ flex: 1, padding: '10px', background: saving ? '#1a1a2e' : '#D4AF37', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: saving ? 'default' : 'pointer', color: saving ? '#555' : '#000', boxShadow: saving ? 'none' : '0 4px 14px rgba(212,175,55,0.3)' }}
                >
                  {saving ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={() => handleDelete(selectedTable.id)}
                  style={{ padding: '10px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, cursor: 'pointer', color: '#f87171', fontSize: 12 }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#0f0f1e', border: '1.5px dashed #1e1e3a', borderRadius: 14, padding: 20, textAlign: 'center', color: '#3a3a5c' }}>
              <FontAwesomeIcon icon={faChair} style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
              <span style={{ fontSize: 12, color: '#5a5a80', lineHeight: 1.5 }}>
                Tocá una mesa para editarla
              </span>
            </div>
          )}

          {/* Quick list */}
          {tables.length > 0 && (
            <div style={{ background: '#0f0f1e', border: '1.5px solid #1e1e3a', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7c7ca0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Lista de mesas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'none' }}>
                {tables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedId(t.id);
                      setEditForm({ label: t.label, capacity: t.capacity, w: t.w, h: t.h, shape: t.shape });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: selectedId === t.id ? 'rgba(212,175,55,0.1)' : 'transparent',
                      textAlign: 'left', transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.occupied ? '#f87171' : '#4ade80', flexShrink: 0, boxShadow: `0 0 5px ${t.occupied ? '#f87171' : '#4ade80'}` }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: selectedId === t.id ? '#D4AF37' : '#c0c0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                    <span style={{ fontSize: 10, color: '#5a5a80' }}>{t.capacity}p</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add table modal ─────────────────────────────────────────────────── */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            style={{ background: '#0f0f1e', border: '1.5px solid #1e1e3a', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#e4e4f0' }}>Nueva Mesa</h3>
              <button style={{ background: '#1a1a2e', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#7c7ca0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }} onClick={() => setShowAddForm(false)}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} placeholder="Ej: Mesa 1, Barra, Terraza" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Capacidad (personas)</label>
              <input style={inputStyle} type="number" min="1" value={addForm.capacity} onChange={e => setAddForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Forma</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['rect', 'circle'].map(s => (
                  <button key={s}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: addForm.shape === s ? '1.5px solid #D4AF37' : '1px solid #2d2d4e', background: addForm.shape === s ? 'rgba(212,175,55,0.12)' : '#1a1a2e', cursor: 'pointer', fontSize: 12, fontWeight: addForm.shape === s ? 800 : 500, color: addForm.shape === s ? '#D4AF37' : '#7c7ca0' }}
                    onClick={() => setAddForm(f => ({ ...f, shape: s }))}
                  >
                    <FontAwesomeIcon icon={s === 'circle' ? faCircle : faSquare} style={{ marginRight: 5, fontSize: 11 }} />
                    {s === 'circle' ? 'Redonda' : 'Cuadrada'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ flex: 1, padding: '12px', background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#a0a0c0' }}
              >Cancelar</button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.label.trim()}
                style={{ flex: 1, padding: '12px', background: saving || !addForm.label.trim() ? '#1a1a2e' : '#D4AF37', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: saving || !addForm.label.trim() ? 'not-allowed' : 'pointer', color: saving || !addForm.label.trim() ? '#555' : '#000', boxShadow: saving || !addForm.label.trim() ? 'none' : '0 4px 16px rgba(212,175,55,0.4)' }}
              >
                {saving ? 'Creando...' : 'Crear Mesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
