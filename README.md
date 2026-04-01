# SRServi - Sistema POS para Restaurantes

Sistema de punto de venta (POS) completo para restaurantes con React, Node.js y base de datos SQLite.

## Características

- Registro y login de usuarios
- Codigos unicos de 6 digitos (formato AAA123) para cada negocio
- Panel de administracion completo
- Gestion de categorias, productos, ingredientes y extras
- Sistema de pedidos con carrito de compras
- Diseño responsive (Negro, Blanco, Dorado)
- Iconos Font Awesome

## Estructura del Proyecto

```
SRServi/
├── server/          # Backend Node.js + Express
│   ├── database.js   # Configuracion de base de datos
│   ├── index.js      # API endpoints
│   └── package.json
└── client/           # Frontend React + Vite
    ├── src/
    │   ├── pages/    # Paginas de la aplicacion
    │   ├── components/
    │   └── context/
    └── package.json
```

## Requisitos

- Node.js 18 o superior
- npm

## Instalacion

1. **Instalar dependencias del servidor:**
   ```bash
   cd server
   npm install
   ```

2. **Instalar dependencias del cliente:**
   ```bash
   cd client
   npm install
   ```

## Ejecucion

1. **Iniciar el servidor (en una terminal):**
   ```bash
   cd server
   npm start
   ```
   El servidor correra en http://localhost:3001

2. **Iniciar el cliente (en otra terminal):**
   ```bash
   cd client
   npm run dev
   ```
   La aplicacion correra en http://localhost:5173

## Uso

### Panel de Administracion

1. Abre http://localhost:5173/login
2. Crea una cuenta o inicia sesion
3. Recibiras un codigo unico de 6 digitos (ejemplo: ABC123)
4. En el panel puedes:
   - Crear categorias
   - Crear productos
   - Crear ingredientes
   - Crear extras
   - Ver pedidos

### Tienda para Clientes

1. Abre http://localhost:5173
2. Ingresa el codigo de 6 digitos del negocio
3. Podras ver los productos, agregar ingredientes y extras
4. Agrega productos al carrito y confirma el pedido

## Tecnologias

- **Backend:** Node.js, Express, SQL.js, JWT, bcrypt
- **Frontend:** React 18, React Router, Vite, Font Awesome
- **Base de datos:** SQLite (sql.js)
- **Estilos:** CSS personalizado con variables

## API Endpoints

### Autenticacion
- POST /api/auth/register - Registro de usuario
- POST /api/auth/login - Inicio de sesion

### Publico
- GET /api/public/:code - Obtener datos del negocio por codigo

### Admin (requiere token)
- GET/POST /api/categories - Gestionar categorias
- GET/POST /api/ingredients - Gestionar ingredientes
- GET/POST /api/extras - Gestionar extras
- GET/POST /api/products - Gestionar productos
- GET /api/orders - Ver pedidos

### Pedidos
- POST /api/orders - Crear pedido (publico)
- GET /api/orders - Ver pedidos (admin)

## Colores

- Negro: #000000
- Blanco: #FFFFFF
- Dorado: #D4AF37

## Licencia

ISC
