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
  width: '100%', padding: '8px 10px', background: '#fff',
  border: '1px solid #d1d5db', borderRadius: 7,
  color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box'
};
const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 3, display: 'block' };
const btnGold = {
  background: '#D4AF37', border: 'none', borderRadius: 8, padding: '9px 16px',
  cursor: 'pointer', color: '#000', fontWeight: 700, fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6
};
const btnGhost = {
  background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
  padding: '8px 14px', cursor: 'pointer', color: '#374151', fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6
};
const btnDanger = {
  background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8,
  padding: '8px 14px', cursor: 'pointer', color: '#dc2626', fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6
};

function TableShape({ table, selected, onClick, onDragStart }) {
  const isCircle = table.shape === 'circle';
  const occupied = !!table.occupied;

  const base = {
    position: 'absolute',
    left: table.x,
    top: table.y,
    width: table.w,
    height: isCircle ? table.w : table.h,
    cursor: 'grab',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRadius: isCircle ? '50%' : '10px',
    border: selected
      ? '2.5px solid #D4AF37'
      : occupied
        ? '2px solid #ef4444'
        : '2px solid #22c55e',
    background: occupied
      ? 'rgba(239,68,68,0.13)'
      : 'rgba(34,197,94,0.1)',
    boxShadow: selected ? '0 0 0 3px rgba(212,175,55,0.3)' : undefined,
    transition: 'box-shadow 0.15s',
  };

  return (
    <div
      style={base}
      onClick={onClick}
      onMouseDown={onDragStart}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: occupied ? '#dc2626' : '#15803d', lineHeight: 1.2, textAlign: 'center', padding: '0 4px' }}>
        {table.label}
      </span>
      <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
        {table.capacity} pers.
      </span>
      {occupied && (
        <span style={{ fontSize: 9, color: '#dc2626', marginTop: 1, fontWeight: 600 }}>OCUPADA</span>
      )}
    </div>
  );
}

const EMPTY_FORM = { label: '', capacity: 4, w: 120, h: 80, shape: 'rect' };

