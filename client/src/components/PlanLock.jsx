import { useContext } from 'react';
import { StoreContext } from './Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faCrown } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';

const GOLD = '#D4AF37';

// Devuelve true si la capacidad está disponible en el plan actual.
// Mientras planCaps no cargó (null) asumimos disponible para no bloquear de más.
export function useCan(feature) {
  const { planCaps } = useContext(StoreContext) || {};
  if (!planCaps) return true;
  return !!planCaps[feature];
}

// Banner/pantalla de bloqueo por plan. Envolvé el contenido premium con esto:
//   <PlanLock feature="cctv" title="Cartelería Digital">...contenido...</PlanLock>
// Si el plan no tiene la capacidad, muestra el candado en lugar del contenido.
export default function PlanLock({ feature, title, description, children }) {
  const { planCaps } = useContext(StoreContext) || {};
  const navigate = useNavigate();
  const locked = planCaps && !planCaps[feature];

  if (!locked) return children;

  return (
    <div style={{ padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 460, width: '100%', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 16, padding: '36px 28px', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 64, height: 64, background: '#fff8e1', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <FontAwesomeIcon icon={faLock} style={{ fontSize: 26, color: GOLD }} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#09090b' }}>
          {title || 'Función premium'}
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: '#71717a', lineHeight: 1.5 }}>
          {description || 'Esta función no está disponible en el plan Gratis. Actualizá tu plan para desbloquearla.'}
        </p>
        <button onClick={() => navigate('/admin/plans')}
          style={{ background: GOLD, border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer', color: '#0a0a0a', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faCrown} />
          Actualizar mi plan
        </button>
      </div>
    </div>
  );
}
