export default function TermsConditions() {
  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <div style={s.logo}><img src="/iconweb.png" alt="SR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div>
            <h1 style={s.title}>Términos y Condiciones</h1>
            <p style={s.subtitle}>SRServi — SRAutomatic SpA · Última actualización: enero 2025</p>
          </div>
        </div>

        <Section title="1. Aceptación de los términos">
          <P>Al acceder y usar la plataforma SRServi, disponible en <strong>srservi2.srautomatic.com</strong>, aceptás estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguno de estos términos, no uses la plataforma.</P>
          <P>SRAutomatic SpA se reserva el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia al publicarse en esta página.</P>
        </Section>

        <Section title="2. Descripción del servicio">
          <P>SRServi es una plataforma de gestión de negocios que permite a los comercios:</P>
          <ul style={s.list}>
            <li>Gestionar productos, categorías, pedidos y empleados.</li>
            <li>Aceptar pagos y configurar métodos de cobro.</li>
            <li>Publicar contenido promocional en redes sociales (Instagram, TikTok) de forma automática o manual.</li>
            <li>Mostrar menús digitales y pantallas de cocina.</li>
            <li>Acceder a análisis y reportes de ventas.</li>
          </ul>
        </Section>

        <Section title="3. Cuentas de usuario">
          <P>Para usar SRServi debés crear una cuenta. Sos responsable de:</P>
          <ul style={s.list}>
            <li>Mantener la confidencialidad de tu contraseña.</li>
            <li>Toda la actividad que ocurra bajo tu cuenta.</li>
            <li>Notificarnos de inmediato ante cualquier uso no autorizado de tu cuenta.</li>
          </ul>
          <P>Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.</P>
        </Section>

        <Section title="4. Uso de la plataforma">
          <P>Te comprometés a usar SRServi únicamente para fines legítimos y comerciales lícitos. Está <strong>prohibido</strong>:</P>
          <ul style={s.list}>
            <li>Usar la plataforma para actividades ilegales o fraudulentas.</li>
            <li>Publicar contenido que viole derechos de terceros, sea ofensivo o ilegal.</li>
            <li>Intentar acceder sin autorización a sistemas o datos de otros usuarios.</li>
            <li>Realizar ingeniería inversa, copiar o distribuir el software de SRServi.</li>
            <li>Usar la plataforma para enviar spam o contenido no solicitado.</li>
          </ul>
        </Section>

        <Section title="5. Integración con Instagram (Meta)">
          <P>SRServi utiliza la API de Meta para permitirte publicar contenido en Instagram desde la plataforma. Al conectar tu cuenta de Instagram:</P>
          <ul style={s.list}>
            <li>Autorizás a SRServi a publicar imágenes en tu nombre según tu configuración.</li>
            <li>Sos responsable del contenido que se publica en tu cuenta.</li>
            <li>Debés cumplir con los <a href="https://help.instagram.com/581066165581870" style={s.link} target="_blank" rel="noreferrer">Términos de uso de Instagram</a> y las <a href="https://developers.facebook.com/policy/" style={s.link} target="_blank" rel="noreferrer">Políticas de la Plataforma de Meta</a>.</li>
            <li>Podés revocar el acceso en cualquier momento desde el panel de SRServi.</li>
          </ul>
        </Section>

        <Section title="6. Integración con TikTok">
          <P>SRServi utiliza la API oficial de TikTok for Developers para publicar contenido en TikTok desde la plataforma. Al conectar tu cuenta de TikTok:</P>
          <ul style={s.list}>
            <li>Autorizás a SRServi a publicar fotos y videos en tu nombre según tu configuración.</li>
            <li>Sos responsable de que el contenido publicado cumpla con las <a href="https://www.tiktok.com/community-guidelines" style={s.link} target="_blank" rel="noreferrer">Directrices de la Comunidad de TikTok</a> y sus <a href="https://www.tiktok.com/legal/page/global/terms-of-service/es" style={s.link} target="_blank" rel="noreferrer">Términos de Servicio</a>.</li>
            <li>SRServi accede únicamente a los permisos necesarios para la funcionalidad de publicación.</li>
            <li>Podés revocar el acceso en cualquier momento desde el panel de SRServi o desde la configuración de tu cuenta TikTok.</li>
          </ul>
        </Section>

        <Section title="7. Propiedad intelectual">
          <P>Todo el contenido y software de SRServi es propiedad de SRAutomatic SpA y está protegido por las leyes de propiedad intelectual. No se otorga ninguna licencia para copiar, modificar o distribuir el software.</P>
          <P>El contenido que vos cargás (logos, imágenes, descripciones de productos) sigue siendo de tu propiedad. Nos otorgás una licencia limitada para usarlo dentro de la plataforma con el fin de prestar el servicio.</P>
        </Section>

        <Section title="8. Planes, pagos y política de NO devoluciones">
          <P>SRServi ofrece planes gratuitos y de pago. Los términos, precios y límites de cada plan (por ejemplo, la cantidad máxima de tiendas) se detallan en la plataforma al momento de la contratación y pueden variar según el plan.</P>
          <P><strong>Todos los pagos son finales y NO reembolsables.</strong> Una vez confirmado un pago o activada una suscripción, <strong>no habrá devoluciones</strong> de dinero, totales ni parciales, por ningún motivo, incluyendo —sin limitarse a— falta de uso, cancelación anticipada, cambio de opinión, cierre de la cuenta o del negocio, o desconocimiento de las funciones contratadas. Al confirmar el pago, el cliente <strong>renuncia expresamente a cualquier reclamo, contracargo o solicitud de reembolso</strong>, en la máxima medida permitida por la ley aplicable.</P>
          <P>Las suscripciones pueden renovarse de forma periódica según el ciclo elegido (mensual o anual). Es responsabilidad del cliente cancelar antes de la renovación si no desea continuar; los períodos ya pagados no se reembolsan.</P>
          <P>Cualquier promoción, descuento o bonificación (por ejemplo, descuentos por primer período) aplica únicamente en las condiciones y por el tiempo indicado, no es acumulable salvo indicación expresa, y no genera derecho a devolución del monto descontado ni del precio regular.</P>
        </Section>

        <Section title="9. Cambios de precios, planes y uso — sujetos a no reclamos">
          <P>SRAutomatic SpA <strong>se reserva el derecho de modificar en cualquier momento</strong> los precios, los planes, los límites, las funciones, las integraciones y las condiciones de uso de la plataforma, así como de agregar, cambiar o discontinuar cualquier funcionalidad, con o sin previo aviso.</P>
          <P><strong>Dichos cambios están sujetos a "no reclamos":</strong> el cliente acepta que las modificaciones de precios o de uso no dan derecho a reclamo, indemnización ni devolución alguna. El uso continuado de la plataforma después de un cambio implica la aceptación del mismo. Si el cliente no está de acuerdo con un cambio, su único recurso es dejar de usar el servicio y no renovar su suscripción.</P>
          <P>Los precios vigentes son los publicados en la plataforma. Los cambios de precio no afectan el período ya pagado, pero sí aplicarán a las renovaciones posteriores.</P>
        </Section>

        <Section title="10. Plan gratuito (sujeto a aprobación)">
          <P>El plan gratuito es limitado y no se otorga de forma automática: requiere el envío de una solicitud justificando su necesidad, la cual queda <strong>sujeta a revisión y aprobación</strong> por parte de SRServi. Nos reservamos el derecho de aprobar, rechazar, limitar o revocar el plan gratuito a nuestra entera discreción, sin expresión de causa y sin que ello genere derecho a reclamo.</P>
        </Section>

        <Section title="11. Procesadores de pago de terceros">
          <P>Los cobros a los clientes finales del comercio pueden realizarse a través de proveedores externos (por ejemplo, Mercado Pago, Transbank, TUU, SumUp u otros). SRServi no almacena datos sensibles de tarjetas y no es responsable de las políticas, comisiones, retenciones, disponibilidad o resolución de disputas de dichos procesadores, que se rigen por sus propios términos.</P>
          <P>El comercio es el único responsable frente a sus clientes por los productos y servicios que vende, por la emisión de comprobantes y por el cumplimiento de sus obligaciones tributarias y legales.</P>
        </Section>

        <Section title="12. Disponibilidad, datos y respaldos">
          <P>SRServi se provee "tal cual" y "según disponibilidad". No garantizamos que la plataforma esté disponible de forma ininterrumpida ni libre de errores. Podremos realizar mantenimientos, actualizaciones o suspensiones temporales del servicio.</P>
          <P>Aunque procuramos resguardar la información, el cliente es responsable de mantener sus propios respaldos de la información que considere crítica. No garantizamos la recuperación de datos ante fallas, errores del usuario o cierre de la cuenta.</P>
        </Section>

        <Section title="13. Limitación de responsabilidad">
          <P>En ningún caso SRAutomatic SpA será responsable por daños indirectos, incidentales, especiales o consecuentes (incluyendo lucro cesante, pérdida de datos o de oportunidades) derivados del uso o de la imposibilidad de uso de la plataforma.</P>
          <P>En la máxima medida permitida por la ley, la responsabilidad total de SRAutomatic SpA por cualquier reclamo relacionado con el servicio se limitará al monto efectivamente pagado por el cliente en los últimos 30 días.</P>
          <P>No somos responsables por el contenido publicado en redes sociales a través de integraciones de terceros (Instagram, TikTok) ni por cambios en las APIs de dichas plataformas que afecten la funcionalidad.</P>
        </Section>

        <Section title="14. Indemnización">
          <P>El cliente acepta mantener indemne a SRAutomatic SpA, sus directores y empleados, frente a cualquier reclamo, pérdida o gasto (incluidos honorarios legales) que surja del uso indebido de la plataforma, de la violación de estos términos o de la infracción de derechos de terceros.</P>
        </Section>

        <Section title="15. Fuerza mayor">
          <P>SRAutomatic SpA no será responsable por incumplimientos o demoras causados por hechos fuera de su control razonable, tales como cortes de energía o de internet, fallas de proveedores, ataques informáticos, desastres naturales o actos de autoridad.</P>
        </Section>

        <Section title="16. Privacidad">
          <P>El uso de SRServi está sujeto a nuestra <a href="/privacy-policy" style={s.link}>Política de Privacidad</a>, que forma parte integral de estos Términos y Condiciones.</P>
        </Section>

        <Section title="17. Terminación">
          <P>Podemos suspender o cancelar tu acceso a SRServi en cualquier momento si violás estos términos, sin previo aviso y sin responsabilidad hacia vos, y sin derecho a devolución de los montos pagados.</P>
          <P>Podés cancelar tu cuenta en cualquier momento contactándonos. Tras la cancelación, tus datos serán eliminados conforme a nuestra Política de Privacidad; los períodos ya pagados no se reembolsan.</P>
        </Section>

        <Section title="18. Modificaciones a estos términos">
          <P>Podemos modificar estos Términos y Condiciones en cualquier momento. La versión vigente es la publicada en esta página. El uso continuado de la plataforma tras la publicación de cambios implica su aceptación. Es responsabilidad del cliente revisar periódicamente esta página.</P>
        </Section>

        <Section title="19. Ley aplicable">
          <P>Estos términos se rigen por las leyes de la República de Chile. Cualquier disputa se resolverá en los tribunales competentes de Santiago de Chile.</P>
        </Section>

        <Section title="20. Contacto">
          <P>Para consultas sobre estos Términos y Condiciones:</P>
          <ul style={s.list}>
            <li><strong>Empresa:</strong> SRAutomatic SpA</li>
            <li><strong>Sitio web:</strong> srservi2.srautomatic.com</li>
            <li><strong>Email:</strong> <a href="mailto:legal@srautomatic.com" style={s.link}>legal@srautomatic.com</a></li>
          </ul>
        </Section>

        <div style={s.footer}>
          <a href="/" style={s.link}>← Volver a SRServi</a>
          <span style={{ color: '#9ca3af', margin: '0 12px' }}>·</span>
          <a href="/privacy-policy" style={s.link}>Política de Privacidad</a>
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
