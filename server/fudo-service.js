// Cliente hacia la API de Fudo (POS de terceros, https://fu.do).
//
// Requiere que la tienda tenga el Plan Pro de Fudo contratado CON FUDO (no
// con SRServi): su "API de propósito general" — necesaria para leer/escribir
// el catálogo de productos — está limitada a ese plan.
// Ver: https://soporte.fu.do/es/articles/11732033-introduccion-a-la-api
//
// Activación (manual, la hace el dueño de la tienda):
//   1. Pedir a soporte de Fudo que active la API para la cuenta.
//   2. En Fudo: Administración > Usuarios > (usuario) > "Establecer API Secret".
//   3. Guardar ese token acá (saveFudoConfig).
//
// PENDIENTE: Fudo no publica en su centro de ayuda las rutas exactas ni el
// formato de payloads de la API — solo los comparte tras activarla (portal
// dev.fu.do/api, spec OpenAPI 3). Hasta confirmar eso, las funciones de acá
// NO inventan endpoints: fallan con un mensaje claro en vez de simular que
// funcionan.

export async function testFudoConnection(apiSecret) {
  if (!apiSecret) throw new Error('Falta el API Secret de Fudo');
  throw new Error(
    'Integración pendiente: falta confirmar el spec técnico de la API de Fudo (rutas y formato exacto de la respuesta). ' +
    'Una vez que Fudo active la API para tu cuenta, compartí la documentación (dev.fu.do/api) para completar esto.'
  );
}

export async function syncProductsToFudo(storeId, apiSecret, products) {
  if (!apiSecret) throw new Error('Falta el API Secret de Fudo');
  throw new Error(
    'Integración pendiente: falta confirmar el spec técnico de la API de Fudo antes de poder sincronizar productos.'
  );
}
