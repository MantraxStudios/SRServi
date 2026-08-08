import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// Página pública de postulación de trabajo. Se llega escaneando el QR de la
// tienda (/trabajo/:code). El cliente completa el formulario y postula.
export default function JobApplication() {
  const { code } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', position: '',
    age: '', experience: '', availability: '', message: '',
  });

  useEffect(() => {
    fetch(`/api/public/${code}/job-info`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok && d.store) setStore(d.store); else setError(d.error || 'Tienda no encontrada'); })
      .catch(() => setError('Error al cargar la tienda'))
      .finally(() => setLoading(false));
  }, [code]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Escribe tu nombre'); return; }
    if (!form.phone.trim() && !form.email.trim()) { setError('Deja un teléfono o correo de contacto'); return; }
    setSending(true);
    try {
      const r = await fetch(`/api/public/${code}/job-application`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar');
      setDone(true);
    } catch (e2) { setError(e2.message); }
    finally { setSending(false); }
  };

  const accent = store?.accent_color || '#D4AF37';
  const primary = store?.primary_color || '#0f172a';
  const name = store?.name || '';

  const S = {
    page: { minHeight: '100dvh', background: `linear-gradient(160deg, ${primary}, #0b1220)`, color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
    label: { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#cbd5e1', margin: '12px 0 5px' },
    input: { width: '100%', padding: '12px 13px', background: 'rgba(0,0,0,0.25)', border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: 11, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn: { width: '100%', marginTop: 20, padding: 15, background: accent, color: '#111', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1 },
    err: { background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginTop: 12 },
  };

  if (loading) return <div style={{ ...S.page, justifyContent: 'center' }}><div style={{ width: 44, height: 44, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: accent, borderRadius: '50%', animation: 'jspin 0.8s linear infinite' }} /><style>{'@keyframes jspin{to{transform:rotate(360deg)}}'}</style></div>;

  if (error && !store) return <div style={{ ...S.page, justifyContent: 'center', textAlign: 'center' }}><div style={S.card}><div style={{ fontSize: 40, marginBottom: 10 }}>🚫</div><p style={{ color: '#fca5a5' }}>{error}</p></div></div>;

  if (done) return (
    <div style={{ ...S.page, justifyContent: 'center', textAlign: 'center' }}>
      <div style={S.card}>
        <div style={{ fontSize: 54, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>¡Postulación enviada!</h2>
        <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.5 }}>Gracias por postular a <strong style={{ color: accent }}>{name}</strong>. Revisaremos tu información y te contactaremos si avanzas en el proceso.</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ textAlign: 'center', marginBottom: 18, marginTop: 10 }}>
        {store?.logo_url
          ? <img src={store.logo_url} alt={name} style={{ width: 84, height: 84, borderRadius: 18, objectFit: 'contain', border: `3px solid ${accent}`, background: '#fff' }} />
          : <div style={{ width: 84, height: 84, borderRadius: 18, background: accent, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, margin: '0 auto' }}>{name[0]?.toUpperCase() || '★'}</div>}
        <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 12 }}>{name}</h1>
        <p style={{ color: accent, fontSize: 15, fontWeight: 700, marginTop: 2 }}>Trabaja con nosotros</p>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Completá tus datos y postulá al equipo</p>
      </div>

      <form style={S.card} onSubmit={submit}>
        <label style={S.label}>Nombre completo *</label>
        <input style={S.input} value={form.name} onChange={set('name')} placeholder="Tu nombre y apellido" required />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Teléfono</label>
            <input style={S.input} value={form.phone} onChange={set('phone')} placeholder="+56 9 ..." inputMode="tel" />
          </div>
          <div style={{ width: 90 }}>
            <label style={S.label}>Edad</label>
            <input style={S.input} value={form.age} onChange={set('age')} placeholder="Ej: 24" inputMode="numeric" />
          </div>
        </div>

        <label style={S.label}>Correo</label>
        <input style={S.input} value={form.email} onChange={set('email')} placeholder="tucorreo@mail.com" inputMode="email" type="email" />

        <label style={S.label}>¿A qué puesto postulás?</label>
        <input style={S.input} value={form.position} onChange={set('position')} placeholder="Ej: Cajero, cocina, garzón..." />

        <label style={S.label}>Disponibilidad</label>
        <input style={S.input} value={form.availability} onChange={set('availability')} placeholder="Ej: Full time, fines de semana, tardes..." />

        <label style={S.label}>Experiencia</label>
        <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} value={form.experience} onChange={set('experience')} placeholder="Contanos tu experiencia previa" />

        <label style={S.label}>Mensaje (opcional)</label>
        <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.message} onChange={set('message')} placeholder="¿Algo más que quieras contarnos?" />

        {error && <div style={S.err}>{error}</div>}

        <button style={S.btn} type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar postulación'}</button>
      </form>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1, marginTop: 16 }}>Powered by SRAutomatic.cl</p>
    </div>
  );
}
