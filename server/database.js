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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createExtrasTable = `
    CREATE TABLE IF NOT EXISTS extras (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) DEFAULT 0,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
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
    'SELECT * FROM ingredients WHERE store_id = ? ORDER BY name',
    [storeId]
  );
  return rows;
}

export async function createIngredient(storeId, data) {
  const { name, price } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO ingredients (store_id, user_id, name, price) VALUES (?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0 };
}

export async function updateIngredient(ingredientId, storeId, data) {
  const { name, price } = data;
  await pool.execute(
    'UPDATE ingredients SET name = ?, price = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, ingredientId, storeId]
  );
  return { id: ingredientId, store_id: storeId, name, price: price || 0 };
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
    'SELECT * FROM extras WHERE store_id = ? ORDER BY name',
    [storeId]
  );
  return rows;
}

export async function createExtra(storeId, data) {
  const { name, price } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO extras (store_id, user_id, name, price) VALUES (?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0 };
}

export async function updateExtra(extraId, storeId, data) {
  const { name, price } = data;
  await pool.execute(
    'UPDATE extras SET name = ?, price = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, extraId, storeId]
  );
  return { id: extraId, store_id: storeId, name, price: price || 0 };
}

export async function deleteExtra(extraId, storeId) {
  await pool.execute(
    'DELETE FROM extras WHERE id = ? AND store_id = ?',
    [extraId, storeId]
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

async function getProductIngredients(productId) {
  const [rows] = await pool.execute(`
    SELECT i.*, pi.is_required, pi.max_selections
    FROM ingredients i
    JOIN product_ingredients pi ON i.id = pi.ingredient_id
    WHERE pi.product_id = ?
  `, [productId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    is_required: row.is_required,
    max_selections: row.max_selections
  }));
}

async function getProductExtras(productId) {
  const [rows] = await pool.execute(`
    SELECT e.* FROM extras e
    JOIN product_extras pe ON e.id = pe.extra_id
    WHERE pe.product_id = ?
  `, [productId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price)
  }));
}

export async function getProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.store_id = ? 
    ORDER BY p.created_at DESC
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      ingredients: await getProductIngredients(product.id),
      extras: await getProductExtras(product.id)
    };
    products.push(prod);
  }
  return products;
}

export async function createProduct(storeId, data) {
  const { name, description, price, category_id, image, ingredients, extras } = data;
  
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO products (store_id, user_id, category_id, name, description, price, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, category_id || null, name, description || null, price, image || null]
  );
  const productId = result.insertId;

  if (ingredients && ingredients.length > 0) {
    for (const ing of ingredients) {
      await pool.execute(
        'INSERT INTO product_ingredients (product_id, ingredient_id, is_required, max_selections) VALUES (?, ?, ?, ?)',
        [productId, ing.ingredient_id, ing.is_required ? 1 : 0, ing.max_selections || 1]
      );
    }
  }

  if (extras && extras.length > 0) {
    for (const extraId of extras) {
      await pool.execute(
        'INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)',
        [productId, extraId]
      );
    }
  }

  return {
    id: productId,
    store_id: storeId,
    category_id,
    name,
    description,
    price,
    image,
    ingredients: await getProductIngredients(productId),
    extras: await getProductExtras(productId)
  };
}

export async function updateProduct(productId, storeId, data) {
  const { name, description, price, category_id, image, ingredients, extras } = data;

  await pool.execute(
    'UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, image = ? WHERE id = ? AND store_id = ?',
    [name, description || null, price, category_id || null, image || null, productId, storeId]
  );

  await pool.execute('DELETE FROM product_ingredients WHERE product_id = ?', [productId]);
  await pool.execute('DELETE FROM product_extras WHERE product_id = ?', [productId]);

  if (ingredients && ingredients.length > 0) {
    for (const ing of ingredients) {
      await pool.execute(
        'INSERT INTO product_ingredients (product_id, ingredient_id, is_required, max_selections) VALUES (?, ?, ?, ?)',
        [productId, ing.ingredient_id, ing.is_required ? 1 : 0, ing.max_selections || 1]
      );
    }
  }

  if (extras && extras.length > 0) {
    for (const extraId of extras) {
      await pool.execute(
        'INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)',
        [productId, extraId]
      );
    }
  }

  return {
    id: productId,
    store_id: storeId,
    category_id,
    name,
    description,
    price,
    image,
    ingredients: await getProductIngredients(productId),
    extras: await getProductExtras(productId)
  };
}

export async function deleteProduct(productId, storeId) {
  await pool.execute(
    'DELETE FROM products WHERE id = ? AND store_id = ?',
    [productId, storeId]
  );
  return true;
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
    ingredients: await getProductIngredients(productId),
    extras: await getProductExtras(productId)
  };
  return product;
}

export async function getPublicProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.store_id = ? 
    ORDER BY c.name, p.name
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      ingredients: await getProductIngredients(product.id),
      extras: await getProductExtras(product.id)
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