// Países soportados (ISO 3166-1 alpha-2). Chile primero = default.
export const COUNTRIES = [
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
];

export const DEFAULT_COUNTRY = 'CL';

export const getCountry = (code) => COUNTRIES.find(c => c.code === code) || COUNTRIES[0];

export const loadCountry = () => {
  try {
    const stored = localStorage.getItem('srservi_country');
    if (stored && COUNTRIES.some(c => c.code === stored)) return stored;
  } catch {}
  return DEFAULT_COUNTRY;
};

export const saveCountry = (code) => {
  try { localStorage.setItem('srservi_country', code); } catch {}
};

// Catálogo de POS / terminales de pago disponibles por país.
// action: 'mp_point' abre el wizard interno de Mercado Pago.
// action: 'plugin' redirige a /admin/plugins para instalar el plugin correspondiente.
export const POS_CATALOG = [
  {
    id: 'mercadopago_point',
    name: 'Mercado Pago Point',
    provider: 'Mercado Pago',
    description: 'Terminal Point de Mercado Pago. Detectamos tus dispositivos automáticamente con tu Access Token.',
    countries: ['CL', 'AR', 'BR', 'MX', 'PE', 'CO', 'UY'],
    action: 'mp_point',
    builtin: true,
    color: '#009EE3',
    emoji: '💳',
  },
  {
    id: 'tuu_pos',
    name: 'Tuu POS',
    provider: 'Tuu',
    description: 'Terminal POS Tuu. Pagos con tarjeta vía integración Haulmer.',
    countries: ['CL'],
    action: 'tuu_pos',
    builtin: true,
    color: '#9c27b0',
    emoji: '📱',
  },
  {
    id: 'transbank',
    name: 'Transbank Webpay POS',
    provider: 'Transbank',
    description: 'El principal procesador de pagos con tarjeta en Chile. Integración vía plugin.',
    countries: ['CL'],
    action: 'plugin',
    pluginId: 'transbank-pos',
    color: '#E11E26',
    emoji: '🏦',
  },
  {
    id: 'redelcom',
    name: 'Redelcom',
    provider: 'Redelcom',
    description: 'Terminales POS integrables por API, populares en comercios chilenos.',
    countries: ['CL'],
    action: 'plugin',
    pluginId: 'redelcom-pos',
    color: '#D32F2F',
    emoji: '🔴',
  },
  {
    id: 'sumup',
    name: 'SumUp',
    provider: 'SumUp',
    description: 'Lector móvil de tarjetas. Ideal para pequeños comercios.',
    countries: ['CL', 'ES', 'BR', 'MX', 'CO'],
    action: 'plugin',
    pluginId: 'sumup-pos',
    color: '#00D4B1',
    emoji: '📲',
  },
  {
    id: 'getnet',
    name: 'Getnet Santander',
    provider: 'Getnet',
    description: 'Pasarela de pagos del Banco Santander.',
    countries: ['CL', 'AR', 'BR'],
    action: 'plugin',
    pluginId: 'getnet-pos',
    color: '#EC0000',
    emoji: '💼',
  },
  {
    id: 'izipay',
    name: 'Izipay',
    provider: 'Niubiz',
    description: 'Uno de los terminales POS líderes en Perú.',
    countries: ['PE'],
    action: 'plugin',
    pluginId: 'izipay-pos',
    color: '#F7941D',
    emoji: '💳',
  },
  {
    id: 'clip',
    name: 'Clip',
    provider: 'Clip',
    description: 'Lector de tarjetas móvil líder en México.',
    countries: ['MX'],
    action: 'plugin',
    pluginId: 'clip-pos',
    color: '#FB5B2D',
    emoji: '📱',
  },
  {
    id: 'stripe_terminal',
    name: 'Stripe Terminal',
    provider: 'Stripe',
    description: 'Terminales físicos de Stripe para cobros presenciales.',
    countries: ['US', 'ES', 'MX', 'BR'],
    action: 'plugin',
    pluginId: 'stripe-terminal',
    color: '#635BFF',
    emoji: '💵',
  },
  {
    id: 'square',
    name: 'Square Reader',
    provider: 'Square',
    description: 'Lector de tarjetas móvil de Square.',
    countries: ['US', 'ES'],
    action: 'plugin',
    pluginId: 'square-pos',
    color: '#000000',
    emoji: '🟦',
  },
];

// Helpers para asociar plugins instalados con países (lado cliente, en localStorage).
const PLUGIN_COUNTRIES_KEY = 'srservi_plugin_countries';

export const loadPluginCountries = () => {
  try {
    const raw = localStorage.getItem(PLUGIN_COUNTRIES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
};

export const savePluginCountries = (map) => {
  try { localStorage.setItem(PLUGIN_COUNTRIES_KEY, JSON.stringify(map || {})); } catch {}
};

export const setPluginCountries = (pluginId, countries) => {
  const map = loadPluginCountries();
  map[pluginId] = Array.isArray(countries) ? countries : [];
  savePluginCountries(map);
};

export const getPluginCountries = (pluginId) => {
  const map = loadPluginCountries();
  return Array.isArray(map[pluginId]) ? map[pluginId] : [];
};