export default function TableMap() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
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
    } finally {
      setLoading(false);
    }
  }, [selectedStore, token]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const handleMouseDown = (e, tableId) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = {
      id: tableId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: table.x,
      startY: table.y,
      scaleX,
      scaleY
    };
    setSelectedId(tableId);
  };

  const handleMouseMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startMouseX) * d.scaleX;
    const dy = (e.clientY - d.startMouseY) * d.scaleY;
    setTables(prev => prev.map(t => {
      if (t.id !== d.id) return t;
      const newX = Math.max(0, Math.min(CANVAS_W - t.w, Math.round(d.startX + dx)));
      const newY = Math.max(0, Math.min(CANVAS_H - (t.shape === 'circle' ? t.w : t.h), Math.round(d.startY + dy)));
      return { ...t, x: newX, y: newY };
    }));
    setDirty(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const selectedTable = tables.find(t => t.id === selectedId);

  const handleSelectTable = (id) => {
    setSelectedId(id);
    const t = tables.find(t => t.id === id);
    if (t) setEditForm({ label: t.label, capacity: t.capacity, w: t.w, h: t.h, shape: t.shape });
  };

  const handleSaveAll = async () => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      await Promise.all(tables.map(t =>
        fetch(`${API}/api/restaurant-tables/${t.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ store_id: selectedStore.id, label: t.label, capacity: t.capacity, x: t.x, y: t.y, w: t.w, h: t.h, shape: t.shape, sort_order: t.sort_order || 0 })
        })
      ));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedId || !editForm || !selectedStore) return;
    setSaving(true);
    try {
      const t = tables.find(t => t.id === selectedId);
      const res = await fetch(`${API}/api/restaurant-tables/${selectedId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ store_id: selectedStore.id, ...editForm, x: t.x, y: t.y, sort_order: t.sort_order || 0 })
      });
      if (res.ok) {
        const updated = await res.json();
        setTables(prev => prev.map(tb => tb.id === selectedId ? { ...tb, ...updated } : tb));
        setEditForm(null);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!selectedStore || !window.confirm('¿Eliminar esta mesa?')) return;
    await fetch(`${API}/api/restaurant-tables/${id}?store_id=${selectedStore.id}`, {
      method: 'DELETE', headers: authHeaders
    });
    setTables(prev => prev.filter(t => t.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditForm(null); }
  };

  const handleAdd = async () => {
    if (!selectedStore || !addForm.label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/restaurant-tables`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ store_id: selectedStore.id, ...addForm, x: 50, y: 50, sort_order: tables.length })
      });
      if (res.ok) {
        const created = await res.json();
        setTables(prev => [...prev, created]);
        setShowAddForm(false);
        setAddForm({ ...EMPTY_FORM });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!selectedStore) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        Selecciona una tienda para gestionar las mesas.
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Mapa de Mesas</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            Arrastra las mesas para posicionarlas en el plano. Verde = disponible, Rojo = ocupada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnGhost} onClick={fetchTables}>
            <FontAwesomeIcon icon={faSync} />
            Actualizar
          </button>
          <button style={btnGhost} onClick={() => { setShowAddForm(true); setAddForm({ ...EMPTY_FORM }); }}>
            <FontAwesomeIcon icon={faPlus} />
            Nueva Mesa
          </button>
          {dirty && (
            <button style={btnGold} onClick={handleSaveAll} disabled={saving}>
              <FontAwesomeIcon icon={faSave} />
              {saving ? 'Guardando...' : 'Guardar Posiciones'}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }} />
          Disponible
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(239,68,68,0.13)', border: '2px solid #ef4444' }} />
          Ocupada (pedido pendiente)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(212,175,55,0.15)', border: '2.5px solid #D4AF37' }} />
          Seleccionada
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: '1 1 600px',
            position: 'relative',
            width: '100%',
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            background: '#f9fafb',
            border: '1.5px solid #e5e7eb',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            backgroundPosition: '15px 15px',
            cursor: 'default'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) { setSelectedId(null); setEditForm(null); }
          }}
        >
          {loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
              Cargando mesas...
            </div>
          ) : tables.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, gap: 8 }}>
              <FontAwesomeIcon icon={faChair} style={{ fontSize: 32 }} />
              <span>No hay mesas. Haz clic en "Nueva Mesa" para agregar.</span>
            </div>
          ) : (
            tables.map(table => (
              <TableShape
                key={table.id}
                table={table}
                selected={selectedId === table.id}
                onClick={() => handleSelectTable(table.id)}
                onDragStart={(e) => handleMouseDown(e, table.id)}
              />
            ))
          )}
        </div>

        {/* Side panel */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {selectedTable && !editForm ? (
            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 8 }}>{selectedTable.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Capacidad: {selectedTable.capacity} personas</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Forma: {selectedTable.shape === 'circle' ? 'Redonda' : 'Rectangular'}</div>
              <div style={{ fontSize: 13, marginBottom: 12, color: selectedTable.occupied ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                {selectedTable.occupied ? 'Ocupada' : 'Disponible'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button style={btnGold} onClick={() => setEditForm({ label: selectedTable.label, capacity: selectedTable.capacity, w: selectedTable.w, h: selectedTable.h, shape: selectedTable.shape })}>
                  <FontAwesomeIcon icon={faEdit} />
                  Editar
                </button>
                <button style={btnDanger} onClick={() => handleDelete(selectedTable.id)}>
                  <FontAwesomeIcon icon={faTrash} />
                  Eliminar
                </button>
              </div>
            </div>
          ) : editForm ? (
            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 12 }}>Editar Mesa</div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Nombre</label>
                <input style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Capacidad</label>
                <input style={inputStyle} type="number" min="1" value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Forma</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['rect', 'circle'].map(s => (
                    <button
                      key={s}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: editForm.shape === s ? '2px solid #D4AF37' : '1px solid #d1d5db', background: editForm.shape === s ? 'rgba(212,175,55,0.1)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: editForm.shape === s ? 700 : 400, color: editForm.shape === s ? '#92740f' : '#374151' }}
                      onClick={() => setEditForm(f => ({ ...f, shape: s }))}
                    >
                      <FontAwesomeIcon icon={s === 'circle' ? faCircle : faSquare} style={{ marginRight: 4 }} />
                      {s === 'circle' ? 'Redonda' : 'Cuadrada'}
                    </button>
                  ))}
                </div>
              </div>
              {editForm.shape === 'rect' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Ancho</label>
                    <input style={inputStyle} type="number" min="60" max="300" value={editForm.w} onChange={e => setEditForm(f => ({ ...f, w: parseInt(e.target.value) || 120 }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Alto</label>
                    <input style={inputStyle} type="number" min="40" max="200" value={editForm.h} onChange={e => setEditForm(f => ({ ...f, h: parseInt(e.target.value) || 80 }))} />
                  </div>
                </div>
              )}
              {editForm.shape === 'circle' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Diámetro</label>
                  <input style={inputStyle} type="number" min="60" max="250" value={editForm.w} onChange={e => setEditForm(f => ({ ...f, w: parseInt(e.target.value) || 100 }))} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...btnGold, flex: 1 }} onClick={handleEditSave} disabled={saving}>
                  <FontAwesomeIcon icon={faSave} />
                  {saving ? '...' : 'Guardar'}
                </button>
                <button style={{ ...btnGhost, padding: '8px 12px' }} onClick={() => setEditForm(null)}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#f9fafb', border: '1.5px dashed #d1d5db', borderRadius: 12, padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Haz clic en una mesa para seleccionarla
            </div>
          )}
        </div>
      </div>

      {/* Add table modal */}
      {showAddForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nueva Mesa</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }} onClick={() => setShowAddForm(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} placeholder="Ej: Mesa 1, Barra, Terraza" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} autoFocus />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Capacidad (personas)</label>
              <input style={inputStyle} type="number" min="1" value={addForm.capacity} onChange={e => setAddForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Forma</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['rect', 'circle'].map(s => (
                  <button
                    key={s}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: addForm.shape === s ? '2px solid #D4AF37' : '1px solid #d1d5db', background: addForm.shape === s ? 'rgba(212,175,55,0.1)' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: addForm.shape === s ? 700 : 400, color: addForm.shape === s ? '#92740f' : '#374151' }}
                    onClick={() => setAddForm(f => ({ ...f, shape: s }))}
                  >
                    <FontAwesomeIcon icon={s === 'circle' ? faCircle : faSquare} style={{ marginRight: 5 }} />
                    {s === 'circle' ? 'Redonda' : 'Cuadrada'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button style={{ ...btnGhost, flex: 1, justifyContent: 'center' }} onClick={() => setShowAddForm(false)}>Cancelar</button>
              <button style={{ ...btnGold, flex: 1, justifyContent: 'center' }} onClick={handleAdd} disabled={saving || !addForm.label.trim()}>
                {saving ? 'Creando...' : 'Crear Mesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
