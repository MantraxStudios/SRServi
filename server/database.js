import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let pool = null;

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'mysql',
  database: 'srservi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
    
    await createTables();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    throw error;
  }
}

async function createTables() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      code VARCHAR(10) UNIQUE NOT NULL,
      business_name VARCHAR(255),
      primary_color VARCHAR(20) DEFAULT '#000000',
      secondary_color VARCHAR(20) DEFAULT '#FFFFFF',
      accent_color VARCHAR(20) DEFAULT '#D4AF37',
      header_color VARCHAR(20) DEFAULT '#000000',
      currency_code VARCHAR(10) DEFAULT 'USD',
      currency_symbol VARCHAR(10) DEFAULT '$',
      currency_name VARCHAR(50) DEFAULT 'Dólar Estadounidense',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  const createStoresTable = `
    CREATE TABLE IF NOT EXISTS stores (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      primary_color VARCHAR(20) DEFAULT '#000000',
      secondary_color VARCHAR(20) DEFAULT '#FFFFFF',
      accent_color VARCHAR(20) DEFAULT '#D4AF37',
      header_color VARCHAR(20) DEFAULT '#000000',
      currency_code VARCHAR(10) DEFAULT 'USD',
      currency_symbol VARCHAR(10) DEFAULT '$',
      currency_name VARCHAR(50) DEFAULT 'Dólar Estadounidense',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

  const createWorkersTable = `
    CREATE TABLE IF NOT EXISTS workers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      user_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createIngredientsTable = `
    CREATE TABLE IF NOT EXISTS ingredients (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
      category_id INT DEFAULT NULL,
      image TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`;

  const createExtrasTable = `
    CREATE TABLE IF NOT EXISTS extras (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
      category_id INT DEFAULT NULL,
      image TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`;

  const createStoreConfigurationsTable = `
    CREATE TABLE IF NOT EXISTS store_configurations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      accept_cash BOOLEAN NOT NULL DEFAULT TRUE,
      accept_card BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_minimarket BOOLEAN NOT NULL DEFAULT FALSE,
      default_minimarket_terminal INT DEFAULT NULL,
      allow_serve BOOLEAN NOT NULL DEFAULT TRUE,
      allow_takeout BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createCouponsTable = `
    CREATE TABLE IF NOT EXISTS coupons (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
      discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
      min_order_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
      usage_limit INT DEFAULT NULL,
      usage_count INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      UNIQUE KEY unique_coupon_per_store (store_id, code)
    )`;

  const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      category_id INT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      image TEXT,
      barcode VARCHAR(100) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`;

  const createInventoryTable = `
    CREATE TABLE IF NOT EXISTS inventory (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      min_stock INT NOT NULL DEFAULT 0,
      unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`;

  const createProductIngredientsTable = `
    CREATE TABLE IF NOT EXISTS product_ingredients (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      is_required BOOLEAN DEFAULT FALSE,
      max_selections INT DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    )`;

  const createProductExtrasTable = `
    CREATE TABLE IF NOT EXISTS product_extras (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      extra_id INT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (extra_id) REFERENCES extras(id) ON DELETE CASCADE
    )`;

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      order_type VARCHAR(50) DEFAULT 'serve',
      total DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(20) DEFAULT 'card',
      cash_approved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS order_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      selected_ingredients TEXT,
      selected_extras TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`;

  await pool.execute(createUsersTable);
  await pool.execute(createStoresTable);
  await pool.execute(createCategoriesTable);
  await pool.execute(createIngredientsTable);
  await pool.execute(createExtrasTable);
  await pool.execute(createStoreConfigurationsTable);
  await pool.execute(createCouponsTable);
  await pool.execute(createProductsTable);
  await pool.execute(createProductIngredientsTable);
  await pool.execute(createProductExtrasTable);
  await pool.execute(createOrdersTable);
  await pool.execute(createOrderItemsTable);
  await pool.execute(createWorkersTable);

  const createMercadoPagoTerminalsTable = `
    CREATE TABLE IF NOT EXISTS mercado_pago_terminals (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      mercadopago_access_token VARCHAR(500) NOT NULL,
      mercadopago_terminal_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;
  
  await pool.execute(createMercadoPagoTerminalsTable);

  await pool.execute(createInventoryTable);

  await migrateTables();

  console.log('✅ Tablas creadas/verificadas correctamente');
}

