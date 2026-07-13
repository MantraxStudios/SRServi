import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCashRegister, faTruck, faBoxesStacked, faChartLine, faRobot, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import SalesChat from '../components/SalesChat';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@800;900&family=Inter:wght@300;400;500;600;700&display=swap');
  .sa-root { font-family: 'Inter', sans-serif; min-height: 100vh; background: #0f0f10; color: #fff; }
  .sa-hero { max-width: 980px; margin: 0 auto; padding: 70px 22px 40px; text-align: center; }
  .sa-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(212,175,55,.14); color: #D4AF37; border: 1px solid rgba(212,175,55,.4); padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .sa-h1 { font-family: 'Playfair Display', serif; font-size: clamp(32px, 6vw, 56px); font-weight: 900; margin: 22px 0 16px; line-height: 1.1; }
  .sa-h1 span { background: linear-gradient(135deg, #D4AF37, #f0d67a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .sa-sub { font-size: clamp(15px, 2.5vw, 19px); color: #b8b8bd; max-width: 640px; margin: 0 auto 30px; line-height: 1.6; }
  .sa-cta { display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .sa-btn { border: none; cursor: pointer; padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 700; }
  .sa-btn-primary { background: linear-gradient(135deg, #D4AF37, #b8941f); color: #1a1a1a; }
  .sa-btn-ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.25); }
  .sa-grid { max-width: 980px; margin: 20px auto 70px; padding: 0 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  .sa-card { background: #17171a; border: 1px solid #26262b; border-radius: 16px; padding: 24px; }
  .sa-card-icon { width: 46px; height: 46px; border-radius: 12px; background: rgba(212,175,55,.14); color: #D4AF37; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 14px; }
  .sa-card h3 { font-size: 17px; margin: 0 0 8px; }
  .sa-card p { font-size: 14px; color: #a0a0a6; line-height: 1.55; margin: 0; }
  .sa-plans { max-width: 980px; margin: 0 auto 80px; padding: 0 22px; text-align: center; }
  .sa-plans h2 { font-family: 'Playfair Display', serif; font-size: 30px; margin-bottom: 26px; }
  .sa-plan-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
  .sa-plan { background: #17171a; border: 1px solid #26262b; border-radius: 16px; padding: 24px; text-align: left; }
  .sa-plan.pop { border-color: #D4AF37; box-shadow: 0 0 0 1px #D4AF37; }
  .sa-plan .name { font-size: 15px; color: #D4AF37; font-weight: 700; }
  .sa-plan .price { font-size: 34px; font-weight: 800; margin: 6px 0 2px; }
  .sa-plan .price small { font-size: 14px; color: #a0a0a6; font-weight: 400; }
  .sa-plan ul { list-style: none; padding: 0; margin: 16px 0 0; }
  .sa-plan li { font-size: 13.5px; color: #cfcfd4; margin-bottom: 9px; display: flex; gap: 8px; align-items: flex-start; }
  .sa-plan li svg { color: #22c55e; margin-top: 3px; flex-shrink: 0; }
`;

const FEATURES = [
  { icon: faCashRegister, t: 'Punto de venta', d: 'POS en Android y web, cobra con Mercado Pago, Transbank, TUU o SumUp.' },
  { icon: faTruck, t: 'Pedidos y delivery', d: 'Recibe pedidos en mesa y delivery, con pantalla de cocina y TV de órdenes.' },
  { icon: faBoxesStacked, t: 'Inventario', d: 'Control de stock, alertas y combos. Sabe qué se vende y qué se queda.' },
  { icon: faChartLine, t: 'León IA', d: 'Un asistente que analiza tus ventas y te dice cómo ganar más cada día.' },
];

const PLANS = [
  { name: 'Gratis', price: '0', per: '', feats: ['Hasta 2 tiendas', 'Punto de venta', 'Gestión de productos'], pop: false },
  { name: 'SOLO', price: '11', per: '/mes', feats: ['Hasta 10 tiendas', 'Logo y colores propios', 'Multi-tienda', 'Soporte prioritario'], pop: true },
  { name: 'Empresas', price: '25', per: '/mes', feats: ['Hasta 25 tiendas', '5 impresoras Bluetooth', 'Personalización', 'Soporte prioritario'], pop: false },
  { name: 'Personalizado', price: '99', per: '/mes', feats: ['Funciones a medida', '10 impresoras', 'Atención directa con desarrollo'], pop: false },
];

export default function SalesAssistant() {
  const navigate = useNavigate();
  return (
    <div className="sa-root">
      <style>{styles}</style>

      <section className="sa-hero">
        <div className="sa-badge"><FontAwesomeIcon icon={faRobot} /> Asistente de ventas con IA</div>
        <h1 className="sa-h1">Digitaliza tu negocio con <span>SRServi</span></h1>
        <p className="sa-sub">
          Punto de venta, pedidos, inventario y delivery en una sola plataforma.
          Habla con Sofía, nuestra asesora con IA: te muestra cómo funciona y te ayuda a empezar en minutos.
        </p>
        <div className="sa-cta">
          <button className="sa-btn sa-btn-primary" onClick={() => navigate('/register')}>Empezar gratis</button>
          <button className="sa-btn sa-btn-ghost" onClick={() => document.querySelector('.sc-fab')?.click()}>Hablar con Sofía</button>
        </div>
      </section>

      <div className="sa-grid">
        {FEATURES.map(f => (
          <div className="sa-card" key={f.t}>
            <div className="sa-card-icon"><FontAwesomeIcon icon={f.icon} /></div>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </div>
        ))}
      </div>

      <section className="sa-plans">
        <h2>Planes simples y transparentes</h2>
        <div className="sa-plan-row">
          {PLANS.map(p => (
            <div className={'sa-plan' + (p.pop ? ' pop' : '')} key={p.name}>
              <div className="name">{p.name}</div>
              <div className="price">US${p.price}<small>{p.per}</small></div>
              <ul>
                {p.feats.map(f => <li key={f}><FontAwesomeIcon icon={faCircleCheck} />{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <SalesChat source="asistente" autoOpen />
    </div>
  );
}
