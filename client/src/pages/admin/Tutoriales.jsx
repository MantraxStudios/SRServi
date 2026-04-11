import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen,
  faRocket,
  faStore,
  faPalette,
  faBox,
  faCreditCard,
  faTabletAlt,
  faUsers,
  faShoppingBag,
  faQuestionCircle,
  faChevronDown,
  faCheckCircle,
  faLightbulb,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const GOLD = '#D4AF37';

function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      marginBottom: '14px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '18px 22px',
          background: open ? '#fafafa' : '#fff',
          border: 'none',
          borderBottom: open ? '1px solid #e5e7eb' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '16px',
          fontWeight: '600',
          color: '#111'
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: GOLD + '22',
          color: GOLD,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0
        }}>
          <FontAwesomeIcon icon={icon} />
        </div>
        <span style={{ flex: 1 }}>{title}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          style={{
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            color: '#9ca3af'
          }}
        />
      </button>
      {open && (
        <div style={{ padding: '22px 26px', color: '#374151', lineHeight: '1.7', fontSize: '14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', marginBottom: '18px' }}>
      <div style={{
        flexShrink: 0,
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: '#000',
        color: GOLD,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        fontSize: '14px'
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '4px 0 6px', color: '#111', fontSize: '15px' }}>{title}</h4>
        <div style={{ color: '#4b5563' }}>{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      padding: '12px 14px',
      background: GOLD + '12',
      borderLeft: `3px solid ${GOLD}`,
      borderRadius: '6px',
      margin: '12px 0',
      fontSize: '13px',
      color: '#57410a'
    }}>
      <FontAwesomeIcon icon={faLightbulb} style={{ color: GOLD, marginTop: '2px' }} />
      <div><strong>Consejo:</strong> {children}</div>
    </div>
  );
}

function Warn({ children }) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      padding: '12px 14px',
      background: '#fef3c7',
      borderLeft: '3px solid #f59e0b',
      borderRadius: '6px',
      margin: '12px 0',
      fontSize: '13px',
      color: '#78350f'
    }}>
      <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#f59e0b', marginTop: '2px' }} />
      <div>{children}</div>
    </div>
  );
}