async function migrateTables() {
  try {
    const tables = ['categories', 'ingredients', 'extras', 'products', 'orders'];
    
    for (const table of tables) {
      try {
        const [columns] = await pool.execute(`SHOW COLUMNS FROM ${table}`);
        const columnNames = columns.map(c => c.Field);
        
        if (columnNames.includes('user_id') && !columnNames.includes('store_id')) {
          console.log(`⚠️ Agregando columna store_id a tabla ${table}...`);
          
          await pool.execute(`ALTER TABLE ${table} ADD COLUMN store_id INT AFTER user_id`);
          
          const [userData] = await pool.execute(`SELECT id, user_id FROM ${table}`);
          
          if (userData.length > 0) {
            console.log(`  Copiando ${userData.length} registros de user_id a store_id...`);
            for (const row of userData) {
              await pool.execute(
                `UPDATE ${table} SET store_id = ? WHERE id = ?`,
                [row.user_id, row.id]
              );
            }
          }
          
          await pool.execute(`ALTER TABLE ${table} DROP COLUMN user_id`);
          console.log(`✅ Tabla ${table} migrada correctamente`);
        } else if (!columnNames.includes('user_id') && !columnNames.includes('store_id')) {
          console.log(`⚠️ Agregando columna store_id a tabla ${table} (sin datos anteriores)...`);
          await pool.execute(`ALTER TABLE ${table} ADD COLUMN store_id INT`);
        } else {
          console.log(`ℹ️ Tabla ${table} ya tiene la estructura correcta`);
        }
      } catch (tableError) {
        if (tableError.message.includes('Duplicate column')) {
          console.log(`ℹ️ Columna store_id ya existe en ${table}`);
        } else {
          console.error(`❌ Error migrando tabla ${table}:`, tableError.message);
        }
      }
    }

    try {
      const [orderColumns] = await pool.execute('SHOW COLUMNS FROM orders');
      const orderColumnNames = orderColumns.map(c => c.Field);

      if (!orderColumnNames.includes('subtotal')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER order_type');
      }
      if (!orderColumnNames.includes('discount_total')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN discount_total DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER subtotal');
      }
      if (!orderColumnNames.includes('coupon_code')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) DEFAULT NULL AFTER discount_total');
      }
      if (!orderColumnNames.includes('mp_order_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN mp_order_id VARCHAR(100) DEFAULT NULL');
      }
      if (!orderColumnNames.includes('external_reference')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN external_reference VARCHAR(100) DEFAULT NULL');
      }
      if (!orderColumnNames.includes('user_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN user_id INT DEFAULT NULL');
      }
      if (!orderColumnNames.includes('terminal_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN terminal_id INT DEFAULT NULL');
      }
      if (!orderColumnNames.includes('payment_process')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN payment_process TINYINT(1) NOT NULL DEFAULT 0');
      }
    } catch (orderMigrationError) {
      console.error('❌ Error migrando columnas de cupones en orders:', orderMigrationError.message);
    }

    for (const tableName of ['ingredients', 'extras']) {
      try {
        const [cols] = await pool.execute(`SHOW COLUMNS FROM ${tableName}`);
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('category_id')) {
          console.log(`⚠️ Agregando columna category_id a tabla ${tableName}...`);
          await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN category_id INT DEFAULT NULL`);
          console.log(`✅ Columna category_id agregada a ${tableName}`);
        } else {
          console.log(`ℹ️ Tabla ${tableName} ya tiene category_id`);
        }
        if (!colNames.includes('image')) {
          console.log(`⚠️ Agregando columna image a tabla ${tableName}...`);
          await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN image TEXT DEFAULT NULL`);
          console.log(`✅ Columna image agregada a ${tableName}`);
        } else {
          console.log(`ℹ️ Tabla ${tableName} ya tiene image`);
        }
      } catch (migErr) {
        if (migErr.message.includes('Duplicate column')) {
          console.log(`ℹ️ Columna ya existe en ${tableName}`);
        } else {
          console.error(`❌ Error migrando ${tableName}:`, migErr.message);
        }
      }
    }

    try {
      const [productCols] = await pool.execute('SHOW COLUMNS FROM products');
      const productColNames = productCols.map(c => c.Field);
      if (!productColNames.includes('barcode')) {
        console.log('⚠️ Agregando columna barcode a tabla products...');
        await pool.execute('ALTER TABLE products ADD COLUMN barcode VARCHAR(100) UNIQUE');
        console.log('✅ Columna barcode agregada a products');
      } else {
        console.log('ℹ️ Tabla products ya tiene columna barcode');
      }
    } catch (migErr) {
      console.error('❌ Error migrando products:', migErr.message);
    }

    try {
      await pool.execute('SELECT 1 FROM inventory LIMIT 1');
      console.log('ℹ️ Tabla inventory ya existe');
    } catch (err) {
      if (err.message.includes("doesn't exist")) {
        console.log('⚠️ Creando tabla inventory...');
        await pool.execute(createInventoryTable);
        console.log('✅ Tabla inventory creada');
      }
    }

    try {
      const [invCols] = await pool.execute('SHOW COLUMNS FROM inventory');
      const invColNames = invCols.map(c => c.Field);
      if (!invColNames.includes('unlimited_stock')) {
        console.log('⚠️ Agregando columna unlimited_stock a tabla inventory...');
        await pool.execute('ALTER TABLE inventory ADD COLUMN unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna unlimited_stock agregada a inventory');
      } else {
        console.log('ℹ️ Tabla inventory ya tiene columna unlimited_stock');
      }
    } catch (err) {
      console.error('❌ Error migrando inventory:', err.message);
    }

    try {
      const [ingCols] = await pool.execute('SHOW COLUMNS FROM ingredients');
      const ingColNames = ingCols.map(c => c.Field);
      if (!ingColNames.includes('stock')) {
        console.log('⚠️ Agregando columna stock a tabla ingredients...');
        await pool.execute('ALTER TABLE ingredients ADD COLUMN stock INT NOT NULL DEFAULT 0');
        await pool.execute('ALTER TABLE ingredients ADD COLUMN unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columnas stock y unlimited_stock agregadas a ingredients');
      } else if (!ingColNames.includes('unlimited_stock')) {
        console.log('⚠️ Agregando columna unlimited_stock a tabla ingredients...');
        await pool.execute('ALTER TABLE ingredients ADD COLUMN unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna unlimited_stock agregada a ingredients');
      } else {
        console.log('ℹ️ Tabla ingredients ya tiene columnas de stock');
      }
    } catch (err) {
      console.error('❌ Error migrando ingredients:', err.message);
    }

    try {
      const [extCols] = await pool.execute('SHOW COLUMNS FROM extras');
      const extColNames = extCols.map(c => c.Field);
      if (!extColNames.includes('stock')) {
        console.log('⚠️ Agregando columna stock a tabla extras...');
        await pool.execute('ALTER TABLE extras ADD COLUMN stock INT NOT NULL DEFAULT 0');
        await pool.execute('ALTER TABLE extras ADD COLUMN unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columnas stock y unlimited_stock agregadas a extras');
      } else if (!extColNames.includes('unlimited_stock')) {
        console.log('⚠️ Agregando columna unlimited_stock a tabla extras...');
        await pool.execute('ALTER TABLE extras ADD COLUMN unlimited_stock BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna unlimited_stock agregada a extras');
      } else {
        console.log('ℹ️ Tabla extras ya tiene columnas de stock');
      }
    } catch (err) {
      console.error('❌ Error migrando extras:', err.message);
    }

    try {
      const [configCols] = await pool.execute('SHOW COLUMNS FROM store_configurations');
      const configColNames = configCols.map(c => c.Field);
      if (!configColNames.includes('accept_cash')) {
        console.log('⚠️ Agregando columnas de pago a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN accept_cash BOOLEAN NOT NULL DEFAULT TRUE');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN accept_card BOOLEAN NOT NULL DEFAULT TRUE');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columnas de pago agregadas a store_configurations');
      } else {
        console.log('ℹ️ Tabla store_configurations ya tiene columnas de pago');
      }
      
      if (!configColNames.includes('is_minimarket')) {
        console.log('⚠️ Agregando columna is_minimarket a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN is_minimarket BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna is_minimarket agregada a store_configurations');
      } else {
        console.log('ℹ️ Tabla store_configurations ya tiene columna is_minimarket');
      }
      
      if (!configColNames.includes('default_minimarket_terminal')) {
        console.log('⚠️ Agregando columna default_minimarket_terminal a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN default_minimarket_terminal INT DEFAULT NULL');
        console.log('✅ Columna default_minimarket_terminal agregada a store_configurations');
      } else {
        console.log('ℹ️ Tabla store_configurations ya tiene columna default_minimarket_terminal');
      }

      if (!configColNames.includes('allow_serve')) {
        console.log('⚠️ Agregando columna allow_serve a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN allow_serve BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna allow_serve agregada a store_configurations');
      } else {
        console.log('ℹ️ Tabla store_configurations ya tiene columna allow_serve');
      }

      if (!configColNames.includes('allow_takeout')) {
        console.log('⚠️ Agregando columna allow_takeout a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN allow_takeout BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna allow_takeout agregada a store_configurations');
      } else {
        console.log('ℹ️ Tabla store_configurations ya tiene columna allow_takeout');
      }
    } catch (migErr) {
      if (migErr.message.includes('Duplicate column')) {
        console.log('ℹ️ Columnas ya existen en store_configurations');
      } else {
        console.error('❌ Error migrando store_configurations:', migErr.message);
      }
    }
    
    console.log('✅ Migración de tablas completada');
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
  }
}

function generateCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 3; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return code;
}

export async function createUser(username, email, password, business_name) {
  const hashedPassword = await bcrypt.hash(password, 10);
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password, code, business_name) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashedPassword, code, business_name || null]
  );

  return {
    id: result.insertId,
    username,
    email,
    code,
    business_name
  };
}

export async function authenticateUser(email, password) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  
  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    code: user.code,
    business_name: user.business_name
  };
}

export async function getUserByCode(code) {
  const [rows] = await pool.execute(`
    SELECT id, username, email, code, business_name,
           primary_color, secondary_color, accent_color, header_color,
           currency_code, currency_symbol, currency_name
    FROM users WHERE code = ?
  `, [code]);
  
  return rows.length > 0 ? rows[0] : null;
}

export async function getUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id, username, email, code, business_name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name FROM users WHERE id = ?',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getStores(userId) {
  if (userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM stores WHERE user_id = ? ORDER BY name',
      [userId]
    );
    return rows;
  } else {
    const [rows] = await pool.execute('SELECT * FROM stores ORDER BY name');
    return rows;
  }
}

export async function createStore(userId, data) {
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, mercadopago_access_token, mercadopago_terminal_id } = data;
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    `INSERT INTO stores (user_id, code, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, mercadopago_access_token, mercadopago_terminal_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, code, name, primary_color || '#000000', secondary_color || '#FFFFFF', accent_color || '#D4AF37', header_color || '#000000', currency_code || 'USD', currency_symbol || '$', currency_name || 'Dólar Estadounidense', mercadopago_access_token || null, mercadopago_terminal_id || null]
  );
  return { 
    id: result.insertId, 
    user_id: userId, 
    code, 
    name,
    primary_color: primary_color || '#000000',
    secondary_color: secondary_color || '#FFFFFF',
    accent_color: accent_color || '#D4AF37',
    header_color: header_color || '#000000',
    currency_code: currency_code || 'USD',
    currency_symbol: currency_symbol || '$',
    currency_name: currency_name || 'Dólar Estadounidense',
    mercadopago_access_token: mercadopago_access_token || null,
    mercadopago_terminal_id: mercadopago_terminal_id || null
  };
}

export async function updateStore(storeId, userId, data) {
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, mercadopago_access_token, mercadopago_terminal_id } = data;
  await pool.execute(
    `UPDATE stores SET name = ?, primary_color = ?, secondary_color = ?, accent_color = ?, header_color = ?, currency_code = ?, currency_symbol = ?, currency_name = ?, mercadopago_access_token = ?, mercadopago_terminal_id = ?
     WHERE id = ? AND user_id = ?`,
    [name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, mercadopago_access_token || null, mercadopago_terminal_id || null, storeId, userId]
  );
  return { id: storeId, user_id: userId, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, mercadopago_access_token: mercadopago_access_token || null, mercadopago_terminal_id: mercadopago_terminal_id || null };
}

export async function deleteStore(storeId, userId) {
  await pool.execute(
    'DELETE FROM stores WHERE id = ? AND user_id = ?',
    [storeId, userId]
  );
  return true;
}

export async function getStoreById(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM stores WHERE id = ?',
    [storeId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getStoreByCode(code) {
  const [rows] = await pool.execute(`
    SELECT s.*, u.username, u.email 
    FROM stores s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.code = ?
  `, [code]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getCategories(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM categories WHERE store_id = ? ORDER BY name',
    [storeId]
  );
  return rows;
}

export async function createCategory(storeId, data) {
  const { name, description } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO categories (store_id, user_id, name, description) VALUES (?, ?, ?, ?)',
    [storeId, store.user_id, name, description || null]
  );
  return { id: result.insertId, store_id: storeId, name, description };
}

export async function updateCategory(categoryId, storeId, data) {
  const { name, description } = data;
  await pool.execute(
    'UPDATE categories SET name = ?, description = ? WHERE id = ? AND store_id = ?',
    [name, description || null, categoryId, storeId]
  );
  return { id: categoryId, store_id: storeId, name, description };
}

export async function deleteCategory(categoryId, storeId) {
  await pool.execute(
    'DELETE FROM categories WHERE id = ? AND store_id = ?',
    [categoryId, storeId]
  );
  return true;
}

export async function getIngredients(storeId) {
  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category_name FROM ingredients i
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.store_id = ? ORDER BY i.category_id, i.name`,
    [storeId]
  );
  return rows.map(ing => ({
    ...ing,
    price: parseFloat(ing.price) || 0,
    stock: parseInt(ing.stock) || 0,
    unlimited_stock: ing.unlimited_stock || false
  }));
}

