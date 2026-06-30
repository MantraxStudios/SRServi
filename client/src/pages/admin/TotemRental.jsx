import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STATUS_LABELS = {
  pending_payment: { label: 'Pendiente de pago', color: '#f59e0b', bg: '#fffbeb' },
  pending_install: { label: 'Pago recibido — En espera de instalación', color: '#3b82f6', bg: '#eff6ff' },
  active:          { label: 'Activo', color: '#10b981', bg: '#ecfdf5' },
  suspended:       { label: 'Suspendido', color: '#6b7280', bg: '#f9fafb' },
  cancelled:       { label: 'Cancelado', color: '#ef4444', bg: '#fef2f2' },
};

const CLP = v => `$${Number(v).toLocaleString('es-CL')}`;

export default function TotemRental() {
  const location = useLocation();
  const navigate = useNavigate();
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('status'); // status | form | paying
  const [form, setForm] = useState({ contact_name: '', contact_phone: '', address: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') setPaymentMsg('success');
    else if (params.get('payment') === 'failure') setPaymentMsg('failure');
    loadRental();
  }, []);

  async function loadRental() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/totem-rental', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRental(data);
    } catch {}
    setLoading(false);
  }

  async function handleRequest(e) {
    e.preventDefault();
    if (!form.contact_name || !form.contact_phone || !form.address) {
      setFormError('Por favor completa todos los campos obligatorios'); return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/totem-rental/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Error al enviar solicitud'); setSubmitting(false); return; }
      await loadRental();
      setStep('status');
    } catch { setFormError('Error de conexión'); }
    setSubmitting(false);
  }

  async function handlePay() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/totem-rental/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al crear pago'); setSubmitting(false); return; }
      window.location.href = data.init_point;
    } catch { alert('Error de conexión'); setSubmitting(false); }
  }

  const cardStyle = {
    background: '#fff', borderRadius: 16, padding: '28px 24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20
  };

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: '#111' }}>
        🖥️ Arriendo de Tótem
      </h2>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>
        Instala un tótem de autoservicio en tu local con cargo mensual automático.
      </p>

      {paymentMsg === 'success' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#065f46', fontWeight: 600 }}>
          ✅ Pago recibido con éxito. Te contactaremos para coordinar la instalación.
        </div>
      )}
      {paymentMsg === 'failure' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontWeight: 600 }}>
          ❌ El pago no se pudo procesar. Intenta nuevamente.
        </div>
      )}

      {/* Info boxes */}
      {!rental && step === 'status' && (
        <>
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, color: '#111' }}>¿Qué incluye el arriendo?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['🖥️', 'Pantalla táctil', 'Tótem táctil de alta calidad para autoatención'],
                ['⚙️', 'Instalación incluida', 'Nuestro equipo va a instalar y configurar el equipo'],
                ['🔄', 'Cobro automático', 'Cargo mensual a tu tarjeta sin trámites manuales'],
                ['🛠️', 'Soporte técnico', 'Asistencia remota y visitas técnicas si es necesario'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#92400e' }}>Cuota de instalación (una vez)</span>
              <span style={{ fontWeight: 900, fontSize: 20, color: '#C8A415' }}>$150.000 CLP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#92400e' }}>Arriendo mensual</span>
              <span style={{ fontWeight: 900, fontSize: 20, color: '#C8A415' }}>$50.000 CLP/mes</span>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#92400e' }}>
              * El cobro mensual se realiza automáticamente a través de Mercado Pago.
            </p>
          </div>

          <button
            onClick={() => setStep('form')}
            style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#C8A415', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
          >
            Solicitar tótem
          </button>
        </>
      )}

      {/* Request form */}
      {!rental && step === 'form' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 20px', fontSize: 17, color: '#111' }}>Datos para la instalación</h3>
          <form onSubmit={handleRequest}>
            {[
              { key: 'contact_name', label: 'Nombre de contacto *', placeholder: 'Ej: Juan Pérez', type: 'text' },
              { key: 'contact_phone', label: 'Teléfono de contacto *', placeholder: '+56 9 XXXX XXXX', type: 'tel' },
              { key: 'address', label: 'Dirección de instalación *', placeholder: 'Calle, número, ciudad', type: 'text' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: 14 }}>{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: 14 }}>Notas adicionales</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Horario disponible para instalación, piso, referencias del lugar..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            {formError && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
                {formError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep('status')} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Volver
              </button>
              <button type="submit" disabled={submitting} style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: submitting ? '#d1d5db' : '#C8A415', color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Enviando...' : 'Continuar al pago'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing rental status */}
      {rental && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              padding: '5px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13,
              color: STATUS_LABELS[rental.status]?.color || '#374151',
              background: STATUS_LABELS[rental.status]?.bg || '#f3f4f6'
            }}>
              {STATUS_LABELS[rental.status]?.label || rental.status}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              ['Contacto', rental.contact_name],
              ['Teléfono', rental.contact_phone],
              ['Dirección', rental.address],
              ['Instalación', rental.installation_fee ? CLP(rental.installation_fee) : '—'],
              ['Mensual', rental.monthly_fee ? `${CLP(rental.monthly_fee)}/mes` : '—'],
              ['Fecha solicitud', new Date(rental.created_at).toLocaleDateString('es-CL')],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 14, color: '#111', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>

          {rental.notes && (
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Notas</div>
              <div style={{ fontSize: 14, color: '#374151' }}>{rental.notes}</div>
            </div>
          )}

          {rental.status === 'pending_payment' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', color: '#92400e', fontWeight: 600, fontSize: 14 }}>
                Para confirmar tu solicitud, paga la cuota de instalación de <strong>{CLP(rental.installation_fee)}</strong>.
                Una vez confirmado el pago, nuestro equipo coordinará la instalación.
              </p>
              <button
                onClick={handlePay}
                disabled={submitting}
                style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: submitting ? '#d1d5db' : '#C8A415', color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Redirigiendo...' : `Pagar instalación — ${CLP(rental.installation_fee)}`}
              </button>
            </div>
          )}

          {rental.status === 'pending_install' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px', color: '#1e40af' }}>
              <strong>✅ Pago recibido.</strong> Nuestro equipo te contactará para coordinar la instalación del tótem en tu local.
            </div>
          )}

          {rental.status === 'active' && (
            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '16px 18px', color: '#065f46' }}>
              <strong>🖥️ Tótem activo.</strong> Tu equipo está instalado y funcionando. El cobro mensual de <strong>{CLP(rental.monthly_fee)}</strong> se realiza automáticamente.
              {rental.installed_at && <div style={{ marginTop: 6, fontSize: 12 }}>Instalado el {new Date(rental.installed_at).toLocaleDateString('es-CL')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
