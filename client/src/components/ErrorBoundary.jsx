import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleReload = () => {
    if ('caches' in window) {
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
        .then(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 340, padding: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: '#1a1a1a',
              border: '1px solid rgba(212,175,55,0.3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              fontSize: 24,
            }}>
              ⚠️
            </div>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              Algo salió mal
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              Hubo un error al cargar la página. Esto suele pasar cuando hay una actualización nueva.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: '12px 32px', background: 'linear-gradient(135deg, #D4AF37, #b8972e)',
                border: 'none', borderRadius: 10, color: '#0a0a0a', fontWeight: 700,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
