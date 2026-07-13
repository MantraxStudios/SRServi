// ─────────────────────────────────────────────────────────────────────────────
// Tema estacional automático del tótem
// La apariencia y los colores cambian solos según fechas importantes.
// Calendario curado (Chile / LatAm), determinista y sin depender de internet.
// ─────────────────────────────────────────────────────────────────────────────

// Devuelve el N-ésimo domingo de un mes (0 = enero). occurrence: 1 = primero, 2 = segundo…
function nthSunday(year, month, occurrence) {
  const d = new Date(year, month, 1);
  const firstSunday = 1 + ((7 - d.getDay()) % 7);
  return new Date(year, month, firstSunday + (occurrence - 1) * 7);
}

function sameOrAfter(now, y, m, d) {
  return now >= new Date(y, m, d, 0, 0, 0);
}
function sameOrBefore(now, y, m, d) {
  return now <= new Date(y, m, d, 23, 59, 59);
}
// Rango que puede cruzar el fin de año (ej. 27-dic → 6-ene)
function inRange(now, from, to) {
  const y = now.getFullYear();
  const start = new Date(y, from.m, from.d, 0, 0, 0);
  let end = new Date(y, to.m, to.d, 23, 59, 59);
  if (end < start) {
    // el rango cruza el año: aceptar [start, fin de año] ∪ [inicio de año, end]
    const endNextYear = new Date(y + 1, to.m, to.d, 23, 59, 59);
    const startPrevYear = new Date(y - 1, from.m, from.d, 0, 0, 0);
    return (now >= start && now <= endNextYear) || (now >= startPrevYear && now <= end);
  }
  return now >= start && now <= end;
}

// Definición de cada temporada. El orden importa: gana la primera que coincida.
function buildThemes(now, country) {
  const y = now.getFullYear();
  const isChile = !country || /chile/i.test(country);

  const themes = [
    {
      id: 'navidad',
      name: 'Navidad',
      emoji: '🎄',
      banner: '🎄 ¡Feliz Navidad! 🎁',
      active: inRange(now, { m: 11, d: 1 }, { m: 11, d: 26 }),
      colors: { primary: '#0f5132', secondary: '#ffffff', accent: '#c1121f', header: '#0f5132' },
      decorations: ['🎄', '🎅', '❄️', '🎁', '⭐', '🦌'],
      animation: 'fall',
    },
    {
      id: 'anio-nuevo',
      name: 'Año Nuevo',
      emoji: '🎉',
      banner: '🎉 ¡Feliz Año Nuevo! ✨',
      active: inRange(now, { m: 11, d: 27 }, { m: 0, d: 6 }),
      colors: { primary: '#141428', secondary: '#ffffff', accent: '#ffd700', header: '#141428' },
      decorations: ['🎉', '🎆', '🥂', '✨', '🎊', '🍾'],
      animation: 'fall',
    },
    {
      id: 'san-valentin',
      name: 'San Valentín',
      emoji: '❤️',
      banner: '❤️ ¡Feliz San Valentín! 💕',
      active: inRange(now, { m: 1, d: 8 }, { m: 1, d: 14 }),
      colors: { primary: '#c9184a', secondary: '#ffffff', accent: '#ff8fab', header: '#c9184a' },
      decorations: ['❤️', '💕', '🌹', '💘', '💖', '😍'],
      animation: 'fall',
    },
    // Día de la Madre — Chile: segundo domingo de mayo (± esa semana)
    (() => {
      const md = nthSunday(y, 4, 2);
      const from = new Date(y, 4, md.getDate() - 3);
      const to = new Date(y, 4, md.getDate());
      return {
        id: 'dia-madre',
        name: 'Día de la Madre',
        emoji: '💐',
        banner: '💐 ¡Feliz Día de la Madre! 💖',
        active: now >= new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0) &&
                now <= new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59),
        colors: { primary: '#b5179e', secondary: '#ffffff', accent: '#ff8fab', header: '#b5179e' },
        decorations: ['💐', '🌸', '💖', '🌷', '👩', '💗'],
        animation: 'fall',
      };
    })(),
    {
      id: 'fiestas-patrias',
      name: 'Fiestas Patrias',
      emoji: '🇨🇱',
      banner: '🇨🇱 ¡Viva Chile! 🥟',
      active: isChile && inRange(now, { m: 8, d: 1 }, { m: 8, d: 20 }),
      colors: { primary: '#0033a0', secondary: '#ffffff', accent: '#da291c', header: '#0033a0' },
      decorations: ['🇨🇱', '🎊', '🥟', '🍷', '🪁', '⭐'],
      animation: 'fall',
    },
    {
      id: 'halloween',
      name: 'Halloween',
      emoji: '🎃',
      banner: '🎃 ¡Feliz Halloween! 👻',
      active: inRange(now, { m: 9, d: 24 }, { m: 9, d: 31 }),
      colors: { primary: '#1a1a1a', secondary: '#ffffff', accent: '#ff7518', header: '#1a1a1a' },
      decorations: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀'],
      animation: 'fall',
    },
  ];

  return themes.find(t => t.active) || null;
}

/**
 * Devuelve el tema estacional activo para la fecha dada, o null si no hay ninguno.
 * @param {Date} now  fecha actual (por defecto new Date())
 * @param {string} country  país de la tienda (para fechas nacionales)
 */
export function getSeasonalTheme(now = new Date(), country = 'Chile') {
  try {
    return buildThemes(now, country);
  } catch {
    return null;
  }
}
