import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faStore, faCheckCircle, faTimesCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';

// Página de resultado de pago para pedidos de delivery pagados con MercadoPago.
// MercadoPago (auto_return) redirige aquí en vez de volver al store, así el
// cliente ve su número de orden y la información del pago de forma confiable
// (en iPhone volver al store fallaba con "Load failed" y no mostraba el número).
export default function DeliveryPaymentResult() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get('order');
  const storeId = searchParams.get('store_id');
  const storeName = searchParams.get('store') || 'Tienda';
  const mpResult = searchParams.get('mp_result'); // success | failure | pending

  const [status, setStatus] = useState('checking'); // checking | approved | failed | pending
  const [orderData, setOrderData] = useState(null);
  const handledRef = useRef(false);
  const downloadedRef = useRef(false);

  const downloadReceiptPng = useCallback((orderNum, total) => {
    if (!orderNum) return;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 600, 800);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 560, 760);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('COMPROBANTE DE PAGO', 300, 130);

    ctx.fillStyle = '#D4AF37';
    const orderText = '#' + orderNum;
    let fontSize = 220;
    ctx.font = `bold ${fontSize}px Arial`;
    while (ctx.measureText(orderText).width > 480 && fontSize > 60) {
      fontSize -= 10;
      ctx.font = `bold ${fontSize}px Arial`;
    }
    ctx.fillText(orderText, 300, 420);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(storeName, 300, 580);

    if (total) {
      ctx.font = 'bold 32px Arial';
      ctx.fillText('$' + total, 300, 640);
    }

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('PAGO CONFIRMADO', 300, 700);

    const link = document.createElement('a');
    link.download = `pedido-${orderNum}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }, [storeName]);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (!orderId || !storeId) {
      setStatus('failed');
      return;
    }
    if (mpResult === 'failure') {
      setStatus('failed');
      return;
    }

    let attempts = 0;
    const check = async () => {
      attempts++;
      try {
        // Reintento resiliente: Safari iOS suele lanzar "Load failed" en el
        // primer fetch tras volver de una redirección externa (MercadoPago).
        const res = await fetch(`/api/orders/${orderId}/payment-status?store_id=${storeId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'approved' || data.mp_status === 'approved') {
            setOrderData(data.order || null);
            setStatus('approved');
            return;
          }
        }
      } catch { /* reintenta */ }
      if (attempts < 12) {
        setTimeout(check, 2500);
      } else {
        setStatus(mpResult === 'pending' ? 'pending' : 'failed');
      }
    };
    check();
  }, [orderId, storeId, mpResult]);

  // Descarga automática del comprobante al confirmarse el pago
  useEffect(() => {
    if (status === 'approved' && orderData?.order_number && !downloadedRef.current) {
      downloadedRef.current = true;
      downloadReceiptPng(orderData.order_number, orderData.total);
    }
  }, [status, orderData, downloadReceiptPng]);

  const goToStore = () => navigate(`/store/${code}?delivery=true`);

  const wrap = {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  };
  const card = {
    background: '#0d0d0d',
    border: '4px solid #D4AF37',
    borderRadius: '20px',
    padding: '32px 24px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center'
  };
  const btn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '16px',
    borderRadius: '14px',
    fontSize: '17px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    marginTop: '14px'
  };

  return (
    <div style={wrap}>
      <div style={card}>
        {status === 'checking' && (
          <>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '48px', color: '#D4AF37' }} />
            <h2 style={{ marginTop: '20px' }}>Confirmando tu pago…</h2>
            <p style={{ color: '#aaa' }}>Esto puede tardar unos segundos.</p>
          </>
        )}

        {status === 'approved' && (
          <>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '54px', color: '#22c55e' }} />
            <h2 style={{ marginTop: '16px', color: '#22c55e' }}>¡Pago confirmado!</h2>
            <p style={{ color: '#ccc', margin: '4px 0 18px' }}>{storeName}</p>

            <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>Tu número de orden</p>
            <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#D4AF37', lineHeight: 1.1 }}>
              #{orderData?.order_number || orderId}
            </div>

            {orderData?.total && (
              <p style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '10px' }}>
                Total pagado: ${orderData.total}
              </p>
            )}
            <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
              Método de pago: MercadoPago
            </p>

            <button
              style={{ ...btn, background: '#D4AF37', color: '#000' }}
              onClick={() => downloadReceiptPng(orderData?.order_number || orderId, orderData?.total)}
            >
              <FontAwesomeIcon icon={faDownload} /> Descargar comprobante
            </button>
            <button
              style={{ ...btn, background: '#1a1a1a', color: '#D4AF37', border: '2px solid #D4AF37' }}
              onClick={goToStore}
            >
              <FontAwesomeIcon icon={faStore} /> Volver a la tienda
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <FontAwesomeIcon icon={faSpinner} style={{ fontSize: '48px', color: '#D4AF37' }} />
            <h2 style={{ marginTop: '16px' }}>Pago en proceso</h2>
            <p style={{ color: '#aaa' }}>
              Tu pago está siendo procesado. Guarda tu número de orden:
            </p>
            <div style={{ fontSize: '56px', fontWeight: 'bold', color: '#D4AF37' }}>#{orderId}</div>
            <button
              style={{ ...btn, background: '#1a1a1a', color: '#D4AF37', border: '2px solid #D4AF37' }}
              onClick={goToStore}
            >
              <FontAwesomeIcon icon={faStore} /> Volver a la tienda
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '54px', color: '#ef4444' }} />
            <h2 style={{ marginTop: '16px', color: '#ef4444' }}>No se pudo confirmar el pago</h2>
            <p style={{ color: '#aaa' }}>
              Si el dinero fue descontado, contacta a la tienda con tu comprobante de MercadoPago.
            </p>
            <button
              style={{ ...btn, background: '#D4AF37', color: '#000' }}
              onClick={goToStore}
            >
              <FontAwesomeIcon icon={faStore} /> Volver a la tienda
            </button>
          </>
        )}
      </div>
    </div>
  );
}
