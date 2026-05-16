export default function PrivacyPolicy() {
  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <div style={s.logo}>SR</div>
          <div>
            <h1 style={s.title}>Política de Privacidad</h1>
            <p style={s.subtitle}>SRServi — SRAutomatic SpA · Última actualización: enero 2025</p>
          </div>
        </div>

        <Section title="1. Información general">
          <P>SRAutomatic SpA ("nosotros", "la empresa") opera la plataforma SRServi disponible en <strong>srservi2.srautomatic.com</strong>. Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos la información personal de nuestros usuarios.</P>
          <P>Al usar SRServi aceptás esta política. Si no estás de acuerdo, por favor no uses la plataforma.</P>
        </Section>

        <Section title="2. Información que recopilamos">
          <P>Recopilamos la siguiente información cuando usás SRServi:</P>
          <ul style={s.list}>
            <li><strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña (cifrada), información de tu negocio.</li>
            <li><strong>Datos de la tienda:</strong> nombre, logo, productos, precios, órdenes y configuraciones.</li>
            <li><strong>Datos de uso:</strong> actividad dentro de la plataforma, dirección IP, tipo de dispositivo y navegador.</li>
            <li><strong>Credenciales de redes sociales:</strong> tokens de acceso OAuth de Instagram y TikTok (nunca almacenamos tu contraseña de estas plataformas).</li>
          </ul>
        </Section>

        <Section title="3. Uso de la información">
          <P>Usamos tu información exclusivamente para:</P>
          <ul style={s.list}>
            <li>Operar y mejorar la plataforma SRServi.</li>
            <li>Publicar contenido en redes sociales en tu nombre, solo cuando vos lo autorizás mediante OAuth.</li>
            <li>Enviarte notificaciones relacionadas con tu cuenta y tu negocio.</li>
            <li>Cumplir con obligaciones legales.</li>
          </ul>
          <P><strong>No vendemos, alquilamos ni compartimos tu información personal con terceros</strong> con fines publicitarios o comerciales.</P>
        </Section>

        <Section title="4. Integración con Instagram (Meta)">
          <P>SRServi se integra con Instagram a través de la API oficial de Meta para publicar imágenes promocionales de tu negocio. Al conectar tu cuenta de Instagram:</P>
          <ul style={s.list}>
            <li>Accedemos únicamente a los permisos que vos autorizás explícitamente.</li>
            <li>Los tokens de acceso se almacenan de forma cifrada en nuestros servidores.</li>
            <li>Solo publicamos contenido cuando vos lo solicitás manualmente o según la programación que configuraste.</li>
            <li>Podés desconectar tu cuenta de Instagram en cualquier momento desde el panel de SRServi.</li>
            <li>Cumplimos con la <a href="https://developers.facebook.com/policy/" style={s.link} target="_blank" rel="noreferrer">Política de la Plataforma de Meta</a>.</li>
          </ul>
        </Section>

        <Section title="5. Integración con TikTok">
          <P>SRServi se integra con TikTok a través de la API oficial de TikTok for Developers para publicar contenido promocional de tu negocio. Al conectar tu cuenta de TikTok:</P>
          <ul style={s.list}>
            <li>Accedemos únicamente a los permisos que vos autorizás: información básica del perfil y publicación de contenido.</li>
            <li>Los tokens OAuth se almacenan de forma segura y nunca se comparten con terceros.</li>
            <li>Solo publicamos contenido cuando vos lo solicitás o según la programación configurada.</li>
            <li>Podés revocar el acceso en cualquier momento desde el panel de SRServi o directamente en la configuración de tu cuenta TikTok.</li>
            <li>Cumplimos con los <a href="https://www.tiktok.com/legal/page/global/terms-of-service/es" style={s.link} target="_blank" rel="noreferrer">Términos de Servicio de TikTok</a> y las políticas de su plataforma para desarrolladores.</li>
          </ul>
        </Section>

        <Section title="6. Almacenamiento y seguridad">
          <P>Tus datos se almacenan en servidores seguros. Implementamos medidas técnicas y organizativas para proteger tu información, incluyendo cifrado en tránsito (HTTPS/TLS) y en reposo para datos sensibles como contraseñas y tokens de acceso.</P>
          <P>Ningún sistema es 100% seguro. En caso de una brecha de seguridad que afecte tus datos, te notificaremos según lo exija la ley aplicable.</P>
        </Section>

        <Section title="7. Retención de datos">
          <P>Conservamos tu información mientras tu cuenta esté activa. Si eliminás tu cuenta, eliminaremos tus datos personales dentro de los 30 días siguientes, salvo que la ley exija conservarlos por un período mayor.</P>
        </Section>

        <Section title="8. Tus derechos">
          <P>Tenés derecho a:</P>
          <ul style={s.list}>
            <li>Acceder, corregir o eliminar tu información personal.</li>
            <li>Revocar el acceso de SRServi a tus cuentas de redes sociales en cualquier momento.</li>
            <li>Solicitar la portabilidad de tus datos.</li>
            <li>Presentar una queja ante la autoridad de protección de datos de tu país.</li>
          </ul>
          <P>Para ejercer estos derechos, contactanos en: <a href="mailto:privacidad@srautomatic.com" style={s.link}>privacidad@srautomatic.com</a></P>
        </Section>

        <Section title="9. Cookies">
          <P>Usamos cookies estrictamente necesarias para el funcionamiento de la sesión. No usamos cookies de seguimiento de terceros.</P>
        </Section>

        <Section title="10. Cambios a esta política">
          <P>Podemos actualizar esta política periódicamente. Te notificaremos por correo electrónico o mediante un aviso en la plataforma ante cambios significativos. El uso continuado de SRServi después del aviso implica aceptación de la política actualizada.</P>
        </Section>

        <Section title="11. Contacto">
          <P>Si tenés preguntas sobre esta Política de Privacidad, contactanos:</P>
          <ul style={s.list}>
            <li><strong>Empresa:</strong> SRAutomatic SpA</li>
            <li><strong>Sitio web:</strong> srservi2.srautomatic.com</li>
            <li><strong>Email:</strong> <a href="mailto:privacidad@srautomatic.com" style={s.link}>privacidad@srautomatic.com</a></li>
          </ul>
        </Section>

        <div style={s.footer}>
          <a href="/" style={s.link}>← Volver a SRServi</a>
          <span style={{ color: '#9ca3af', margin: '0 12px' }}>·</span>
          <a href="/terms" style={s.link}>Términos y Condiciones</a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 12px', borderBottom: '2px solid #f1f5f9', paddingBottom: 8 }}>{title}</h2>
      {children}
    </div>
  );
}

function P({ children }) {
  return <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: '0 0 10px' }}>{children}</p>;
}

const s = {
  page:      { minHeight: '100vh', background: '#f8fafc', padding: '40px 16px', fontFamily: 'system-ui,-apple-system,sans-serif' },
  container: { maxWidth: 780, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 48px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  header:    { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40, paddingBottom: 24, borderBottom: '2px solid #f1f5f9' },
  logo:      { width: 56, height: 56, background: '#D4AF37', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#0a0a0a', flexShrink: 0 },
  title:     { fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle:  { fontSize: 13, color: '#6b7280', margin: '4px 0 0' },
  list:      { fontSize: 14, color: '#374151', lineHeight: 1.9, margin: '8px 0 10px', paddingLeft: 20 },
  link:      { color: '#D4AF37', textDecoration: 'none', fontWeight: 600 },
  footer:    { marginTop: 48, paddingTop: 24, borderTop: '1px solid #f1f5f9', fontSize: 14, color: '#6b7280' },
};
