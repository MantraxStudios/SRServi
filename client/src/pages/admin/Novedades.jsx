import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faWrench, faStar, faArrowUp } from '@fortawesome/free-solid-svg-icons';

const BADGE_CFG = {
  nuevo:    { label: 'Nuevo',    bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  mejorado: { label: 'Mejorado', bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  reparado: { label: 'Reparado', bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b' },
};

const CHANGE_CFG = {
  nuevo:    { icon: '✦', color: '#3b82f6' },
  mejorado: { icon: '▲', color: '#10b981' },
  reparado: { icon: '⬤', color: '#f59e0b' },
};

export default function Novedades() {
  const { token } = useAuth();
  const [updates, setUpdates]   = useState([]);
  const [lastSeen, setLastSeen] = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/updates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setUpdates(data.updates || []);
        setLastSeen(data.last_seen_id || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark all as seen when opening the page
    fetch('/api/updates/mark-seen', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [token]);

  if (loading) return (
    <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={styles.spinner} />
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          <FontAwesomeIcon icon={faBell} style={{ color: '#D4AF37', fontSize: 20 }} />
        </div>
        <div>
          <h1 style={styles.title}>Novedades del sistema</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Actualizaciones, mejoras y correcciones de SRServi
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {Object.entries(BADGE_CFG).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 19, top: 0, bottom: 0,
          width: 2, background: '#e5e7eb', zIndex: 0,
        }} />

        {updates.map((update, idx) => {
          const isUnread = update.id > lastSeen;
          const badgeCfg = BADGE_CFG[update.badge] || BADGE_CFG.nuevo;
          const isLatest = idx === 0;

          return (
            <div key={update.id} style={{ display: 'flex', gap: 20, marginBottom: 32, position: 'relative', zIndex: 1 }}>
              {/* Circle on timeline */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: isUnread ? '#1e293b' : '#f1f5f9',
                border: `3px solid ${isUnread ? '#D4AF37' : '#e5e7eb'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isUnread ? '0 0 0 4px rgba(212,175,55,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 14 }}>
                  {isLatest ? '🔔' : update.badge === 'reparado' ? '🔧' : update.badge === 'mejorado' ? '⬆' : '✦'}
                </span>
              </div>

              {/* Card */}
              <div style={{
                flex: 1,
                background: '#fff',
                borderRadius: 16,
                border: `1.5px solid ${isUnread ? '#D4AF3755' : '#e5e7eb'}`,
                boxShadow: isUnread ? '0 4px 20px rgba(212,175,55,0.12)' : '0 1px 6px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '14px 18px',
                  background: isUnread ? 'linear-gradient(135deg, #1e293b, #0f172a)' : '#fafafa',
                  borderBottom: `1px solid ${isUnread ? '#ffffff11' : '#e5e7eb'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                      color: isUnread ? '#D4AF37' : '#6b7280',
                      background: isUnread ? 'rgba(212,175,55,0.15)' : '#f1f5f9',
                      padding: '3px 10px', borderRadius: 20,
                    }}>
                      v{update.version}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: badgeCfg.color, background: badgeCfg.bg,
                      padding: '3px 9px', borderRadius: 20,
                    }}>
                      {badgeCfg.label}
                    </span>
                    {isUnread && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#fff',
                        background: '#ef4444', padding: '2px 8px', borderRadius: 20,
                        letterSpacing: '0.5px',
                      }}>NUEVO</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: isUnread ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
                    {new Date(update.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {/* Card body */}
                <div style={{ padding: '14px 18px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                    {update.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {update.changes.map((ch, i) => {
                      const chCfg = CHANGE_CFG[ch.type] || CHANGE_CFG.nuevo;
                      return (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{
                            fontSize: 9, color: chCfg.color, marginTop: 4, flexShrink: 0,
                            width: 16, textAlign: 'center', fontWeight: 900,
                          }}>{chCfg.icon}</span>
                          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{ch.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page:    { padding: '28px 24px', maxWidth: 760, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title:   { fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 },
  spinner: { width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};
