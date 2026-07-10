import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi3.srautomatic.com';

const card = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 12
};
const btn = (color = '#D4AF37', text = '#000') => ({
  background: color, border: 'none', borderRadius: 8, padding: '8px 16px',
  cursor: 'pointer', color: text, fontWeight: 700, fontSize: 13
});
const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none'
};
const label = { fontSize: 12, color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: 4 };

const emptyForm = { name: '', email: '', password: '', role_id: '', is_active: true };

export default function SubAccounts() {
  const { token } = useAuth();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [accounts, setAccounts]  = useState([]);
  const [roles, setRoles]        = useState([]);
  const [modal, setModal]        = useState(null); // null | 'new' | account object
  const [form, setForm]          = useState(emptyForm);
  const [saving, setSaving]      = useState(false);
  const [deleting, setDeleting]  = useState(null);
  const [showPass, setShowPass]  = useState(false);
  const [revealedId, setRevealedId] = useState(null); // id of account whose pass is visible
  const [error, setError]        = useState('');

  const load = useCallback(async () => {
    const [ra, rr] = await Promise.all([
      fetch(`${API}/api/admin/sub-accounts`, { headers }),
      fetch(`${API}/api/admin/roles`, { headers })
    ]);
    if (ra.ok) setAccounts(await ra.json());
    if (rr.ok) setRoles(await rr.json());
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setError('');
    setModal('new');
  };

  const openEdit = (acc) => {
    setForm({ name: acc.name, email: acc.email, password: '', role_id: acc.role_id || '', is_active: acc.is_active });
    setError('');
    setModal(acc);
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim()) { setError('Nombre y email son requeridos'); return; }
    if (modal === 'new' && !form.password) { setError('La contraseña es requerida'); return; }
    setSaving(true);
    try {
      const isNew = modal === 'new';
      const body  = { ...form, role_id: form.role_id || null };
      if (!isNew && !body.password) delete body.password;
      const url   = isNew ? `${API}/api/admin/sub-accounts` : `${API}/api/admin/sub-accounts/${modal.id}`;
      const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Error al guardar'); return; }
      await load();
      setModal(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (acc) => {
    if (!confirm(`¿Eliminar la cuenta de "${acc.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(acc.id);
    try {
      const r = await fetch(`${API}/api/admin/sub-accounts/${acc.id}`, { method: 'DELETE', headers });
      if (r.ok) await load();
      else { const d = await r.json(); alert(d.error || 'Error'); }
    } finally { setDeleting(null); }
  };

  const roleName = (id) => roles.find(r => r.id === id)?.name || '—';

  return (
    <div style={{ padding: '24px 20px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>👤 Cuentas de equipo</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Crea cuentas para tu equipo y asígnales un rol con sus permisos.</p>
        </div>
        <button onClick={openNew} style={{ ...btn(), padding: '10px 20px' }}>+ Nueva cuenta</button>
      </div>

      {roles.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          ⚠️ Primero crea al menos un <strong>Rol</strong> desde la sección de Roles para poder asignarlo a las cuentas.
        </div>
      )}

      {accounts.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>Sin cuentas todavía</div>
          <div style={{ fontSize: 13 }}>Crea una cuenta para un miembro de tu equipo.</div>
        </div>
      ) : (
        accounts.map(acc => (
          <div key={acc.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, flexShrink: 0,
              background: acc.is_active ? '#D4AF37' : '#e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 18, color: acc.is_active ? '#000' : '#9ca3af'
            }}>
              {acc.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{acc.name}</span>
                {!acc.is_active && (
                  <span style={{ background: '#f3f4f6', color: '#9ca3af', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                    INACTIVA
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{acc.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Rol: <span style={{ color: acc.role_id ? '#D4AF37' : '#9ca3af', fontWeight: 600 }}>
                    {acc.role_id ? roleName(acc.role_id) : 'Sin rol'}
                  </span>
                </span>
                {acc.plain_password && (
                  <>
                    <span style={{ color: '#e5e7eb' }}>·</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Clave:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: revealedId === acc.id ? '#111' : 'transparent',
                      textShadow: revealedId === acc.id ? 'none' : '0 0 6px #6b7280',
                      background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', userSelect: revealedId === acc.id ? 'text' : 'none',
                      letterSpacing: revealedId === acc.id ? 0 : '0.1em' }}>
                      {acc.plain_password}
                    </span>
                    <button
                      onClick={() => setRevealedId(revealedId === acc.id ? null : acc.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                      title={revealedId === acc.id ? 'Ocultar' : 'Mostrar contraseña'}
                    >{revealedId === acc.id ? '🙈' : '👁'}</button>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => openEdit(acc)} style={{ ...btn('#f3f4f6', '#374151'), padding: '7px 14px' }}>Editar</button>
              <button
                onClick={() => handleDelete(acc)}
                disabled={deleting === acc.id}
                style={{ ...btn('#fee2e2', '#dc2626'), padding: '7px 14px' }}
              >
                {deleting === acc.id ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>
              {modal === 'new' ? 'Nueva cuenta' : `Editar: ${modal.name}`}
            </h2>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={label}>Nombre completo *</label>
                <input style={inputStyle} placeholder="Juan Pérez" value={form.name} onChange={e => f('name', e.target.value)} />
              </div>
              <div>
                <label style={label}>Email *</label>
                <input style={inputStyle} type="email" placeholder="juan@mitienda.com" value={form.email} onChange={e => f('email', e.target.value)} />
              </div>
              <div>
                <label style={label}>{modal === 'new' ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 40 }}
                    type={showPass ? 'text' : 'password'}
                    placeholder={modal === 'new' ? 'Mínimo 6 caracteres' : '••••••••'}
                    value={form.password}
                    onChange={e => f('password', e.target.value)}
                  />
                  <button
                    onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14 }}
                  >{showPass ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div>
                <label style={label}>Rol asignado</label>
                <select
                  style={{ ...inputStyle, background: '#fff' }}
                  value={form.role_id}
                  onChange={e => f('role_id', e.target.value ? parseInt(e.target.value) : '')}
                >
                  <option value="">Sin rol (sin acceso al panel)</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.description ? ` — ${r.description}` : ''}</option>)}
                </select>
              </div>
              {modal !== 'new' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => f('is_active', !form.is_active)}
                    style={{
                      width: 42, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
                      background: form.is_active ? '#D4AF37' : '#e5e7eb', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: form.is_active ? 21 : 3, width: 18, height: 18,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.2s'
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Cuenta activa</span>
                </label>
              )}

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btn(), padding: '10px 20px', flex: 1 }}>
                  {saving ? 'Guardando...' : modal === 'new' ? 'Crear cuenta' : 'Guardar cambios'}
                </button>
                <button onClick={() => setModal(null)} style={{ ...btn('#f3f4f6', '#374151'), padding: '10px 16px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