export async function createIngredient(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image, stock, unlimited_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false };
}

export async function updateIngredient(ingredientId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock } = data;
  await pool.execute(
    'UPDATE ingredients SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, ingredientId, storeId]
  );
  return { id: ingredientId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false };
}

export async function deleteIngredient(ingredientId, storeId) {
  await pool.execute(
    'DELETE FROM ingredients WHERE id = ? AND store_id = ?',
    [ingredientId, storeId]
  );
  return true;
}

export async function getExtras(storeId) {
  const [rows] = await pool.execute(
    `SELECT e.*, c.name AS category_name FROM extras e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.store_id = ? ORDER BY e.category_id, e.name`,
    [storeId]
  );
  return rows.map(ext => ({
    ...ext,
    price: parseFloat(ext.price) || 0,
    stock: parseInt(ext.stock) || 0,
    unlimited_stock: ext.unlimited_stock || false
  }));
}

export async function createExtra(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO extras (store_id, user_id, name, price, category_id, image, stock, unlimited_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false };
}

export async function updateExtra(extraId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock } = data;
  await pool.execute(
    'UPDATE extras SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, extraId, storeId]
  );
  return { id: extraId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false };
}

export async function deleteExtra(extraId, storeId) {
  await pool.execute(
    'DELETE FROM extras WHERE id = ? AND store_id = ?',
    [extraId, storeId]
  );
  return true;
}

export async function getStoreConfigurations(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM store_configurations WHERE store_id = ? ORDER BY is_default DESC, name ASC',
    [storeId]
  );
  return rows.map(row => ({
    ...row,
    accept_cash: Boolean(row.accept_cash),
    accept_card: Boolean(row.accept_card),
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    is_minimarket: Boolean(row.is_minimarket)
  }));
}

export async function getStoreConfigurationById(configId, storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM store_configurations WHERE id = ? AND store_id = ?',
    [configId, storeId]
  );
  return rows[0] || null;
}

export async function createStoreConfiguration(storeId, data) {
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout } = data;
  
  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }
  
  const [result] = await pool.execute(
    'INSERT INTO store_configurations (store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, is_default === true, is_minimarket === true, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false]
  );
  return {
    id: result.insertId,
    store_id: storeId,
    name,
    description: description || null,
    accept_cash: accept_cash !== false,
    accept_card: accept_card !== false,
    is_active: is_active !== false,
    is_default: is_default === true,
    is_minimarket: is_minimarket === true,
    default_minimarket_terminal: default_minimarket_terminal || null,
    allow_serve: allow_serve !== false,
    allow_takeout: allow_takeout !== false
  };
}

export async function updateStoreConfiguration(configId, storeId, data) {
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout } = data;
  
  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }
  
  await pool.execute(
    'UPDATE store_configurations SET name = ?, description = ?, accept_cash = ?, accept_card = ?, is_active = ?, is_default = ?, is_minimarket = ?, default_minimarket_terminal = ?, allow_serve = ?, allow_takeout = ? WHERE id = ? AND store_id = ?',
    [name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, is_default === true, is_minimarket === true, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false, configId, storeId]
  );
  return {
    id: configId,
    store_id: storeId,
    name,
    description: description || null,
    accept_cash: accept_cash !== false,
    accept_card: accept_card !== false,
    is_active: is_active !== false,
    is_default: is_default === true,
    is_minimarket: is_minimarket === true,
    default_minimarket_terminal: default_minimarket_terminal || null,
    allow_serve: allow_serve !== false,
    allow_takeout: allow_takeout !== false
  };
}

export async function deleteStoreConfiguration(configId, storeId) {
  await pool.execute(
    'DELETE FROM store_configurations WHERE id = ? AND store_id = ?',
    [configId, storeId]
  );
  return true;
}

export async function getCoupons(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM coupons WHERE store_id = ? ORDER BY created_at DESC',
    [storeId]
  );
  return rows;
}