function Tutoriales() {
  return (
    <div className="admin-content-inner" style={{ maxWidth: '920px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
        color: '#fff',
        padding: '32px 28px',
        borderRadius: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: GOLD,
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          flexShrink: 0
        }}>
          <FontAwesomeIcon icon={faBookOpen} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', color: '#fff' }}>Tutoriales SRServi</h1>
          <p style={{ margin: '6px 0 0', color: '#cfcfcf', fontSize: '14px' }}>
            Aprende cómo funciona nuestro sistema de auto servicio paso a paso
          </p>
        </div>
      </div>

      {/* Intro card */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '22px 26px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <h2 style={{ margin: '0 0 10px', color: '#111', fontSize: '18px' }}>
          ¿Qué es SRServi?
        </h2>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.7', fontSize: '14px' }}>
          SRServi es una plataforma de <strong>auto servicio</strong> para tu negocio. Tus clientes hacen sus pedidos
          directamente desde un <strong>totem</strong> (tablet o pantalla táctil), pagan con tarjeta o efectivo, y el
          pedido llega automáticamente a tu cocina o punto de preparación. Tú gestionas todo desde este panel de administración.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {[
            { icon: faCheckCircle, text: 'Pedidos sin fila' },
            { icon: faCheckCircle, text: 'Cobros automáticos' },
            { icon: faCheckCircle, text: 'Menos errores' },
            { icon: faCheckCircle, text: 'Estadísticas en vivo' }
          ].map((x, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: GOLD + '15',
              color: '#57410a',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              <FontAwesomeIcon icon={x.icon} style={{ color: GOLD }} />
              {x.text}
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <Section icon={faRocket} title="1. Primeros pasos — configuración inicial" defaultOpen>
        <p>Cuando creas tu cuenta en SRServi, automáticamente se genera tu primera tienda. Desde ahí puedes empezar a configurar todo.</p>
        <Step n="1" title="Selecciona tu tienda">
          En la parte superior del menú lateral verás el selector de tienda. Si tienes varias sucursales,
          puedes cambiar entre ellas desde ahí.
        </Step>
        <Step n="2" title="Personaliza tu marca">
          Ve a <strong>Sistema → Colores y QR</strong> para cambiar los colores de tu tienda, subir tu
          logo y generar el código QR que tus clientes pueden escanear.
        </Step>
        <Step n="3" title="Configura la moneda">
          Desde <strong>Gestionar Tiendas</strong> puedes cambiar la moneda, el nombre del negocio y los
          datos generales.
        </Step>
        <Tip>Dedica los primeros minutos a dejar la identidad de la tienda lista (colores + logo). Esto cambia toda la apariencia del totem.</Tip>
      </Section>

      <Section icon={faBox} title="2. Cargar tu menú (categorías y productos)">
        <p>Antes de vender, tienes que cargar tu catálogo. Puedes hacerlo de dos formas:</p>
        <Step n="A" title="Desde el panel administrador">
          Entra a <strong>Componentes → Gestión → Productos</strong> y agrega tus items uno por uno, con
          nombre, precio, imagen y descripción.
        </Step>
        <Step n="B" title="Desde el Editor Totem (más visual)">
          Haz click en <strong>Editor Totem</strong> en el menú Principal. Se abre una vista previa en vivo
          donde puedes agregar, editar y arrastrar productos directamente como los verá el cliente.
        </Step>
        <p style={{ marginTop: '12px' }}>Puedes organizar los productos en <strong>categorías</strong> (ej: Bebidas, Hamburguesas, Postres) y agregar:</p>
        <ul style={{ marginTop: '6px' }}>
          <li><strong>Ingredientes:</strong> para que el cliente pueda quitar o personalizar.</li>
          <li><strong>Extras:</strong> agregados con costo adicional (queso extra, salsa, etc).</li>
          <li><strong>Complementos:</strong> opciones obligatorias a elegir (tamaño, tipo de pan).</li>
        </ul>
        <Tip>Usa imágenes cuadradas y claras. Los productos con foto venden hasta 3 veces más en el totem.</Tip>
      </Section>

      <Section icon={faPalette} title="3. Editor Totem — personalizar la vista del cliente">
        <p>
          El <strong>Editor Totem</strong> es una vista en vivo de cómo tus clientes verán tu tienda en la pantalla.
          Desde ahí puedes:
        </p>
        <ul>
          <li>Editar productos haciendo click sobre ellos.</li>
          <li>Reordenar categorías y productos arrastrándolos.</li>
          <li>Ver cómo quedan los colores y el logo en tiempo real.</li>
          <li>Cambiar textos y etiquetas.</li>
        </ul>
        <Tip>Abre el Editor Totem en otra pestaña mientras configuras cosas en el panel, así ves los cambios al instante.</Tip>
      </Section>

      <Section icon={faCreditCard} title="4. Vincular POS (Mercado Pago Point)">
        <p>
          Para cobrar con tarjeta en el totem necesitas vincular una <strong>POS</strong> (terminal de pago).
          Actualmente soportamos <strong>Mercado Pago Point</strong>.
        </p>
        <Step n="1" title="Ten tu Point lista">
          Asegúrate que tu terminal Mercado Pago Point esté encendida, con batería y conectada a internet
          (por WiFi o datos móviles).
        </Step>
        <Step n="2" title="Entra a Vincular POS">
          Desde el menú Principal, haz click en <strong>Vincular POS</strong>.
        </Step>
        <Step n="3" title="Genera el token de acceso">
          Sigue las instrucciones para ingresar tu token de Mercado Pago. Si no lo tienes, la pantalla te
          indicará cómo obtenerlo desde tu cuenta de Mercado Pago.
        </Step>
        <Step n="4" title="Selecciona tu dispositivo">
          Una vez vinculada la cuenta, verás la lista de tus Points disponibles. Elige la que quieras asociar a esta tienda.
        </Step>
        <Warn>
          Cada totem debe tener su propia POS asociada. Si tienes 2 totems en la misma tienda, necesitas 2 terminales Point.
        </Warn>
        <Tip>También puedes recibir pagos en efectivo, transferencia o QR si no tienes POS. Configúralos en <strong>Sistema → Config. Pago</strong>.</Tip>
      </Section>

      <Section icon={faTabletAlt} title="5. Conectar un totem (tablet o pantalla)">
        <p>
          Un totem es cualquier dispositivo con pantalla táctil que muestre tu tienda. Puede ser una tablet
          Android, un iPad, una pantalla touch, o incluso una computadora.
        </p>
        <Step n="1" title="Abre el navegador en el totem">
          En el dispositivo, abre Chrome o cualquier navegador.
        </Step>
        <Step n="2" title="Entra a la URL de tu tienda">
          Ve a <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>srservi2.srautomatic.com/store/TU_CODIGO</code>.
          Tu código de tienda aparece en el selector del menú lateral.
        </Step>
        <Step n="3" title="Pon la pantalla en modo kiosco">
          Para que el cliente no salga de la tienda, activa el <strong>modo pantalla completa</strong> (tecla F11 en PC)
          o usa una app de kiosco en Android/iPad.
        </Step>
        <Step n="4" title="Registra el dispositivo (opcional)">
          Desde <strong>Sistema → Dispositivos</strong> puedes darle un nombre a cada totem y asociarle su POS específica.
        </Step>
      </Section>

      <Section icon={faShoppingBag} title="6. Recibir y preparar pedidos">
        <p>Cuando un cliente completa un pedido en el totem:</p>
        <ol>
          <li>El pedido aparece al instante en <strong>Componentes → Gestión → Ventas → Pedidos</strong>.</li>
          <li>Tus trabajadores lo ven desde el <strong>Panel Worker</strong> (una vista simplificada para cocina).</li>
          <li>Pueden marcarlo como "En preparación", "Listo" y "Entregado".</li>
          <li>Si configuraste una pantalla de TV, el cliente ve el estado de su pedido en vivo.</li>
        </ol>
        <Tip>
          Conecta una TV a la URL <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>/tv/TU_CODIGO</code>
          para mostrar los pedidos listos en tu local.
        </Tip>
      </Section>

      <Section icon={faUsers} title="7. Gestionar trabajadores">
        <p>Puedes crear cuentas para tus empleados con acceso limitado:</p>
        <ul>
          <li><strong>Sistema → Config. Worker:</strong> configura qué permisos tiene cada rol (cocina, caja, admin).</li>
          <li><strong>Gestión → Trabajadores:</strong> crea las cuentas con usuario y contraseña.</li>
          <li>Los trabajadores entran desde <code>/worker-login</code> y solo ven lo que necesitan.</li>
        </ul>
      </Section>

      <Section icon={faStore} title="8. Ver estadísticas y crecer">
        <p>En <strong>Gestión → Análisis</strong> puedes ver en tiempo real:</p>
        <ul>
          <li>Ventas del día, semana y mes.</li>
          <li>Productos más vendidos.</li>
          <li>Horarios pico.</li>
          <li>Métodos de pago más usados.</li>
        </ul>
        <p>También puedes crear <strong>cupones de descuento</strong> desde <strong>Gestión → Cupones</strong> para promociones.</p>
      </Section>

      <Section icon={faQuestionCircle} title="Preguntas frecuentes">
        <h4 style={{ color: '#111', marginBottom: '4px' }}>¿Puedo tener varias sucursales?</h4>
        <p>Sí. Desde el selector de tienda en el menú superior puedes crear y cambiar entre múltiples tiendas.</p>

        <h4 style={{ color: '#111', marginBottom: '4px', marginTop: '16px' }}>¿Qué pasa si se cae internet?</h4>
        <p>El totem necesita internet para recibir pedidos. Si se cae, los clientes no podrán ordenar hasta que vuelva la conexión. Recomendamos un plan de datos móvil de respaldo.</p>

        <h4 style={{ color: '#111', marginBottom: '4px', marginTop: '16px' }}>¿Puedo cobrar solo en efectivo?</h4>
        <p>Sí. En <strong>Sistema → Config. Pago</strong> puedes activar o desactivar cada método de pago.</p>

        <h4 style={{ color: '#111', marginBottom: '4px', marginTop: '16px' }}>¿Necesito una computadora para administrar?</h4>
        <p>No. El panel funciona también desde el celular. Puedes gestionar pedidos, productos y ver estadísticas desde cualquier dispositivo con navegador.</p>

        <h4 style={{ color: '#111', marginBottom: '4px', marginTop: '16px' }}>¿Dónde pido ayuda si algo no funciona?</h4>
        <p>Desde <strong>Ayuda → Soporte</strong> puedes abrir un ticket y nuestro equipo te responde directamente.</p>
      </Section>

      <div style={{
        marginTop: '30px',
        padding: '22px',
        background: '#000',
        color: '#fff',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, color: '#cfcfcf' }}>
          ¿Quedó alguna duda? Escríbenos desde <strong style={{ color: GOLD }}>Ayuda → Soporte</strong> y te ayudamos a configurar tu auto servicio.
        </p>
      </div>
    </div>
  );
}

export default Tutoriales;
