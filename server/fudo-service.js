// Cliente hacia la API de Fudo (POS de terceros, https://fu.do).
//
// Requiere que la tienda tenga contratada con Fudo la "API de propósito
// general" (necesaria para leer/escribir el catálogo de productos). La activa
// el soporte de Fudo a pedido del dueño de la cuenta.
// Ver: https://soporte.fu.do/es/articles/11732033-introduccion-a-la-api
//
// Activación (manual, la hace el dueño de la tienda):
//   1. Pedir a soporte de Fudo que active la API para la cuenta.
//   2. En Fudo: Administración > Usuarios > (usuario) API > generar
//      "API Key" y "API Secret".
//   3. Guardar ambos acá (saveFudoConfig) y probar la conexión.
//
// Spec (verificado contra los endpoints en vivo):
//   - Autenticación: POST https://auth.fu.do/api  con { apiKey, apiSecret }
//     → responde { token, exp }. El token es un JWT de corta duración.
//   - API de datos: https://api.fu.do/v1alpha1 — formato JSON:API.
//     El token va en el header Authorization: Bearer <token>.
//   - Productos: GET/POST/PATCH /products (recurso "Product").

const AUTH_URL = 'https://auth.fu.do/api';
const API_BASE = 'https://api.fu.do/v1alpha1';

// Extrae un mensaje legible de una respuesta de error JSON:API de Fudo.
function fudoError(json, fallback) {
  const err = json?.errors?.[0];
  if (err) {
    return err.detail || err.title || `Fudo: ${err.code || err.status || 'error'}`;
  }
  if (json?.message) return json.message;
  return fallback;
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// Obtiene un token de acceso (JWT) a partir de API Key + API Secret.
export async function getFudoToken(apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    throw new Error('Faltan las credenciales de Fudo: se necesitan la API Key y el API Secret.');
  }
  let res;
  try {
    res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret }),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con Fudo (${e.message}).`);
  }
  const json = await parseBody(res);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Credenciales de Fudo inválidas. Revisá la API Key y el API Secret.');
    }
    throw new Error(fudoError(json, `Fudo rechazó la autenticación (HTTP ${res.status}).`));
  }
  const token = json.token || json.access_token || json.data?.token;
  if (!token) throw new Error('Fudo autenticó pero no devolvió un token de acceso.');
  return token;
}

// Request genérico contra la API de datos de Fudo (JSON:API).
async function fudoApi(token, method, path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con la API de Fudo (${e.message}).`);
  }
  const json = await parseBody(res);
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('La sesión con Fudo expiró o el token no tiene permisos. Volvé a probar la conexión.');
    }
    if (res.status === 403) {
      throw new Error('Tu cuenta de Fudo no tiene habilitada la API de propósito general. Pedila a soporte de Fudo.');
    }
    throw new Error(fudoError(json, `Fudo respondió HTTP ${res.status} en ${method} ${path}.`));
  }
  return json;
}

// Prueba las credenciales: autentica y confirma que la API de productos responde.
export async function testFudoConnection(apiKey, apiSecret) {
  const token = await getFudoToken(apiKey, apiSecret);
  // Un GET liviano valida que la API de propósito general esté activa.
  await fudoApi(token, 'GET', '/products?page%5Bsize%5D=1');
  return { ok: true };
}

// Trae todos los productos existentes en Fudo (paginado JSON:API).
async function fetchAllFudoProducts(token) {
  const all = [];
  const size = 500;
  let page = 1;
  for (let i = 0; i < 50; i++) { // tope de seguridad: 25.000 productos
    const json = await fudoApi(token, 'GET', `/products?page%5Bsize%5D=${size}&page%5Bnumber%5D=${page}`);
    const data = Array.isArray(json.data) ? json.data : [];
    all.push(...data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

// Trae todas las categorías de productos de Fudo (paginado JSON:API).
// Devuelve un Map id -> nombre para poder resolver la categoría de cada producto.
async function fetchFudoCategoryNames(token) {
  const byId = new Map();
  const size = 500;
  // Fudo expone las categorías en /product-categories (recurso "ProductCategory").
  for (let page = 1; page <= 50; page++) {
    let json;
    try {
      json = await fudoApi(token, 'GET', `/product-categories?page%5Bsize%5D=${size}&page%5Bnumber%5D=${page}`);
    } catch {
      // Si la cuenta no expone categorías, seguimos sin ellas (no es crítico).
      break;
    }
    const data = Array.isArray(json.data) ? json.data : [];
    for (const c of data) {
      const name = (c.attributes?.name || '').trim();
      if (name) byId.set(String(c.id), name);
    }
    if (data.length < size) break;
  }
  return byId;
}

// Importa el catálogo de Fudo hacia SRServi: trae todos los productos de Fudo
// y los normaliza a la misma forma que usa el import de Excel/Web:
//   { name, description, price, category, barcode, image_url }
export async function fetchProductsFromFudo(apiKey, apiSecret) {
  const token = await getFudoToken(apiKey, apiSecret);
  const [products, catNames] = await Promise.all([
    fetchAllFudoProducts(token),
    fetchFudoCategoryNames(token),
  ]);

  const rows = [];
  for (const p of products) {
    const a = p.attributes || {};
    const name = (a.name || '').trim();
    if (!name) continue;
    // La categoría viene como relación JSON:API a "ProductCategory".
    const catId = p.relationships?.productCategory?.data?.id
      ?? p.relationships?.category?.data?.id;
    const category = catId != null ? (catNames.get(String(catId)) || '') : '';
    rows.push({
      name,
      description: a.description || '',
      // Fudo maneja el precio como número; caemos a 0 si no viene.
      price: Number(a.price ?? a.salePrice ?? 0) || 0,
      category,
      // Fudo usa "code" como código interno; lo tratamos como barcode.
      barcode: a.code || a.barcode || null,
      image_url: a.imageUrl || a.image || null,
    });
  }
  return rows;
}

// Sincroniza el catálogo de SRServi hacia Fudo: crea los que no existen
// (match por nombre, sin distinguir mayúsculas) y actualiza precio/descripción
// de los que ya están.
export async function syncProductsToFudo(storeId, apiKey, apiSecret, products) {
  const token = await getFudoToken(apiKey, apiSecret);

  const existing = await fetchAllFudoProducts(token);
  const idByName = new Map();
  for (const p of existing) {
    const name = (p.attributes?.name || '').trim().toLowerCase();
    if (name && !idByName.has(name)) idByName.set(name, p.id);
  }

  let created = 0, updated = 0;
  const errors = [];

  for (const prod of products || []) {
    const name = (prod.name || '').trim();
    if (!name) continue;
    const attributes = {
      name,
      price: Number(prod.price) || 0,
      description: prod.description || '',
      active: true,
    };
    try {
      const existingId = idByName.get(name.toLowerCase());
      if (existingId != null) {
        await fudoApi(token, 'PATCH', `/products/${existingId}`, {
          data: { type: 'Product', id: String(existingId), attributes },
        });
        updated++;
      } else {
        await fudoApi(token, 'POST', '/products', {
          data: { type: 'Product', attributes },
        });
        created++;
      }
    } catch (e) {
      errors.push(`"${name}": ${e.message}`);
    }
  }

  // Si no se procesó nada con éxito, propagamos el primer error real.
  if (created === 0 && updated === 0 && errors.length) {
    throw new Error(`No se pudo sincronizar ningún producto con Fudo. ${errors[0]}`);
  }

  return { created, updated, failed: errors.length, errors };
}
