// ─────────────────────────────────────────────────────────────────────────────
// Tema estacional automático del tótem
// La apariencia y los colores cambian solos según fechas importantes.
// Calendario curado (Chile / LatAm), determinista y sin depender de internet.
// ─────────────────────────────────────────────────────────────────────────────

// El festejo dura TODO el mes indicado (0 = enero, 11 = diciembre).
function wholeMonth(now, m) {
  return now.getMonth() === m;
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

// Fechas patrias por país (mes completo, 0 = enero). Cada país tiene su propia
// celebración nacional para que NO todos los tótems muestren lo mismo.
const NATIONAL = {
  chile:     { m: 8, emoji: '🇨🇱', banner: '🇨🇱 ¡Septiembre, mes de la Patria! 🥟', colors: { primary: '#0033a0', accent: '#da291c' }, decorations: ['🇨🇱', '🎊', '🥟', '🍷', '🪁', '⭐'] },
  argentina: { m: 6, emoji: '🇦🇷', banner: '🇦🇷 ¡Julio, mes de la Patria! 🧉', colors: { primary: '#74acdf', accent: '#f6b40e' }, decorations: ['🇦🇷', '🎊', '🥟', '🧉', '⭐', '🎶'] },
  mexico:    { m: 8, emoji: '🇲🇽', banner: '🇲🇽 ¡Septiembre, mes patrio! 🌮', colors: { primary: '#006847', accent: '#ce1126' }, decorations: ['🇲🇽', '🎊', '🌮', '🌶️', '🎉', '⭐'] },
  peru:      { m: 6, emoji: '🇵🇪', banner: '🇵🇪 ¡Julio, Fiestas Patrias! 🎊', colors: { primary: '#d91023', accent: '#7a1420' }, decorations: ['🇵🇪', '🎊', '🌶️', '🎉', '⭐', '🍽️'] },
  colombia:  { m: 6, emoji: '🇨🇴', banner: '🇨🇴 ¡Julio, mes de la Independencia! 🎊', colors: { primary: '#003893', accent: '#fcd116' }, decorations: ['🇨🇴', '🎊', '🎉', '⭐', '🥁', '🎶'] },
};

// País → clave normalizada (sin acentos ni mayúsculas).
function countryKey(country) {
  const c = (country || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  if (!c) return 'chile';
  if (c.includes('argentin')) return 'argentina';
  if (c.includes('mexic')) return 'mexico';
  if (c.includes('peru')) return 'peru';
  if (c.includes('colombia')) return 'colombia';
  if (c.includes('chile')) return 'chile';
  return c; // sin fecha patria propia → cae en null abajo
}

// Definición de cada temporada. El orden importa: gana la primera que coincida.
function buildThemes(now, country, forceId = null) {
  const nat = NATIONAL[countryKey(country)] || null;

  // El festejo dura TODO su mes. El orden importa: gana la primera coincidencia,
  // por eso las ventanas cortas que cruzan meses (Año Nuevo, Día del Trabajador)
  // van primero para tener prioridad sobre el tema mensual que las contiene.
  const themes = [
    // ── Ventanas cortas con prioridad ────────────────────────────────────────
    {
      id: 'anio-nuevo',
      name: 'Año Nuevo',
      emoji: '🎉',
      banner: '🎉 ¡Feliz Año Nuevo! ✨',
      // Cruza el fin de año: 27-dic → 6-ene. Gana sobre Navidad y Verano.
      active: inRange(now, { m: 11, d: 27 }, { m: 0, d: 6 }),
      colors: { primary: '#141428', secondary: '#ffffff', accent: '#ffd700', header: '#141428' },
      decorations: ['🎉', '🎆', '🥂', '✨', '🎊', '🍾'],
      animation: 'fall',
    },
    {
      id: 'dia-trabajador',
      name: 'Día del Trabajador',
      emoji: '🛠️',
      banner: '👷 ¡Feliz Día del Trabajador! 🛠️',
      // Solo el 1° de mayo (y su víspera): gana sobre el "mes de la madre".
      active: inRange(now, { m: 3, d: 30 }, { m: 4, d: 1 }),
      colors: { primary: '#2b2d42', secondary: '#ffffff', accent: '#ef233c', header: '#2b2d42' },
      decorations: ['👷', '🛠️', '⚙️', '💪', '🏭', '📋'],
      animation: 'fall',
    },

    // ── Fecha patria del país (mes completo, prioridad sobre el tema del mes) ──
    ...(nat ? [{
      id: 'fiestas-patrias',
      name: 'Fiestas Patrias',
      emoji: nat.emoji,
      banner: nat.banner,
      active: wholeMonth(now, nat.m),
      colors: { primary: nat.colors.primary, secondary: '#ffffff', accent: nat.colors.accent, header: nat.colors.primary },
      decorations: nat.decorations,
      animation: 'fall',
    }] : []),

    // ── Temas de mes completo ────────────────────────────────────────────────
    {
      id: 'vacaciones-verano',
      name: 'Vacaciones de Verano',
      emoji: '🌞',
      banner: '🌞 ¡Enero, mes de vacaciones! 🍦',
      active: wholeMonth(now, 0), // Enero completo (Año Nuevo tiene prioridad hasta el 6)
      colors: { primary: '#0096c7', secondary: '#ffffff', accent: '#ffb703', header: '#0096c7' },
      decorations: ['🌞', '🏖️', '🍦', '🌊', '🕶️', '🐚'],
      animation: 'fall',
    },
    {
      id: 'san-valentin',
      name: 'San Valentín',
      emoji: '❤️',
      banner: '❤️ ¡Febrero, mes del amor! 💕',
      active: wholeMonth(now, 1), // Febrero completo
      colors: { primary: '#c9184a', secondary: '#ffffff', accent: '#ff8fab', header: '#c9184a' },
      decorations: ['❤️', '💕', '🌹', '💘', '💖', '😍'],
      animation: 'fall',
    },
    {
      id: 'dia-madre',
      name: 'Día de la Madre',
      emoji: '💐',
      banner: '💐 ¡Mayo, mes de la Madre! 💖',
      active: wholeMonth(now, 4), // Mayo completo
      colors: { primary: '#b5179e', secondary: '#ffffff', accent: '#ff8fab', header: '#b5179e' },
      decorations: ['💐', '🌸', '💖', '🌷', '👩', '💗'],
      animation: 'fall',
    },
    {
      id: 'dia-padre',
      name: 'Día del Padre',
      emoji: '👔',
      banner: '👔 ¡Junio, mes del Padre! 💙',
      active: wholeMonth(now, 5), // Junio completo
      colors: { primary: '#1d3557', secondary: '#ffffff', accent: '#457b9d', header: '#1d3557' },
      decorations: ['👔', '🎁', '⚽', '🧔', '💙', '🍺'],
      animation: 'fall',
    },
    {
      id: 'vacaciones-invierno',
      name: 'Vacaciones de Invierno',
      emoji: '❄️',
      banner: '❄️ ¡Julio, mes de vacaciones de invierno! ☕',
      active: wholeMonth(now, 6), // Julio completo: receso escolar de invierno en Chile
      colors: { primary: '#1e3a8a', secondary: '#ffffff', accent: '#38bdf8', header: '#1e3a8a' },
      decorations: ['❄️', '☃️', '🧣', '☕', '🧤', '⛄'],
      animation: 'fall',
    },
    {
      id: 'dia-nino',
      name: 'Día del Niño',
      emoji: '🎈',
      banner: '🎈 ¡Agosto, mes del Niño! 🧸',
      active: wholeMonth(now, 7), // Agosto completo
      colors: { primary: '#7209b7', secondary: '#ffffff', accent: '#f72585', header: '#7209b7' },
      decorations: ['🎈', '🧸', '🎠', '🍭', '🎮', '🎨'],
      animation: 'fall',
    },
    {
      id: 'halloween',
      name: 'Halloween',
      emoji: '🎃',
      banner: '🎃 ¡Octubre, mes del terror! 👻',
      active: wholeMonth(now, 9), // Octubre completo
      colors: { primary: '#1a1a1a', secondary: '#ffffff', accent: '#ff7518', header: '#1a1a1a' },
      decorations: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀'],
      animation: 'fall',
    },
    {
      id: 'primavera',
      name: 'Primavera',
      emoji: '🌸',
      banner: '🌸 ¡Noviembre, mes de la primavera! 🌷',
      active: wholeMonth(now, 10), // Noviembre completo
      colors: { primary: '#2d6a4f', secondary: '#ffffff', accent: '#ff70a6', header: '#2d6a4f' },
      decorations: ['🌸', '🌷', '🌼', '🐝', '🦋', '🌻'],
      animation: 'fall',
    },
    {
      id: 'navidad',
      name: 'Navidad',
      emoji: '🎄',
      banner: '🎄 ¡Diciembre, mes de Navidad! 🎁',
      active: wholeMonth(now, 11), // Diciembre completo (Año Nuevo tiene prioridad desde el 27)
      colors: { primary: '#0f5132', secondary: '#ffffff', accent: '#c1121f', header: '#0f5132' },
      decorations: ['🎄', '🎅', '❄️', '🎁', '⭐', '🦌'],
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
