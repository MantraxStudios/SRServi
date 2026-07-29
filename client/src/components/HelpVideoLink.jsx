import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlayCircle } from '@fortawesome/free-solid-svg-icons';

/**
 * Enlace reutilizable "Ver tutorial" que abre un video de ayuda de YouTube
 * en una pestaña nueva. Se coloca junto a la cabecera de cada página.
 */
export default function HelpVideoLink({ url, label = 'Ver tutorial', style }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 13px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 999,
        textDecoration: 'none',
        color: '#dc2626',
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <FontAwesomeIcon icon={faPlayCircle} />
      {label}
    </a>
  );
}
