import { useState, useEffect } from 'react';

const ROWS_LOWER = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['CAPS','z','x','c','v','b','n','m','⌫'],
];
const ROWS_UPPER = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['CAPS','Z','X','C','V','B','N','M','⌫'],
];
const ROWS_NUMS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['-','/','.',',',':',';','(',')','$','@'],
  ['ABC','#','%','^','&','*','!','?','⌫'],
];

export default function VirtualKeyboard({ value, onChange, onClose, placeholder = '' }) {
  const [caps, setCaps] = useState(false);
  const [numMode, setNumMode] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const press = (key) => {
    if (key === 'CAPS') { setCaps(c => !c); return; }
    if (key === 'ABC') { setNumMode(false); return; }
    if (key === '123') { setNumMode(true); return; }
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === 'SPACE') { onChange(value + ' '); return; }
    if (key === 'ENTER') { handleClose(); return; }
    const char = caps && !numMode ? key.toUpperCase() : key;
    onChange(value + char);
  };

  const rows = numMode ? ROWS_NUMS : (caps ? ROWS_UPPER : ROWS_LOWER);

  const baseKey = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '16px', fontWeight: '700', userSelect: 'none',
    transition: 'all 0.08s ease', flex: 1, minWidth: 0,
    height: '48px', padding: '0 2px',
  };

  const normalKey = {
    ...baseKey,
    background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
    color: '#fff',
    boxShadow: '0 2px 0 #000, 0 3px 6px rgba(0,0,0,0.4)',
  };

  const specialKey = {
    ...baseKey,
    background: 'linear-gradient(180deg, #D4AF37 0%, #b8942a 100%)',
    color: '#000',
    boxShadow: '0 2px 0 #7a6010, 0 3px 6px rgba(0,0,0,0.4)',
    fontSize: '13px',
  };

  const backKey = {
    ...baseKey,
    background: 'linear-gradient(180deg, #3a3a3a 0%, #272727 100%)',
    color: '#D4AF37',
    boxShadow: '0 2px 0 #000, 0 3px 6px rgba(0,0,0,0.4)',
    fontSize: '18px',
    flex: 1.5,
  };

  const renderKey = (key) => {
    if (key === '⌫') return (
      <button key={key} style={backKey} onMouseDown={e => { e.preventDefault(); press(key); }}>⌫</button>
    );
    if (key === 'CAPS') return (
      <button key={key} style={{ ...specialKey, flex: 1.5, background: caps ? 'linear-gradient(180deg, #D4AF37 0%, #b8942a 100%)' : 'linear-gradient(180deg, #3a3a3a 0%, #272727 100%)', color: caps ? '#000' : '#D4AF37' }}
        onMouseDown={e => { e.preventDefault(); press(key); }}>
        ⬆
      </button>
    );
    if (key === 'ABC') return (
      <button key={key} style={{ ...specialKey, flex: 1.5 }} onMouseDown={e => { e.preventDefault(); press(key); }}>ABC</button>
    );
    return (
      <button key={key} style={normalKey} onMouseDown={e => { e.preventDefault(); press(key); }}>{key}</button>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* backdrop */}
      <div
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
      />

      {/* keyboard panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
        borderRadius: '20px 20px 0 0',
        padding: '12px 8px 20px',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.6)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.22s cubic-bezier(.32,.72,.0,1)',
      }}>

        {/* drag handle */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px', margin: '0 auto' }} />
        </div>

        {/* text preview */}
        <div style={{
          background: '#1a1a1a', borderRadius: '12px',
          padding: '10px 14px', marginBottom: '10px',
          border: '1.5px solid #D4AF37',
          display: 'flex', alignItems: 'center', gap: '8px', minHeight: '46px'
        }}>
          <span style={{ color: '#666', fontSize: '13px', whiteSpace: 'nowrap' }}>{placeholder || 'Texto'}:</span>
          <span style={{
            flex: 1, color: value ? '#fff' : '#444', fontSize: '18px',
            fontWeight: value ? '700' : '400', letterSpacing: '2px',
            textTransform: 'uppercase', wordBreak: 'break-all'
          }}>
            {value || <span style={{ color: '#333' }}>|</span>}
          </span>
          {value && (
            <button
              onMouseDown={e => { e.preventDefault(); onChange(''); }}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
            >✕</button>
          )}
        </div>

        {/* rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
              {row.map(renderKey)}
            </div>
          ))}

          {/* bottom row */}
          <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
            <button
              style={{ ...specialKey, flex: 1.2, fontSize: '13px' }}
              onMouseDown={e => { e.preventDefault(); setNumMode(m => !m); }}
            >
              {numMode ? 'ABC' : '123'}
            </button>
            <button
              style={{ ...normalKey, flex: 5, fontSize: '14px', letterSpacing: '1px', color: '#aaa' }}
              onMouseDown={e => { e.preventDefault(); press('SPACE'); }}
            >
              espacio
            </button>
            <button
              style={{ ...specialKey, flex: 2, fontSize: '13px' }}
              onMouseDown={e => { e.preventDefault(); press('ENTER'); }}
            >
              OK ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
