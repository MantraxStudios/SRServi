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
function buildThemes(now, country, forceId = null) {
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
    {
      id: 'vacaciones-verano',
      name: 'Vacaciones de Verano',
      emoji: '🌞',
      banner: '🌞 ¡Vacaciones de Verano! 🍦',
      // Tras Año Nuevo (que termina el 6-ene) y hasta principios de febrero.
      active: inRange(now, { m: 0, d: 7 }, { m: 1, d: 7 }),
      colors: { primary: '#0096c7', secondary: '#ffffff', accent: '#ffb703', header: '#0096c7' },
      decorations: ['🌞', '🏖️', '🍦', '🌊', '🕶️', '🐚'],
      animation: 'fall',
    },
    {
      id: 'dia-trabajador',
      name: 'Día del Trabajador',
      emoji: '🛠️',
      banner: '👷 ¡Feliz Día del Trabajador! 🛠️',
      active: inRange(now, { m: 3, d: 28 }, { m: 4, d: 1 }),
      colors: { primary: '#2b2d42', secondary: '#ffffff', accent: '#ef233c', header: '#2b2d42' },
      decorations: ['👷', '🛠️', '⚙️', '💪', '🏭', '📋'],
      animation: 'fall',
    },
    // Día del Padre — Chile: tercer domingo de junio (± esa semana)
    (() => {
      const md = nthSunday(y, 5, 3);
      const from = new Date(y, 5, md.getDate() - 3);
      const to = new Date(y, 5, md.getDate());
      return {
        id: 'dia-padre',
        name: 'Día del Padre',
        emoji: '👔',
        banner: '👔 ¡Feliz Día del Padre! 💙',
        active: now >= new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0) &&
                now <= new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59),
        colors: { primary: '#1d3557', secondary: '#ffffff', accent: '#457b9d', header: '#1d3557' },
        decorations: ['👔', '🎁', '⚽', '🧔', '💙', '🍺'],
        animation: 'fall',
      };
    })(),
    {
      id: 'vacaciones-invierno',
      name: 'Vacaciones de Invierno',
      emoji: '❄️',
      banner: '❄️ ¡Vacaciones de Invierno! ☕',
      // Julio completo: receso escolar de invierno en Chile.
      active: inRange(now, { m: 6, d: 1 }, { m: 6, d: 31 }),
      colors: { primary: '#1e3a8a', secondary: '#ffffff', accent: '#38bdf8', header: '#1e3a8a' },
      decorations: ['❄️', '☃️', '🧣', '☕', '🧤', '⛄'],
      animation: 'fall',
    },
    // Día del Niño — Chile: segundo domingo de agosto (± esa semana)
    (() => {
      const md = nthSunday(y, 7, 2);
      const from = new Date(y, 7, md.getDate() - 3);
      const to = new Date(y, 7, md.getDate());
      return {
        id: 'dia-nino',
        name: 'Día del Niño',
        emoji: '🎈',
        banner: '🎈 ¡Feliz Día del Niño! 🧸',
        active: now >= new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0) &&
                now <= new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59),
        colors: { primary: '#7209b7', secondary: '#ffffff', accent: '#f72585', header: '#7209b7' },
        decorations: ['🎈', '🧸', '🎠', '🍭', '🎮', '🎨'],
        animation: 'fall',
      };
    })(),
    {
      id: 'primavera',
      name: 'Primavera',
      emoji: '🌸',
      banner: '🌸 ¡Bienvenida la Primavera! 🌷',
      // Después de Fiestas Patrias, entrada de la primavera.
      active: inRange(now, { m: 8, d: 21 }, { m: 8, d: 30 }),
      colors: { primary: '#2d6a4f', secondary: '#ffffff', accent: '#ff70a6', header: '#2d6a4f' },
      decorations: ['🌸', '🌷', '🌼', '🐝', '🦋', '🌻'],
      animation: 'fall',
    },
  ];

  // forceId permite previsualizar un tema puntual sin importar la fecha.
  if (forceId) return themes.find(t => t.id === forceId) || null;
  return themes.find(t => t.active) || null;
}

/**
 * Devuelve el tema estacional activo para la fecha dada, o null si no hay ninguno.
 * @param {Date} now  fecha actual (por defecto new Date())
 * @param {string} country  país de la tienda (para fechas nacionales)
 * @param {string} forceId  id de tema a forzar (previsualización), opcional
 */
export function getSeasonalTheme(now = new Date(), country = 'Chile', forceId = null) {
  try {
    return buildThemes(now, country, forceId);
  } catch {
    return null;
  }
}

// Lista de temas disponibles para armar un selector de previsualización.
export const SEASONAL_THEME_OPTIONS = [
  { id: 'navidad', name: 'Navidad', emoji: '🎄' },
  { id: 'anio-nuevo', name: 'Año Nuevo', emoji: '🎉' },
  { id: 'vacaciones-verano', name: 'Vacaciones de Verano', emoji: '🌞' },
  { id: 'san-valentin', name: 'San Valentín', emoji: '❤️' },
  { id: 'dia-trabajador', name: 'Día del Trabajador', emoji: '🛠️' },
  { id: 'dia-madre', name: 'Día de la Madre', emoji: '💐' },
  { id: 'dia-padre', name: 'Día del Padre', emoji: '👔' },
  { id: 'vacaciones-invierno', name: 'Vacaciones de Invierno', emoji: '❄️' },
  { id: 'dia-nino', name: 'Día del Niño', emoji: '🎈' },
  { id: 'fiestas-patrias', name: 'Fiestas Patrias', emoji: '🇨🇱' },
  { id: 'primavera', name: 'Primavera', emoji: '🌸' },
  { id: 'halloween', name: 'Halloween', emoji: '🎃' },
];
