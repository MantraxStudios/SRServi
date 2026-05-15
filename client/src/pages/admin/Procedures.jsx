import { useEffect, useState, useRef } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList, faPlus, faEdit, faTrash, faBrain,
  faImage, faSave, faTimes, faChevronUp, faChevronDown,
  faSpinner, faArrowLeft, faLightbulb, faGripLines,
  faEye, faEyeSlash, faCheck, faTable, faPrint, faSearch
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const emptyStep = () => ({ title: '', instruction: '', tip: '', image_url: '' });

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : API + url;
}

/* ── Zona de imagen de un paso ── */
function ImageSearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&action=process&json=1&fields=product_name,image_url&page_size=30`
      );
      const data = await res.json();
      setResults((data.products || []).filter(p => p.image_url));
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Buscar imagen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#aaa', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Ej: tomate, queso, mayonesa..."
            autoFocus
            style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 14, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = GOLD}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          <button onClick={search} disabled={loading}
            style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Buscar'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Buscando imágenes...</div>}
          {!loading && searched && !results.length && (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Sin resultados para "{query}"</div>
          )}
          {!loading && !searched && (
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>
              <FontAwesomeIcon icon={faSearch} style={{ fontSize: 28, display: 'block', margin: '0 auto 12px' }} />
              Escribí un ingrediente y presioná Buscar
            </div>
          )}
          {!loading && results.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {results.map((p, i) => (
                <div key={i} onClick={() => { onSelect(p.image_url); onClose(); }}
                  style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', border: '2px solid #f0f0f0', transition: 'all 0.15s', background: '#fafafa' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img src={p.image_url} alt={p.product_name || ''}
                    style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.parentElement.style.display = 'none'; }}
                  />
                  {p.product_name && (
                    <div style={{ fontSize: 10, padding: '4px 6px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.product_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', fontSize: 10, color: '#bbb', textAlign: 'center' }}>
          Fotos de Open Food Facts · Licencia libre
        </div>
      </div>
    </div>
  );
}

function ImageZone({ stepIdx, imageUrl, uploading, onUpload, onClear, onSelectUrl }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(stepIdx, file);
  };

  if (imageUrl) {
    return (
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
        <img src={imgSrc(imageUrl)} alt="paso"
          style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
        <button onClick={onClear}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 8,
            color: '#fff', width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13
          }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {showSearch && (
        <ImageSearchModal
          onSelect={(url) => { onSelectUrl(stepIdx, url); setShowSearch(false); }}
          onClose={() => setShowSearch(false)}
        />
      )}
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          borderRadius: 12, border: `2px dashed ${dragging ? GOLD : '#d1d5db'}`,
          background: dragging ? '#fffdf0' : '#f9fafb',
          padding: '18px 16px', textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.15s'
        }}
      >
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => onUpload(stepIdx, e.target.files[0])} />
        {uploading ? (
          <div style={{ color: '#888', fontSize: 13 }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7, color: GOLD }} />
            Subiendo imagen...
          </div>
        ) : (
          <>
            <FontAwesomeIcon icon={faImage} style={{ fontSize: 22, color: '#d1d5db', display: 'block', margin: '0 auto 7px' }} />
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Subir desde mi dispositivo</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Clic o arrastra · PNG, JPG, WEBP</div>
          </>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); setShowSearch(true); }}
        style={{ marginTop: 7, width: '100%', padding: '9px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'border-color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
      >
        <FontAwesomeIcon icon={faSearch} style={{ color: GOLD }} />
        Buscar imagen en internet
      </button>
    </div>
  );
}

/* ── Card de un paso en el editor ── */
function StepCard({ step, index, total, onChange, onMove, onRemove, onUpload, onSelectUrl, uploadingStep }) {
  const [showTip, setShowTip] = useState(!!step.tip);

  const field = (label, key, multiline = false, placeholder = '') => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={step[key]}
          onChange={e => onChange(index, key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
            borderRadius: 9, fontSize: 14, outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
            transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = GOLD}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      ) : (
        <input
          type="text"
          value={step[key]}
          onChange={e => onChange(index, key, e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
            borderRadius: 9, fontSize: 14, outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.15s'
          }}
          onFocus={e => e.target.style.borderColor = GOLD}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      )}
    </div>
  );

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1.5px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden'
    }}>
      {/* Cabecera del paso */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', background: '#f9fafb',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: GOLD, color: '#000', fontWeight: 900,
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          {index + 1}
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#374151', flex: 1 }}>
          Paso {index + 1}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <FontAwesomeIcon icon={faChevronUp} />
          </button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: index === total - 1 ? 'default' : 'pointer', color: index === total - 1 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
          {total > 1 && (
            <button onClick={() => onRemove(index)}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido del paso */}
      <div style={{ padding: '18px 18px 14px' }}>
        {field('Título del paso', 'title', false, 'Ej: Preparar los ingredientes')}
        {field('Instrucción', 'instruction', true, 'Describe exactamente qué debe hacer el trabajador en este paso...')}

        {/* Imagen */}
        <ImageZone
          stepIdx={index}
          imageUrl={step.image_url}
          uploading={uploadingStep === index}
          onUpload={onUpload}
          onClear={() => onChange(index, 'image_url', '')}
          onSelectUrl={onSelectUrl}
        />

        {/* Consejo (toggle) */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowTip(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: showTip ? '#92400e' : '#9ca3af',
              fontWeight: 600, padding: 0
            }}
          >
            <FontAwesomeIcon icon={faLightbulb} style={{ color: showTip ? GOLD : '#d1d5db' }} />
            {showTip ? 'Ocultar consejo' : 'Agregar consejo (opcional)'}
          </button>
          {showTip && (
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                value={step.tip}
                onChange={e => onChange(index, 'tip', e.target.value)}
                placeholder="Ej: Asegúrate de que la plancha esté bien caliente"
                style={{
                  width: '100%', padding: '9px 12px', border: '1.5px solid #fde68a',
                  borderRadius: 9, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box', background: '#fffdf0'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Editor de una tabla individual ── */
function SingleTableEditor({ table: initialTable, storeId, token, onSave, onBack, saving }) {
  const { selectedStore } = useStore() || {};
  const [table, setTable] = useState(initialTable);
  const [editingCell, setEditingCell] = useState(null);
  const [cellForm, setCellForm] = useState({ name: '', note: '', image_url: '' });
  const [uploadingCell, setUploadingCell] = useState(false);
  const [searchingCellImg, setSearchingCellImg] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = 'c' + Date.now();
    setTable(t => ({ ...t, columns: [...(t.columns || []), { id, name: newColName.trim(), rows: t.rows || 8 }] }));
    setNewColName(''); setAddingCol(false);
  };
  const removeColumn = (id) => setTable(t => {
    const cells = { ...t.cells };
    Object.keys(cells).forEach(k => { if (k.startsWith(id + '_')) delete cells[k]; });
    return { ...t, columns: t.columns.filter(c => c.id !== id), cells };
  });
  const renameColumn = (id, name) => setTable(t => ({ ...t, columns: t.columns.map(c => c.id === id ? { ...c, name } : c) }));
  const setColumnRows = (id, rows) => setTable(t => ({ ...t, columns: t.columns.map(c => c.id === id ? { ...c, rows } : c) }));
  const cellKey = (colId, rowIdx) => `${colId}_${rowIdx}`;
  const getCell = (colId, rowIdx) => (table.cells || {})[cellKey(colId, rowIdx)] || {};
  const openCell = (colId, rowIdx) => { const cell = getCell(colId, rowIdx); setCellForm({ name: cell.name || '', note: cell.note || '', image_url: cell.image_url || '' }); setEditingCell({ colId, rowIdx }); };
  const saveCell = () => { setTable(t => ({ ...t, cells: { ...t.cells, [cellKey(editingCell.colId, editingCell.rowIdx)]: { ...cellForm } } })); setEditingCell(null); };
  const clearCell = () => { const cells = { ...table.cells }; delete cells[cellKey(editingCell.colId, editingCell.rowIdx)]; setTable(t => ({ ...t, cells })); setEditingCell(null); };
  const uploadCellImage = async (file) => {
    if (!file) return;
    setUploadingCell(true);
    try {
      const fd = new FormData(); fd.append('image', file); fd.append('store_id', storeId);
      const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
      if (res.ok) { const data = await res.json(); setCellForm(f => ({ ...f, image_url: data.url || data.path || data.file || '' })); }
    } finally { setUploadingCell(false); }
  };

  const downloadPrepTablePDF = () => {
    const cols = table.columns || [];
    const defaultRows = table.rows || 8;
    const maxRows = cols.length > 0 ? Math.max(1, ...cols.map(c => c.rows || defaultRows)) : defaultRows;
    const isLandscape = cols.length > 4;
    const storeName = selectedStore?.name || 'SRServi';
    const headerCells = cols.map(col => `<th>${col.name}</th>`).join('');
    const bodyRows = Array.from({ length: maxRows }, (_, rowIdx) => {
      const tds = cols.map(col => {
        const colRows = col.rows || defaultRows;
        if (rowIdx >= colRows) return `<td class="empty"></td>`;
        const cell = (table.cells || {})[`${col.id}_${rowIdx}`] || {};
        const imgUrl = cell.image_url ? (cell.image_url.startsWith('http') ? cell.image_url : API + cell.image_url) : null;
        let content = '';
        if (imgUrl) content += `<img src="${imgUrl}" class="cell-img">`;
        if (cell.name) content += `<div class="cell-name">${cell.name}</div>`;
        if (cell.note) content += `<div class="cell-note">${cell.note}</div>`;
        return `<td>${content || '<span class="empty-cell">—</span>'}</td>`;
      }).join('');
      return `<tr><td class="row-num">${rowIdx + 1}</td>${tds}</tr>`;
    }).join('');
    const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:10px}.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:10px;border-bottom:3px solid #000}.hdr h1{font-size:18px;font-weight:800}.hdr p{font-size:11px;color:#666;margin-top:3px}.hdr-r{text-align:right;font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th{background:#111;color:#D4AF37;padding:8px 10px;font-size:11px;font-weight:800;text-align:center;border:1px solid #333}td{padding:6px 8px;border:1px solid #ddd;vertical-align:middle;text-align:center}.row-num{font-weight:800;font-size:13px;color:#D4AF37;background:#111;width:32px}.empty{background:#f5f5f5}.cell-img{width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;margin:0 auto 4px}.cell-name{font-weight:700;font-size:12px;line-height:1.2}.cell-note{font-size:10px;color:#666;margin-top:2px}.empty-cell{color:#ccc}.footer{margin-top:14px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#888;text-align:center}@media print{body{padding:0}@page{size:A4 ${isLandscape ? 'landscape' : 'portrait'};margin:12mm}}`;
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${table.title || 'Tabla de preparación'}</title><style>${css}</style></head><body><div class="hdr"><div><h1>${table.title || 'Tabla de preparación'}</h1><p>${storeName}</p></div><div class="hdr-r"><p>${date}</p></div></div><table><thead><tr><th>#</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><div class="footer">SRServi — ${storeName} — ${new Date().toLocaleString('es-ES')}</div></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 700);
  };

  const colRowsList = (table.columns || []).map(c => c.rows || table.rows || 8);
  const maxRows = colRowsList.length > 0 ? Math.max(1, ...colRowsList) : (table.rows || 8);
  const rowArr = Array.from({ length: maxRows }, (_, i) => i);
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div>
      {/* Back + save bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 600, fontSize: 13, padding: 0 }}>
          <FontAwesomeIcon icon={faArrowLeft} /> Tablas
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={downloadPrepTablePDF} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid #D4AF37', background: '#fff', color: '#111', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faPrint} style={{ color: '#D4AF37' }} />
          PDF A4
        </button>
        <button onClick={() => onSave(table)} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Título */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Título</label>
        <input value={table.title || ''} onChange={e => setTable(t => ({ ...t, title: e.target.value }))}
          style={{ ...inputStyle, fontSize: 15, fontWeight: 700 }} />
      </div>

      {/* Columnas (filas por columna) */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Columnas — nombre y filas de cada una</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(table.columns || []).map(col => (
            <div key={col.id} style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', border: '1.5px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <input value={col.name} onChange={e => renameColumn(col.id, e.target.value)}
                style={{ padding: '5px 8px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, outline: 'none', width: Math.max(60, col.name.length * 8 + 16) }} />
              <div style={{ width: 1, height: 18, background: '#d1d5db', margin: '0 2px' }} />
              <input type="number" min="1" max="30" value={col.rows || table.rows || 8}
                onChange={e => setColumnRows(col.id, Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                style={{ width: 34, padding: '5px 3px', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, outline: 'none', textAlign: 'center', color: '#6b7280' }} />
              <span style={{ fontSize: 10, color: '#aaa', paddingRight: 4 }}>fil</span>
              <button onClick={() => removeColumn(col.id)} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>×</button>
            </div>
          ))}
          {addingCol ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') { setAddingCol(false); setNewColName(''); } }}
                placeholder="Nombre..." style={{ padding: '5px 9px', border: `1.5px solid ${GOLD}`, borderRadius: 8, fontSize: 13, outline: 'none', width: 120 }} />
              <button onClick={addColumn} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: GOLD, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>OK</button>
              <button onClick={() => { setAddingCol(false); setNewColName(''); }} style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingCol(true)} style={{ padding: '5px 10px', border: '1.5px dashed #d1d5db', borderRadius: 8, background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 4 }} />Columna
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {!(table.columns || []).length ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', border: '2px dashed #e5e7eb', borderRadius: 14, color: '#9ca3af', fontSize: 14 }}>
          Agrega columnas para armar la tabla
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', background: '#fff' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, borderRight: '1px solid #333', width: 36, textAlign: 'center' }}>#</th>
                {table.columns.map(col => (
                  <th key={col.id} style={{ padding: '10px 16px', background: '#111', color: GOLD, fontSize: 12, fontWeight: 700, borderRight: '1px solid #333', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 110 }}>{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowArr.map(rowIdx => (
                <tr key={rowIdx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 800, fontSize: 14, color: '#111', textAlign: 'center', background: '#fafafa', borderRight: '1px solid #e5e7eb' }}>{rowIdx + 1}</td>
                  {table.columns.map(col => {
                    const colRows = col.rows || table.rows || 8;
                    if (rowIdx >= colRows) {
                      return <td key={col.id} style={{ padding: '8px 10px', borderRight: '1px solid #f0f0f0', background: '#f3f4f6', minWidth: 110 }} />;
                    }
                    const cell = getCell(col.id, rowIdx);
                    const active = editingCell?.colId === col.id && editingCell?.rowIdx === rowIdx;
                    return (
                      <td key={col.id} onClick={() => openCell(col.id, rowIdx)}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderRight: '1px solid #f0f0f0', background: active ? '#fffdf0' : '#fff', transition: 'background 0.1s', verticalAlign: 'middle', textAlign: 'center', minWidth: 110 }}>
                        {(cell.name || cell.image_url) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            {cell.image_url && <img src={cell.image_url.startsWith('http') ? cell.image_url : API + cell.image_url} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8 }} />}
                            {cell.name && <div style={{ fontSize: 11, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{cell.name}</div>}
                            {cell.note && <div style={{ fontSize: 10, color: '#888' }}>{cell.note}</div>}
                          </div>
                        ) : <span style={{ color: '#d1d5db', fontSize: 18 }}>+</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal celda */}
      {editingCell && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditingCell(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 18px', width: '100%', maxWidth: 360, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>{table.columns.find(c => c.id === editingCell.colId)?.name} — Fila {editingCell.rowIdx + 1}</div>
              <button onClick={() => setEditingCell(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Imagen</label>
              {cellForm.image_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={cellForm.image_url.startsWith('http') ? cellForm.image_url : API + cellForm.image_url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10 }} />
                  <button onClick={() => setCellForm(f => ({ ...f, image_url: '' }))} style={{ padding: '5px 10px', border: '1px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Quitar</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchingCellImg && (
                    <ImageSearchModal
                      onSelect={(url) => { setCellForm(f => ({ ...f, image_url: url })); setSearchingCellImg(false); }}
                      onClose={() => setSearchingCellImg(false)}
                    />
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1.5px dashed #d1d5db', borderRadius: 10, cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>
                    <FontAwesomeIcon icon={uploadingCell ? faSpinner : faImage} spin={uploadingCell} />
                    {uploadingCell ? 'Subiendo...' : 'Subir desde mi dispositivo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadCellImage(e.target.files[0])} />
                  </label>
                  <button onClick={() => setSearchingCellImg(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', color: '#6b7280', fontSize: 13, background: '#fff', fontWeight: 600, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                  >
                    <FontAwesomeIcon icon={faSearch} style={{ color: GOLD }} />
                    Buscar imagen en internet
                  </button>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Nombre</label>
              <input value={cellForm.name} onChange={e => setCellForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Mayonesa" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Cantidad / nota</label>
              <input value={cellForm.note} onChange={e => setCellForm(f => ({ ...f, note: e.target.value }))} placeholder="Ej: 2 cdas" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveCell} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Guardar</button>
              <button onClick={clearCell} style={{ padding: '11px 14px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><FontAwesomeIcon icon={faTrash} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Administrador de múltiples tablas ── */
function PrepTableEditor({ storeId, token }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTable, setEditingTable] = useState(null); // null = lista, object = editor

  const load = async () => {
    if (!storeId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/prep-tables?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setTables(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [storeId, token]);

  const newTable = async () => {
    const res = await fetch(`${API}/api/prep-tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ store_id: storeId, title: 'Nueva tabla', columns: [], rows: 8, cells: {} })
    });
    const data = await res.json();
    await load();
    setEditingTable({ id: data.id, title: 'Nueva tabla', columns: [], rows: 8, cells: {} });
  };

  const saveTable = async (tableData) => {
    setSaving(true);
    try {
      await fetch(`${API}/api/prep-tables/${tableData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: storeId, ...tableData })
      });
      await load();
      setEditingTable(null);
    } finally { setSaving(false); }
  };

  const deleteTable = async (id) => {
    if (!confirm('¿Eliminar esta tabla?')) return;
    await fetch(`${API}/api/prep-tables/${id}?store_id=${storeId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    load();
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Cargando...</div>;

  if (editingTable) {
    return <SingleTableEditor table={editingTable} storeId={storeId} token={token} onSave={saveTable} onBack={() => setEditingTable(null)} saving={saving} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={newTable} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faPlus} /> Nueva tabla
        </button>
      </div>

      {tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', border: '2px dashed #e5e7eb', borderRadius: 14, color: '#9ca3af' }}>
          <FontAwesomeIcon icon={faTable} style={{ fontSize: 36, marginBottom: 12, display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#374151' }}>Sin tablas todavía</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>Crea una tabla visual para que tus trabajadores vean las preparaciones</div>
          <button onClick={newTable} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: GOLD, color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 7 }} />Crear primera tabla
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tables.map(t => (
            <div key={t.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
              <button onClick={() => setEditingTable(t)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FontAwesomeIcon icon={faTable} style={{ color: '#6b7280', fontSize: 16 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111', lineHeight: 1.2 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {(t.columns || []).length} columna{(t.columns || []).length !== 1 ? 's' : ''}
                    {(t.columns || []).length > 0 && ` · hasta ${Math.max(...(t.columns || []).map(c => c.rows || t.rows || 8))} filas`}
                  </div>
                </div>
                <FontAwesomeIcon icon={faChevronDown} style={{ transform: 'rotate(-90deg)', color: '#bbb', fontSize: 11, flexShrink: 0 }} />
              </button>
              <button onClick={() => deleteTable(t.id)} style={{ padding: '14px 16px', background: 'none', border: 'none', borderLeft: '1px solid #f3f4f6', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Componente principal ── */
export default function Procedures() {
  const { selectedStore } = useStore() || {};
  const { token } = useAuth();

  const [procedures, setProcedures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('guides'); // 'guides' | 'table'
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', steps: [emptyStep()] });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProduct, setGenProduct] = useState('');
  const [genContext, setGenContext] = useState('');
  const [uploadingStep, setUploadingStep] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const storeId = selectedStore?.id;

  const load = async () => {
    if (!storeId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/procedures?store_id=${storeId}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.ok) setProcedures(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [storeId, token]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', steps: [emptyStep()] });
    setGenProduct(''); setGenContext('');
    setPreviewMode(false); setSaveOk(false);
    setView('editor');
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({ title: proc.title, steps: proc.steps.length ? proc.steps : [emptyStep()] });
    setGenProduct(''); setGenContext('');
    setPreviewMode(false); setSaveOk(false);
    setView('editor');
  };

  const backToList = () => { setView('list'); setEditing(null); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `${API}/api/procedures/${editing.id}` : `${API}/api/procedures`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...form, store_id: storeId })
      });
      if (res.ok) {
        setSaveOk(true);
        await load();
        setTimeout(() => { setSaveOk(false); backToList(); }, 900);
      }
    } finally { setSaving(false); }
  };

  const deleteProcedure = async (id) => {
    if (!confirm('¿Eliminar este procedimiento?')) return;
    await fetch(`${API}/api/procedures/${id}?store_id=${storeId}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
    });
    load();
  };

  const generateWithAI = async () => {
    if (!genProduct.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/brain/generate-procedure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: storeId, product_name: genProduct, extra_context: genContext })
      });
      const data = await res.json();
      if (res.ok && data.steps) {
        setForm(prev => ({
          ...prev,
          title: data.title || `Procedimiento: ${genProduct}`,
          steps: data.steps.map(s => ({ title: s.title || '', instruction: s.instruction || '', tip: s.tip || '', image_url: '' }))
        }));
        setGenProduct(''); setGenContext('');
      } else {
        alert('León IA no disponible. Puedes crear los pasos manualmente.');
      }
    } finally { setGenerating(false); }
  };

  const updateStep = (i, field, value) => {
    setForm(prev => {
      const steps = [...prev.steps];
      steps[i] = { ...steps[i], [field]: value };
      return { ...prev, steps };
    });
  };

  const addStep = () => setForm(prev => ({ ...prev, steps: [...prev.steps, emptyStep()] }));

  const removeStep = (i) => setForm(prev => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }));

  const moveStep = (i, dir) => {
    setForm(prev => {
      const steps = [...prev.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return prev;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...prev, steps };
    });
  };

  const uploadImage = async (stepIdx, file) => {
    if (!file) return;
    setUploadingStep(stepIdx);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('store_id', storeId);
      const res = await fetch(`${API}/api/upload`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
      });
      if (res.ok) {
        const data = await res.json();
        updateStep(stepIdx, 'image_url', data.url || data.path || data.file || '');
      }
    } finally { setUploadingStep(null); }
  };

  /* ── Vista lista ── */
  if (loading) return <div className="loading">Cargando procedimientos...</div>;

  if (view === 'list') {
    return (
      <>
        <header className="admin-header">
          <div>
            <h1>Procedimientos</h1>
            <p className="text-sm text-muted">Guías y tabla de preparación</p>
          </div>
          {adminTab === 'guides' && (
            <button className="btn btn-primary" onClick={openNew}>
              <FontAwesomeIcon icon={faPlus} /> Nueva guía
            </button>
          )}
        </header>

        {/* Tabs */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 0, background: '#fff' }}>
          {[
            { key: 'guides', icon: faClipboardList, label: 'Guías paso a paso' },
            { key: 'table', icon: faTable, label: 'Tabla de preparación' }
          ].map(tab => (
            <button key={tab.key} onClick={() => setAdminTab(tab.key)} style={{
              padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: adminTab === tab.key ? 700 : 500,
              color: adminTab === tab.key ? '#111' : '#9ca3af',
              borderBottom: adminTab === tab.key ? '2px solid #111' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7, marginBottom: -1
            }}>
              <FontAwesomeIcon icon={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="admin-main">
          {adminTab === 'table' ? (
            <PrepTableEditor storeId={storeId} token={token} />
          ) : procedures.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0'
            }}>
              <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 40, color: '#d1d5db', marginBottom: 14, display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: '#374151', marginBottom: 6 }}>Sin guías todavía</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>
                Crea guías paso a paso para que tus trabajadores sepan exactamente cómo preparar cada producto.
              </div>
              <button className="btn btn-primary" onClick={openNew}>
                <FontAwesomeIcon icon={faPlus} /> Crear primera guía
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {procedures.map(proc => (
                <div key={proc.id} style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ padding: '18px 18px 14px', flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>
                      {proc.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(proc.steps || []).slice(0, 3).map((s, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '2px 9px', borderRadius: 20,
                          background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb'
                        }}>
                          {i + 1}. {s.title || s.instruction?.slice(0, 22) || 'Paso'}
                        </span>
                      ))}
                      {proc.steps?.length > 3 && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>+{proc.steps.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '10px 18px', borderTop: '1px solid #f5f5f5', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(proc)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#374151' }}>
                      <FontAwesomeIcon icon={faEdit} /> Editar
                    </button>
                    <button onClick={() => deleteProcedure(proc.id)}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 12, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── Vista editor (página completa) ── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Barra superior del editor */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14
      }}>
        <button onClick={backToList}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: 600, fontSize: 13, padding: 0 }}>
          <FontAwesomeIcon icon={faArrowLeft} /> Volver
        </button>
        <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111', flex: 1 }}>
          {editing ? 'Editar guía' : 'Nueva guía'}
        </span>
        <button
          onClick={() => setPreviewMode(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: `1.5px solid ${previewMode ? GOLD : '#e5e7eb'}`,
            background: previewMode ? '#fffdf0' : '#fff',
            color: previewMode ? '#92400e' : '#6b7280',
            fontWeight: 600, fontSize: 13, cursor: 'pointer'
          }}>
          <FontAwesomeIcon icon={previewMode ? faEyeSlash : faEye} />
          {previewMode ? 'Editar' : 'Vista previa'}
        </button>
        <button onClick={save} disabled={saving || !form.title.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: saveOk ? '#16a34a' : saving ? '#555' : '#111',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            transition: 'background 0.2s', opacity: !form.title.trim() ? 0.5 : 1
          }}>
          <FontAwesomeIcon icon={saveOk ? faCheck : saving ? faSpinner : faSave} spin={saving} />
          {saveOk ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 80px' }}>

        {previewMode ? (
          /* ── VISTA PREVIA ── */
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: '#111', padding: '20px 24px' }}>
              <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Guía de preparación
              </div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>
                {form.title || 'Sin título'}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                {form.steps.length} paso{form.steps.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              {form.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: GOLD,
                    color: '#000', fontWeight: 900, fontSize: 16, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    {step.title && <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 5 }}>{step.title}</div>}
                    {step.instruction && <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{step.instruction}</div>}
                    {step.tip && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#92400e', background: '#fffdf0', borderLeft: `3px solid ${GOLD}`, padding: '6px 12px', borderRadius: '0 8px 8px 0' }}>
                        💡 {step.tip}
                      </div>
                    )}
                    {step.image_url && (
                      <img src={imgSrc(step.image_url)} alt=""
                        onClick={() => setLightboxImg(imgSrc(step.image_url))}
                        style={{ marginTop: 12, width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in' }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── EDITOR ── */
          <>
            {/* León IA */}
            {!editing && (
              <div style={{
                background: '#fffdf0', border: `1.5px solid ${GOLD}60`,
                borderRadius: 14, padding: '18px 20px', marginBottom: 24
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FontAwesomeIcon icon={faBrain} style={{ color: GOLD, fontSize: 16 }} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#7a5c00' }}>Generar con León IA</span>
                  <span style={{ fontSize: 12, color: '#a0804a', marginLeft: 4 }}>— escribe el nombre del producto y la IA crea los pasos</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    value={genProduct}
                    onChange={e => setGenProduct(e.target.value)}
                    placeholder="Nombre del producto (ej: Hamburguesa Clásica)"
                    style={{
                      flex: 2, minWidth: 180, padding: '10px 13px', border: '1.5px solid #e5c84a',
                      borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff'
                    }}
                  />
                  <input
                    value={genContext}
                    onChange={e => setGenContext(e.target.value)}
                    placeholder="Detalles extras (opcional)"
                    style={{
                      flex: 1, minWidth: 120, padding: '10px 13px', border: '1.5px solid #e5c84a',
                      borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff'
                    }}
                  />
                  <button onClick={generateWithAI} disabled={generating || !genProduct.trim()}
                    style={{
                      padding: '10px 18px', borderRadius: 9, border: 'none',
                      background: generating || !genProduct.trim() ? '#ccc' : GOLD,
                      color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap'
                    }}>
                    <FontAwesomeIcon icon={generating ? faSpinner : faBrain} spin={generating} />
                    {generating ? 'Generando...' : 'Generar pasos'}
                  </button>
                </div>
              </div>
            )}

            {/* Título */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Título de la guía
              </label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ej: Cómo preparar la Hamburguesa Clásica"
                style={{
                  width: '100%', padding: '13px 16px', border: '2px solid #e5e7eb',
                  borderRadius: 12, fontSize: 18, fontWeight: 700, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = GOLD}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Pasos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  total={form.steps.length}
                  onChange={updateStep}
                  onMove={moveStep}
                  onRemove={removeStep}
                  onUpload={uploadImage}
                  onSelectUrl={(stepIdx, url) => updateStep(stepIdx, 'image_url', url)}
                  uploadingStep={uploadingStep}
                />
              ))}
            </div>

            {/* Agregar paso */}
            <button onClick={addStep}
              style={{
                width: '100%', marginTop: 16, padding: '14px',
                border: '2px dashed #d1d5db', borderRadius: 14,
                background: 'transparent', color: '#9ca3af',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
            >
              <FontAwesomeIcon icon={faPlus} /> Agregar paso
            </button>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}>
          <img src={lightboxImg} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, objectFit: 'contain' }} />
          <button onClick={() => setLightboxImg(null)}
            style={{ position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