export async function createCoupon(storeId, data) {
  const {
    code,
    name,
    discount_type,
    discount_value,
    min_order_total,
    usage_limit,
    is_active
  } = data;

  const normalizedCode = String(code || '').trim().toUpperCase();

  const [result] = await pool.execute(
    `INSERT INTO coupons (
      store_id, code, name, discount_type, discount_value, min_order_total, usage_limit, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      storeId,
      normalizedCode,
      name,
      discount_type || 'percent',
      Number(discount_value) || 0,
      Number(min_order_total) || 0,
      usage_limit === null || usage_limit === '' ? null : Number(usage_limit),
      is_active === false ? 0 : 1
    ]
  );

  const [rows] = await pool.execute('SELECT * FROM coupons WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function updateCoupon(couponId, storeId, data) {
  const {
    code,
    name,
    discount_type,
    discount_value,
    min_order_total,
    usage_limit,
    is_active
  } = data;

  const normalizedCode = String(code || '').trim().toUpperCase();

  await pool.execute(
    `UPDATE coupons SET
      code = ?,
      name = ?,
      discount_type = ?,
      discount_value = ?,
      min_order_total = ?,
      usage_limit = ?,
      is_active = ?
     WHERE id = ? AND store_id = ?`,
    [
      normalizedCode,
      name,
      discount_type || 'percent',
      Number(discount_value) || 0,
      Number(min_order_total) || 0,
      usage_limit === null || usage_limit === '' ? null : Number(usage_limit),
      is_active === false ? 0 : 1,
      couponId,
      storeId
    ]
  );

  const [rows] = await pool.execute('SELECT * FROM coupons WHERE id = ? AND store_id = ?', [couponId, storeId]);
  return rows[0] || null;
}

export async function deleteCoupon(couponId, storeId) {
  await pool.execute('DELETE FROM coupons WHERE id = ? AND store_id = ?', [couponId, storeId]);
  return { id: couponId };
}

async function getProductIngredients(productId, categoryId = null) {
  if (categoryId) {
    const [rows] = await pool.execute(`
      SELECT i.*, COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
      FROM ingredients i
      WHERE i.store_id = (SELECT store_id FROM products WHERE id = ?)
        AND (i.category_id = ? OR i.category_id IS NULL)
      ORDER BY i.name
    `, [productId, categoryId]);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      price: parseFloat(row.price),
      category_id: row.category_id,
      image: row.image,
      stock: parseInt(row.stock) || 0,
      unlimited_stock: row.unlimited_stock || false,
      is_required: false,
      max_selections: 1
    }));
  }
  const [rows] = await pool.execute(`
    SELECT i.*, pi.is_required, pi.max_selections,
           COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
    FROM ingredients i
    JOIN product_ingredients pi ON i.id = pi.ingredient_id
    WHERE pi.product_id = ?
  `, [productId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    image: row.image,
    stock: parseInt(row.stock) || 0,
    unlimited_stock: row.unlimited_stock || false,
    is_required: row.is_required,
    max_selections: row.max_selections
  }));
}

async function getProductExtras(productId, categoryId = null) {
  if (categoryId) {
    const [rows] = await pool.execute(`
      SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
      FROM extras e
      WHERE e.store_id = (SELECT store_id FROM products WHERE id = ?)
        AND (e.category_id = ? OR e.category_id IS NULL)
      ORDER BY e.name
    `, [productId, categoryId]);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      price: parseFloat(row.price),
      category_id: row.category_id,
      image: row.image,
      stock: parseInt(row.stock) || 0,
      unlimited_stock: row.unlimited_stock || false
    }));
  }
  const [rows] = await pool.execute(`
    SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
    FROM extras e
    JOIN product_extras pe ON e.id = pe.extra_id
    WHERE pe.product_id = ?
  `, [productId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    image: row.image,
    stock: parseInt(row.stock) || 0,
    unlimited_stock: row.unlimited_stock || false
  }));
}

export async function getProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name,
           COALESCE(i.stock, 0) as stock,
           COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.store_id = ? 
    ORDER BY p.created_at DESC
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      stock: parseInt(product.stock) || 0,
      unlimited_stock: product.unlimited_stock || false,
      ingredients: await getProductIngredients(product.id, product.category_id),
      extras: await getProductExtras(product.id, product.category_id)
    };
    products.push(prod);
  }
  return products;
}

export async function createProduct(storeId, data) {
  const { name, barcode, description, price, category_id, image } = data;
  
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO products (store_id, user_id, category_id, name, barcode, description, price, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, category_id || null, name, barcode || null, description || null, price, image || null]
  );
  const productId = result.insertId;

  return {
    id: productId,
    store_id: storeId,
    category_id,
    name,
    barcode,
    description,
    price,
    image
  };
}

export async function updateProduct(productId, storeId, data) {
  const { name, barcode, description, price, category_id, image } = data;

  await pool.execute(
    'UPDATE products SET name = ?, barcode = ?, description = ?, price = ?, category_id = ?, image = ? WHERE id = ? AND store_id = ?',
    [name, barcode || null, description || null, price, category_id || null, image || null, productId, storeId]
  );

  return {
    id: productId,
    store_id: storeId,
    category_id,
    name,
    barcode,
    description,
    price,
    image
  };
}

export async function deleteProduct(productId, storeId) {
  await pool.execute(
    'DELETE FROM products WHERE id = ? AND store_id = ?',
    [productId, storeId]
  );
  return true;
}

export async function getProductByBarcode(barcode, storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = ? AND p.store_id = ?
  `, [barcode, storeId]);
  return rows[0] || null;
}

