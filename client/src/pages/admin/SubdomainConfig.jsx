import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://mantraxtools.store';

const sectionStyle = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
  padding: '20px', marginBottom: 16
};
const inputStyle = {
  padding: '10px 12px', background: '#fff',
  border: '1px solid #d1d5db', borderRadius: 8,
  color: '#111', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'monospace', flex: 1, minWidth: 0
};
const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block', fontWeight: 500 };

function getBaseDomain() {
  try { return new URL(API).hostname.split('.').slice(1).join('.'); }
  catch { return 'srautomatic.com'; }
}

export default function SubdomainConfig() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [current, setCurrent] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState(null);

  const baseDomain = getBaseDomain();

  const load = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/stores/${selectedStore.id}/subdomain`, { headers });
      if (r.ok) {
        const d = await r.json();
        setCurrent(d.subdomain || null);
        setInput(d.subdomain || '');
      }
    } finally { setLoading(false); }
  }, [selectedStore, token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const clean = input.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!clean || clean.length < 3) { setMsg({ type: 'err', text: 'Mínimo 3 caracteres (solo letras, números y guiones)' }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${API}/api/stores/${selectedStore.id}/subdomain`, {
        method: 'POST', headers, body: JSON.stringify({ subdomain: clean })
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Error al registrar' }); return; }
      setCurrent(d.subdomain);
      setInput(d.subdomain);
      if (d.nginx?.ssl) {
        setMsg({ type: 'ok', text: `✅ Listo con HTTPS. Tu URL: ${d.url}` });
      } else if (d.nginx?.ok) {
        setMsg({ type: 'warn', text: `⚠️ Registrado sin HTTPS por ahora. URL: http://${d.subdomain}.${baseDomain} — El SSL se activará cuando el DNS esté propagado.` });
      } else {
        setMsg({ type: 'warn', text: d.warning || `Registrado. URL: ${d.url}` });
      }
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el subdominio? La URL dejará de funcionar.')) return;
    setDeleting(true); setMsg(null);
    try {
      const r = await fetch(`${API}/api/stores/${selectedStore.id}/subdomain`, { method: 'DELETE', headers });
      if (r.ok) { setCurrent(null); setInput(''); setMsg({ type: 'ok', text: 'Subdominio eliminado.' }); }
      else { const d = await r.json(); setMsg({ type: 'err', text: d.error || 'Error' }); }
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setDeleting(false); }
  };

  if (!selectedStore) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Selecciona una tienda</div>;
  }

  const preview = input.replace(/[^a-z0-9-]/gi, '').toLowerCase();

  return (
    <div style={{ padding: '24px 20px', maxWidth: 580, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
          🌐 Subdominio propio
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
          Asigna una URL personalizada a tu tienda de delivery. El servidor configura nginx y el SSL automáticamente.
        </p>
      </div>

      {/* Estado activo */}
      {current && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>Subdominio activo</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#111' }}>
              https://<strong>{current}</strong>.{baseDomain}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`https://${current}.${baseDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
              >
                Abrir ↗
              </a>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {deleting ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{current ? 'Cambiar subdominio' : 'Elige tu subdominio'}</label>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{
            padding: '10px 12px', background: '#f3f4f6', border: '1px solid #d1d5db',
            borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 13, color: '#9ca3af',
            whiteSpace: 'nowrap', flexShrink: 0
          }}>https://</div>
          <input
            style={{ ...inputStyle, borderRadius: 0, borderRight: 'none' }}
            placeholder="mitienda"
            value={input}
            maxLength={40}
            onChange={e => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
          />
          <div style={{
            padding: '10px 12px', background: '#f3f4f6', border: '1px solid #d1d5db',
            borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#9ca3af',
            whiteSpace: 'nowrap', flexShrink: 0
          }}>.{baseDomain}</div>
        </div>

        {preview.length >= 3 && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, fontFamily: 'monospace' }}>
            URL resultante: <span style={{ color: '#111', fontWeight: 600 }}>https://{preview}.{baseDomain}</span>
          </div>
        )}

        {msg && (
          <div style={{
            background: msg.type === 'ok' ? '#f0fdf4' : msg.type === 'warn' ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : msg.type === 'warn' ? '#fde68a' : '#fecaca'}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: msg.type === 'ok' ? '#15803d' : msg.type === 'warn' ? '#92400e' : '#dc2626',
            marginBottom: 12, lineHeight: 1.5
          }}>
            {msg.text}
          </div>
        )}

        {saving && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0369a1', marginBottom: 12 }}>
            ⏳ Configurando nginx y obteniendo certificado SSL... esto puede tardar hasta 60 segundos.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || loading || preview.length < 3}
          style={{
            background: '#D4AF37', border: 'none', borderRadius: 10,
            padding: '10px 24px', cursor: (saving || preview.length < 3) ? 'not-allowed' : 'pointer',
            color: '#000', fontWeight: 700, fontSize: 13,
            opacity: (saving || preview.length < 3) ? 0.6 : 1
          }}
        >
          {saving ? 'Registrando...' : current ? 'Actualizar subdominio' : 'Activar subdominio'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
        El servidor configura todo automáticamente: nginx + SSL (Let's Encrypt). Solo letras, números y guiones. Mínimo 3 caracteres.
      </div>
    </div>
  );
}
