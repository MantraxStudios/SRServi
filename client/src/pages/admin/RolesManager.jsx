import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SECTIONS, ACTION_LABELS, buildEmptyPermissions, buildFullPermissions } from '../../config/roles';

const API = 'https://srservi2.srautomatic.com';

const card = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16
};
const btn = (color = '#D4AF37', text = '#000') => ({
  background: color, border: 'none', borderRadius: 8, padding: '8px 16px',
  cursor: 'pointer', color: text, fontWeight: 700, fontSize: 13
});

const GROUPS = [...new Set(SECTIONS.map(s => s.group))];

export default function RolesManager() {
  const { token } = useAuth();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | role object
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: buildEmptyPermissions() });

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/roles`, { headers });
    if (r.ok) setRoles(await r.json());
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ name: '', description: '', permissions: buildEmptyPermissions() });
    setEditing('new');
  };

  const openEdit = (role) => {
    const base = buildEmptyPermissions();
    const merged = { ...base };
    for (const [sec, actions] of Object.entries(role.permissions || {})) {
      if (merged[sec]) merged[sec] = { ...merged[sec], ...actions };
    }
    setForm({ name: role.name, description: role.description || '', permissions: merged });
    setEditing(role);
  };

  const togglePerm = (section, action) => {
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [section]: { ...f.permissions[section], [action]: !f.permissions[section]?.[action] }
      }
    }));
  };

  const toggleSection = (section) => {
    const sec = SECTIONS.find(s => s.key === section);
    const allOn = sec.actions.every(a => form.permissions[section]?.[a]);
    setForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [section]: Object.fromEntries(sec.actions.map(a => [a, !allOn]))
      }
    }));
  };

  const toggleAll = (on) => {
    setForm(f => ({ ...f, permissions: on ? buildFullPermissions() : buildEmptyPermissions() }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const url   = isNew ? `${API}/api/admin/roles` : `${API}/api/admin/roles/${editing.id}`;
      const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Error'); return; }
      await load();
      setEditing(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (role) => {
    if (!confirm(`¿Eliminar rol "${role.name}"?`)) return;
    setDeleting(role.id);
    try {
      const r = await fetch(`${API}/api/admin/roles/${role.id}`, { method: 'DELETE', headers });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Error'); return; }
      await load();
    } finally { setDeleting(null); }
  };

  if (editing) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 780, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setEditing(null)} style={{ ...btn('#f3f4f6', '#374151'), padding: '8px 12px' }}>← Volver</button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {editing === 'new' ? 'Nuevo rol' : `Editar: ${editing.name}`}
          </h1>
        </div>

        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre del rol *</label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Supervisor, Cajero..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>Descripción</label>
              <input
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* Permissions grid */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Permisos por sección</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleAll(true)} style={{ ...btn('#f0fdf4', '#15803d'), padding: '6px 12px', fontSize: 12 }}>Activar todo</button>
              <button onClick={() => toggleAll(false)} style={{ ...btn('#fef2f2', '#dc2626'), padding: '6px 12px', fontSize: 12 }}>Desactivar todo</button>
            </div>
          </div>

          {GROUPS.map(group => (
            <div key={group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {group}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {SECTIONS.filter(s => s.group === group).map(sec => {
                  const allOn = sec.actions.every(a => form.permissions[sec.key]?.[a]);
                  return (
                    <div key={sec.key} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: allOn ? 'rgba(212,175,55,0.04)' : '#fafafa',
                      border: `1px solid ${allOn ? 'rgba(212,175,55,0.3)' : '#e5e7eb'}`,
                      borderRadius: 8
                    }}>
                      <span style={{ minWidth: 18, textAlign: 'center' }}>{sec.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: '#111' }}>{sec.label}</span>
                      {/* Section toggle */}
                      <button
                        onClick={() => toggleSection(sec.key)}
                        style={{
                          background: allOn ? '#D4AF37' : '#f3f4f6',
                          border: 'none', borderRadius: 6, padding: '4px 10px',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          color: allOn ? '#000' : '#6b7280'
                        }}
                      >{allOn ? 'Todo' : 'Nada'}</button>
                      {/* Per-action toggles */}
                      {sec.actions.map(action => {
                        const active = form.permissions[sec.key]?.[action] === true;
                        return (
                          <label key={action} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
                            <div
                              onClick={() => togglePerm(sec.key, action)}
                              style={{
                                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                background: active ? '#D4AF37' : '#f3f4f6',
                                border: active ? 'none' : '1.5px solid #d1d5db',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              {active && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 12, color: active ? '#111' : '#9ca3af' }}>{ACTION_LABELS[action]}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ ...btn(), padding: '10px 24px' }}>
            {saving ? 'Guardando...' : 'Guardar rol'}
          </button>
          <button onClick={() => setEditing(null)} style={{ ...btn('#f3f4f6', '#374151'), padding: '10px 20px' }}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>🔐 Roles</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Define qué puede ver y hacer cada rol en el panel.</p>
        </div>
        <button onClick={openNew} style={{ ...btn(), padding: '10px 20px' }}>+ Nuevo rol</button>
      </div>

      {roles.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin roles todavía</div>
          <div style={{ fontSize: 13 }}>Crea un rol para asignárselo a tus cuentas.</div>
        </div>
      ) : (
        roles.map(role => (
          <div key={role.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{role.name}</div>
              {role.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{role.description}</div>}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                {role.accounts_count} {role.accounts_count === 1 ? 'cuenta asignada' : 'cuentas asignadas'} ·{' '}
                {Object.values(role.permissions || {}).filter(p => Object.values(p).some(Boolean)).length} secciones activas
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(role)} style={{ ...btn('#f3f4f6', '#374151'), padding: '7px 14px' }}>Editar</button>
              <button
                onClick={() => handleDelete(role)}
                disabled={deleting === role.id || role.accounts_count > 0}
                title={role.accounts_count > 0 ? 'Hay cuentas usando este rol' : ''}
                style={{ ...btn('#fee2e2', '#dc2626'), padding: '7px 14px', opacity: role.accounts_count > 0 ? 0.4 : 1 }}
              >
                {deleting === role.id ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
