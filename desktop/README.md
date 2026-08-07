# SRServi POS — App de escritorio (offline)

Empaqueta la funcionalidad de venta (Store/POS, Worker Panel y Admin Panel con
el editor integrado) en una app Electron que **funciona sin conexión**. Al abrir:

1. Levanta una **MariaDB embebida** (puerto 3307, datos en `userData/db-data`).
2. Arranca el **servidor Express local** en modo `OFFLINE` (puerto 8888) —
   sin WhatsApp / Instagram / León IA / nginx / cron jobs.
3. Sirve la SPA del cliente y abre la ventana en `/admin`.

Los pagos online (Mercado Pago / TUU / QR) solo se ofrecen si hay internet; sin
red, el POS fuerza **efectivo**.

## Requisitos para desarrollar / empaquetar

1. Build del cliente (genera `client/dist`):
   ```
   cd client && npm install && npm run build
   ```
2. Dependencias del servidor instaladas (`server/node_modules`):
   ```
   cd server && npm install
   ```
3. Binarios de MariaDB portable en `desktop/resources/mariadb/`
   (ver `desktop/resources/README.md`).
4. Dependencias de la app:
   ```
   cd desktop && npm install
   ```

## Ejecutar en desarrollo

```
cd desktop
npm start
```

- Para usar un MySQL/MariaDB ya instalado en tu máquina y saltar la BD embebida:
  `SRSERVI_DB_EXTERNAL=1` + variables `DB_*` (host/puerto/usuario/clave).

## Generar el instalador Windows (.exe)

```
cd desktop
npm run dist
```

El instalador NSIS queda en `desktop/release/SRServi-POS-Setup-<version>.exe`.
Es autocontenido: se instala y funciona sin Node ni MySQL en la máquina destino.

## Variables de entorno útiles

| Variable                | Efecto                                              |
|-------------------------|-----------------------------------------------------|
| `SRSERVI_PORT`          | Puerto del servidor Express (default 8888)          |
| `SRSERVI_DB_PORT`       | Puerto de MariaDB embebida (default 3307)           |
| `SRSERVI_DB_EXTERNAL=1` | No gestiona MariaDB; usa la BD externa de `DB_*`    |