export async function searchProducts(query, storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ? AND p.name LIKE ?
    ORDER BY p.name
    LIMIT 20
  `, [storeId, `%${query}%`]);
  return rows;
}

export async function getInventory(productId) {
  const [rows] = await pool.execute(`
    SELECT * FROM inventory WHERE product_id = ?
  `, [productId]);
  return rows[0] || { stock: 0, min_stock: 0 };
}

export async function updateInventory(productId, adjustment, storeId) {
  const [existing] = await pool.execute(
    'SELECT * FROM inventory WHERE product_id = ?',
    [productId]
  );

  if (existing.length === 0) {
    await pool.execute(
      'INSERT INTO inventory (product_id, stock) VALUES (?, ?)',
      [productId, Math.max(0, adjustment)]
    );
  } else {
    await pool.execute(
      'UPDATE inventory SET stock = GREATEST(0, stock + ?) WHERE product_id = ?',
      [adjustment, productId]
    );
  }

  const [updated] = await pool.execute(
    'SELECT stock FROM inventory WHERE product_id = ?',
    [productId]
  );
  return updated[0];
}

export async function setInventoryStock(productId, stock) {
  const [existing] = await pool.execute(
    'SELECT * FROM inventory WHERE product_id = ?',
    [productId]
  );

  if (existing.length === 0) {
    await pool.execute(
      'INSERT INTO inventory (product_id, stock) VALUES (?, ?)',
      [productId, Math.max(0, stock)]
    );
  } else {
    await pool.execute(
      'UPDATE inventory SET stock = ? WHERE product_id = ?',
      [Math.max(0, stock), productId]
    );
  }

  return { stock: Math.max(0, stock) };
}

export async function getProductById(productId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [productId]);
  
  if (rows.length === 0) return null;
  
  const product = {
    ...rows[0],
    price: parseFloat(rows[0].price),
    ingredients: await getProductIngredients(productId, rows[0].category_id),
    extras: await getProductExtras(productId, rows[0].category_id)
  };
  return product;
}

export async function getPublicProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name,
           COALESCE(i.stock, 0) as stock,
           COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.store_id = ? 
    ORDER BY c.name, p.name
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      stock: parseInt(product.stock) || 0,
      unlimited_stock: product.unlimited_stock || false,
      ingredients: await getProductIngredients(product.id, product.category_id),
      extras: await getProductExtras(product.id, product.category_id)
    };
    products.push(prod);
  }
  return products;
}

function calculateDiscountAmount(total, discountType, discountValue) {
  const safeTotal = Number(total) || 0;
  const safeValue = Number(discountValue) || 0;

  if (safeTotal <= 0 || safeValue <= 0) return 0;

  let discount = 0;
  if (discountType === 'fixed') {
    discount = safeValue;
  } else {
    discount = (safeTotal * safeValue) / 100;
  }

  if (discount > safeTotal) return safeTotal;
  return Number(discount.toFixed(2));
}

async function resolveCouponForOrder(storeId, couponCode, subtotal) {
  if (!couponCode) {
    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount_total: 0,
      total: Number(subtotal.toFixed(2)),
      coupon_code: null,
      coupon_id: null
    };
  }

  const normalizedCode = String(couponCode).trim().toUpperCase();
  if (!normalizedCode) {
    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount_total: 0,
      total: Number(subtotal.toFixed(2)),
      coupon_code: null,
      coupon_id: null
    };
  }

  const [rows] = await pool.execute(
    `SELECT * FROM coupons 
     WHERE store_id = ? AND UPPER(code) = ? 
     LIMIT 1`,
    [storeId, normalizedCode]
  );

  if (rows.length === 0) {
    throw new Error('Cupón no válido');
  }

  const coupon = rows[0];
  if (!coupon.is_active) {
    throw new Error('Cupón inactivo');
  }

  const minOrderTotal = Number(coupon.min_order_total || 0);
  if (subtotal < minOrderTotal) {
    throw new Error(`Este cupón requiere un pedido mínimo de ${minOrderTotal.toFixed(2)}`);
  }

  if (coupon.usage_limit !== null && Number(coupon.usage_count) >= Number(coupon.usage_limit)) {
    throw new Error('Este cupón alcanzó su límite de uso');
  }

  const discountTotal = calculateDiscountAmount(subtotal, coupon.discount_type, coupon.discount_value);
  const finalTotal = Number(Math.max(subtotal - discountTotal, 0).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount_total: discountTotal,
    total: finalTotal,
    coupon_code: coupon.code,
    coupon_id: coupon.id
  };
}

export async function validateCouponForStore(storeId, couponCode, subtotal) {
  return await resolveCouponForOrder(storeId, couponCode, Number(subtotal) || 0);
}

export async function createOrder(storeId, orderData) {
  const { order_type, items, payment_method, coupon_code } = orderData;
  
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.unit_price * item.quantity;
  });

  const couponData = await resolveCouponForOrder(storeId, coupon_code, subtotal);
  const total = couponData.total;

  const cashApproved = payment_method === 'card' ? true : false;
  
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, coupon_code, total, payment_method, cash_approved, mp_order_id, external_reference, terminal_id, payment_process) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, order_type || 'serve', couponData.subtotal, couponData.discount_total, couponData.coupon_code, total, payment_method || 'card', cashApproved, orderData.mp_order_id || null, orderData.external_reference || null, orderData.terminal_id || null, 0]
  );
  const orderId = result.insertId;

  if (couponData.coupon_id) {
    await pool.execute(
      'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?',
      [couponData.coupon_id]
    );
  }
  
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNumber = Math.floor(Math.random() * 99) + 1;
  const orderNumber = `${randomLetter}${randomNumber.toString().padStart(2, '0')}`;
  await pool.execute('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);
  const finalOrder = { 
    id: orderId, 
    order_number: orderNumber, 
    store_id: storeId, 
    order_type, 
    subtotal: couponData.subtotal,
    discount_total: couponData.discount_total,
    coupon_code: couponData.coupon_code,
    total, 
    status: 'pending',
    payment_method,
    cash_approved: cashApproved,
    items 
  };

  for (const item of items) {
    await pool.execute(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price, selected_ingredients, selected_extras) VALUES (?, ?, ?, ?, ?, ?)',
      [
        orderId, 
        item.product_id, 
        item.quantity, 
        item.unit_price, 
        JSON.stringify(item.selected_ingredients || []),
        JSON.stringify(item.selected_extras || [])
      ]
    );
  }

  return finalOrder;
}

export async function getOrders(storeId) {
  const [rows] = await pool.execute(
    `SELECT o.*, w.name as completed_by_name 
     FROM orders o 
     LEFT JOIN workers w ON o.completed_by = w.id 
     WHERE o.store_id = ? AND (o.payment_process = 1 OR (o.payment_method = 'cash' AND o.cash_approved = 0))
     ORDER BY o.created_at DESC`,
    [storeId]
  );

  const orders = [];
  for (const order of rows) {
    const totalValue = parseFloat(order.total);
    const ord = {
      ...order,
      total: isNaN(totalValue) ? 0 : totalValue,
      items: await getOrderItems(order.id)
    };
    orders.push(ord);
  }
  return orders;
}

async function getOrderItems(orderId) {
  const [rows] = await pool.execute(`
    SELECT oi.*, COALESCE(p.name, 'Producto eliminado') as product_name 
    FROM order_items oi 
    LEFT JOIN products p ON oi.product_id = p.id 
    WHERE oi.order_id = ?
  `, [orderId]);
  
  return rows.map(row => ({
    ...row,
    unit_price: parseFloat(row.unit_price),
    selected_ingredients: JSON.parse(row.selected_ingredients || '[]'),
    selected_extras: JSON.parse(row.selected_extras || '[]')
  }));
}

export async function updateOrderStatus(orderId, storeId, status, workerId, workerName) {
  if (status === 'completed' && workerId) {
    await pool.execute(
      'UPDATE orders SET status = ?, completed_by = ?, completed_at = NOW() WHERE id = ? AND store_id = ?',
      [status, workerId, orderId, storeId]
    );
    return { id: orderId, status, completed_by: workerId, completed_by_name: workerName };
  }
  await pool.execute(
    'UPDATE orders SET status = ? WHERE id = ? AND store_id = ?',
    [status, orderId, storeId]
  );
  return { id: orderId, status };
}

export async function approveCashPayment(orderId, storeId, workerId, workerName) {
  await pool.execute(
    'UPDATE orders SET cash_approved = TRUE, payment_process = 1 WHERE id = ? AND store_id = ?',
    [orderId, storeId]
  );
  
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ? AND store_id = ?',
    [orderId, storeId]
  );
  
  if (rows.length === 0) {
    throw new Error('Orden no encontrada');
  }
  
  const order = rows[0];
  const totalValue = parseFloat(order.total);
  const items = await getOrderItems(orderId);
  
  return {
    id: order.id,
    store_id: order.store_id,
    order_type: order.order_type,
    total: isNaN(totalValue) ? 0 : totalValue,
    status: order.status,
    payment_method: order.payment_method,
    cash_approved: true,
    created_at: order.created_at,
    order_number: order.order_number,
    items: items
  };
}

export async function updateUserSettings(userId, settings) {
  const { primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = settings;
  
  await pool.execute(
    'UPDATE users SET primary_color = ?, secondary_color = ?, accent_color = ?, header_color = ?, currency_code = ?, currency_symbol = ?, currency_name = ? WHERE id = ?',
    [
      primary_color || '#000000', 
      secondary_color || '#FFFFFF', 
      accent_color || '#D4AF37', 
      header_color || '#000000',
      currency_code || 'USD',
      currency_symbol || '$',
      currency_name || 'Dólar Estadounidense',
      userId
    ]
  );
  
  return await getUserById(userId);
}

export async function createWorker(storeId, data) {
  const { username, password, name } = data;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const [result] = await pool.execute(
    'INSERT INTO workers (store_id, username, password, name) VALUES (?, ?, ?, ?)',
    [storeId, username, hashedPassword, name]
  );
  
  return {
    id: result.insertId,
    store_id: storeId,
    username,
    name
  };
}

export async function getWorkers(storeId) {
  const [rows] = await pool.execute(
    'SELECT id, store_id, username, name, created_at FROM workers WHERE store_id = ? ORDER BY name',
    [storeId]
  );
  return rows;
}

export async function getWorkerById(workerId) {
  const [rows] = await pool.execute(
    'SELECT id, store_id, username, name, created_at FROM workers WHERE id = ?',
    [workerId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function authenticateWorker(username, password) {
  const [rows] = await pool.execute(
    'SELECT w.*, s.name as store_name, s.code as store_code FROM workers w JOIN stores s ON w.store_id = s.id WHERE w.username = ?',
    [username]
  );
  
  if (rows.length === 0) {
    return null;
  }
  
  const worker = rows[0];
  const isValid = await bcrypt.compare(password, worker.password);
  
  if (!isValid) {
    return null;
  }
  
  return {
    id: worker.id,
    store_id: worker.store_id,
    store_name: worker.store_name,
    store_code: worker.store_code,
    username: worker.username,
    name: worker.name
  };
}

export async function deleteWorker(workerId, storeId) {
  await pool.execute(
    'DELETE FROM workers WHERE id = ? AND store_id = ?',
    [workerId, storeId]
  );
  return { id: workerId };
}

export async function getWorkerOrders(storeId) {
  const [rows] = await pool.execute(`
    SELECT o.* FROM orders o 
    WHERE o.store_id = ? 
    ORDER BY o.created_at DESC
  `, [storeId]);
  
  const orders = [];
  for (const order of rows) {
    const items = await getOrderItems(order.id);
    orders.push({
      ...order,
      total: parseFloat(order.total),
      items
    });
  }
  return orders;
}

export async function createMercadoPagoTerminal(userId, data) {
  const { name, mercadopago_access_token, mercadopago_terminal_id } = data;
  
  const [result] = await pool.execute(
    `INSERT INTO mercado_pago_terminals (user_id, name, mercadopago_access_token, mercadopago_terminal_id) 
     VALUES (?, ?, ?, ?)`,
    [userId, name, mercadopago_access_token, mercadopago_terminal_id]
  );
  
  return {
    id: result.insertId,
    user_id: userId,
    name,
    mercadopago_access_token,
    mercadopago_terminal_id
  };
}

export async function getMercadoPagoTerminals(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM mercado_pago_terminals WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function getMercadoPagoTerminalsByStore(storeId) {
  const [rows] = await pool.execute(
    `SELECT m.id, m.name, m.mercadopago_terminal_id
     FROM mercado_pago_terminals m
     JOIN stores s ON s.user_id = m.user_id
     WHERE s.id = ?
     ORDER BY m.created_at DESC`,
    [storeId]
  );
  return rows;
}

export async function getMercadoPagoTerminalForStore(storeId, terminalId) {
  const [rows] = await pool.execute(
    `SELECT m.*
     FROM mercado_pago_terminals m
     JOIN stores s ON s.user_id = m.user_id
     WHERE s.id = ? AND m.id = ?
     LIMIT 1`,
    [storeId, terminalId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getMercadoPagoTerminalById(terminalId) {
  const [rows] = await pool.execute(
    'SELECT * FROM mercado_pago_terminals WHERE id = ?',
    [terminalId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function updateMercadoPagoTerminal(terminalId, userId, data) {
  const { name, mercadopago_access_token, mercadopago_terminal_id } = data;
  
  await pool.execute(
    `UPDATE mercado_pago_terminals 
     SET name = ?, mercadopago_access_token = ?, mercadopago_terminal_id = ?
     WHERE id = ? AND user_id = ?`,
    [name, mercadopago_access_token, mercadopago_terminal_id, terminalId, userId]
  );
  
  return {
    id: terminalId,
    user_id: userId,
    name,
    mercadopago_access_token,
    mercadopago_terminal_id
  };
}

export async function deleteMercadoPagoTerminal(terminalId, userId) {
  await pool.execute(
    'DELETE FROM mercado_pago_terminals WHERE id = ? AND user_id = ?',
    [terminalId, userId]
  );
  return { id: terminalId };
}

export async function processMercadoPagoPayment(storeId, orderData) {
  const { items, order_type, external_reference, selected_terminal_id, coupon_code, total: frontendTotal } = orderData;
  let mercadopago_access_token = null;
  let mercadopago_terminal_id = null;

  if (selected_terminal_id) {
    const terminal = await getMercadoPagoTerminalForStore(storeId, selected_terminal_id);
    if (!terminal) {
      throw new Error('La máquina seleccionada no está disponible para esta tienda');
    }
    mercadopago_access_token = terminal.mercadopago_access_token;
    mercadopago_terminal_id = terminal.mercadopago_terminal_id;
  } else {
    const store = await getStoreById(storeId);
    mercadopago_access_token = store?.mercadopago_access_token || null;
    mercadopago_terminal_id = store?.mercadopago_terminal_id || null;
  }

  if (!mercadopago_access_token || !mercadopago_terminal_id) {
    throw new Error('Configuracion de Mercado Pago no encontrada');
  }
  
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.unit_price * item.quantity;
  });

  const couponData = await resolveCouponForOrder(storeId, coupon_code, subtotal);
  const total = frontendTotal ? parseFloat(frontendTotal) : couponData.total;
  const amountInCents = Math.round(total * 100);
  const amountInt = Math.round(total);
  const amountStr = String(amountInCents);
  const totalAmountStr = Number(total).toFixed(2);
  
  const storeInfo = await getStoreById(storeId);
  const idempotencyKey = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const payload = {
    type: 'point',
    external_reference: external_reference || idempotencyKey,
    description: `Pedido ${order_type === 'takeout' ? 'para llevar' : 'para consumir aqui'}`,
    expiration_time: 'PT10M',
    transactions: {
      payments: [{
        amount: String(Math.round(total))
      }]
    },
    config: {
      point: {
        terminal_id: mercadopago_terminal_id,
        print_on_terminal: 'no_ticket'
      }
    }
  };

  console.log('Enviando pago a Mercado Pago:', payload);

  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mercadopago_access_token}`,
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error de Mercado Pago:', errorText);
    throw new Error(`Error al procesar pago con Mercado Pago: ${errorText}`);
  }

  const mpResponse = await response.json();
  console.log('Respuesta de Mercado Pago:', mpResponse);
  
  return {
    mp_order_id: mpResponse.id,
    status: mpResponse.status,
    external_reference: mpResponse.external_reference,
    amount: total,
    subtotal: couponData.subtotal,
    discount_total: couponData.discount_total,
    coupon_code: couponData.coupon_code
  };
}

export async function confirmCardPayment(orderId, storeId) {
  await pool.execute(
    'UPDATE orders SET cash_approved = TRUE, payment_process = 1 WHERE id = ? AND store_id = ?',
    [orderId, storeId]
  );
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ? AND store_id = ?',
    [orderId, storeId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getMercadoPagoOrderStatus(mpOrderId, mercadopagoAccessToken) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${mpOrderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mercadopagoAccessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al consultar estado de pago: ${errorText}`);
  }

  const result = await response.json();
  console.log('Mercado Pago Order Status Response:', JSON.stringify(result, null, 2));
  return result;
}

export async function cancelMercadoPagoOrder(mpOrderId, mercadopagoAccessToken) {
  const idempotencyKey = `CANCEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${mpOrderId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mercadopagoAccessToken}`,
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({ id: mpOrderId })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al cancelar pago: ${errorText}`);
  }

  return await response.json();
}

export { pool };