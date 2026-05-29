import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const sectionStyle = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
  padding: '20px', marginBottom: 16
};
const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#fff',
  border: '1px solid #d1d5db', borderRadius: 8,
  color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'monospace'
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
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

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
    if (!clean) { setMsg({ type: 'err', text: 'Escribe un subdominio' }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${API}/api/stores/${selectedStore.id}/subdomain`, {
        method: 'POST', headers, body: JSON.stringify({ subdomain: clean })
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Error al guardar' }); return; }
      setCurrent(d.subdomain);
      setInput(d.subdomain);
      setMsg({
        type: 'ok',
        text: d.warning || `¡Subdominio registrado! URL: ${d.url}`
      });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el subdominio? La URL dejará de funcionar.')) return;
    setDeleting(true); setMsg(null);
    try {
      const r = await fetch(`${API}/api/stores/${selectedStore.id}/subdomain`, { method: 'DELETE', headers });
      if (r.ok) { setCurrent(null); setInput(''); setMsg({ type: 'ok', text: 'Subdominio eliminado' }); }
      else { const d = await r.json(); setMsg({ type: 'err', text: d.error || 'Error' }); }
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setDeleting(false); }
  };

  if (!selectedStore) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Selecciona una tienda</div>;
  }

  const previewUrl = input.replace(/[^a-z0-9-]/gi, '').toLowerCase()
    ? `https://${input.replace(/[^a-z0-9-]/gi, '').toLowerCase()}.${baseDomain}`
    : null;

  return (
    <div style={{ padding: '24px 20px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
          🌐 Subdominio de tienda
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
          Asigna un subdominio propio para tu tienda de delivery. Se configura una sola vez y queda registrado automáticamente.
        </p>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92740f' }}>
        💡 Tus clientes podrán acceder a tu tienda de delivery con una URL como:<br />
        <strong>mitienda.{baseDomain}</strong>
        <br /><br />
        <strong>Requisito:</strong> el DNS de <code>*.{baseDomain}</code> debe apuntar a este servidor (wildcard A record). Configúralo una vez en tu proveedor de DNS.
      </div>

      {/* Estado actual */}
      {current && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Subdominio activo</div>
            <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#111', marginTop: 2 }}>
              https://<strong>{current}</strong>.{baseDomain}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`https://${current}.${baseDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
            >
              Abrir →
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{current ? 'Cambiar subdominio' : 'Nuevo subdominio'}</label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
          <div style={{
            padding: '10px 12px', background: '#f3f4f6', border: '1px solid #d1d5db',
            borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 13, color: '#6b7280',
            whiteSpace: 'nowrap'
          }}>
            https://
          </div>
          <input
            style={{ ...inputStyle, borderRadius: 0, flex: 1 }}
            placeholder="mitienda"
            value={input}
            maxLength={40}
            onChange={e => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <div style={{
            padding: '10px 12px', background: '#f3f4f6', border: '1px solid #d1d5db',
            borderLeft: 'none', borderRadius: '0 8px 8px 0', fontSize: 13, color: '#6b7280',
            whiteSpace: 'nowrap'
          }}>
            .{baseDomain}
          </div>
        </div>

        {previewUrl && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, fontFamily: 'monospace' }}>
            Vista previa: <span style={{ color: '#111' }}>{previewUrl}</span>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
          Solo letras minúsculas, números y guiones. Mínimo 3 caracteres.
        </div>

        {msg && (
          <div style={{
            background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: msg.type === 'ok' ? '#15803d' : '#dc2626',
            marginBottom: 12
          }}>
            {msg.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || loading || !input}
          style={{
            background: '#D4AF37', border: 'none', borderRadius: 10,
            padding: '10px 24px', cursor: saving ? 'not-allowed' : 'pointer',
            color: '#000', fontWeight: 700, fontSize: 13,
            opacity: saving || !input ? 0.6 : 1
          }}
        >
          {saving ? 'Registrando...' : current ? 'Cambiar subdominio' : 'Registrar subdominio'}
        </button>
      </div>

      {/* DNS Setup */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 12 }}>
          ⚙️ Configuración de DNS requerida
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
          Agrega estos registros en tu proveedor de DNS para que los subdominios funcionen:
        </p>
        <div style={{ background: '#1e1e1e', borderRadius: 8, padding: '14px 16px', fontFamily: 'monospace', fontSize: 13, color: '#d4d4d4' }}>
          <div style={{ color: '#9ca3af', marginBottom: 4 }}># Wildcard (cubre todos los subdominios)</div>
          <div><span style={{ color: '#569cd6' }}>Tipo:</span> A</div>
          <div><span style={{ color: '#569cd6' }}>Nombre:</span> *</div>
          <div><span style={{ color: '#569cd6' }}>Valor:</span> {'<IP del servidor>'}</div>
          <div style={{ marginTop: 8, color: '#9ca3af' }}># También el dominio raíz si lo necesitas</div>
          <div><span style={{ color: '#569cd6' }}>Tipo:</span> A</div>
          <div><span style={{ color: '#569cd6' }}>Nombre:</span> @</div>
          <div><span style={{ color: '#569cd6' }}>Valor:</span> {'<IP del servidor>'}</div>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '10px 0 0' }}>
          Esto se hace una sola vez. Luego cada tienda registra su subdominio desde aquí y queda activo automáticamente.
        </p>
      </div>

      {/* SSL Note */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#0369a1' }}>
        🔒 <strong>SSL/HTTPS:</strong> Para habilitar HTTPS en los subdominios, el servidor necesita un certificado wildcard (<code>*.{baseDomain}</code>). Configura las variables de entorno <code>WILDCARD_CERT</code> y <code>WILDCARD_KEY</code> apuntando al certificado.
        Para obtenerlo: <code>certbot certonly --dns-cloudflare -d *.{baseDomain}</code>
      </div>
    </div>
  );
}
