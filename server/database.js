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

  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
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
      customer_name VARCHAR(255),
      total DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
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
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`;

  await pool.execute(createUsersTable);
  await pool.execute(createStoresTable);
  await pool.execute(createCategoriesTable);
  await pool.execute(createIngredientsTable);
  await pool.execute(createExtrasTable);
  await pool.execute(createProductsTable);
  await pool.execute(createProductIngredientsTable);
  await pool.execute(createProductExtrasTable);
  await pool.execute(createOrdersTable);
  await pool.execute(createOrderItemsTable);

  console.log('✅ Tablas creadas/verificadas correctamente');
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
  const [rows] = await pool.execute(
    'SELECT * FROM stores WHERE user_id = ? ORDER BY name',
    [userId]
  );
  return rows;
}

export async function createStore(userId, data) {
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = data;
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    `INSERT INTO stores (user_id, code, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, code, name, primary_color || '#000000', secondary_color || '#FFFFFF', accent_color || '#D4AF37', header_color || '#000000', currency_code || 'USD', currency_symbol || '$', currency_name || 'Dólar Estadounidense']
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
    currency_name: currency_name || 'Dólar Estadounidense'
  };
}

export async function updateStore(storeId, userId, data) {
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name } = data;
  await pool.execute(
    `UPDATE stores SET name = ?, primary_color = ?, secondary_color = ?, accent_color = ?, header_color = ?, currency_code = ?, currency_symbol = ?, currency_name = ? 
     WHERE id = ? AND user_id = ?`,
    [name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, storeId, userId]
  );
  return { id: storeId, user_id: userId, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name };
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
  const [result] = await pool.execute(
    'INSERT INTO categories (store_id, name, description) VALUES (?, ?, ?)',
    [storeId, name, description || null]
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
  const [result] = await pool.execute(
    'INSERT INTO ingredients (store_id, name, price) VALUES (?, ?, ?)',
    [storeId, name, price || 0]
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
  const [result] = await pool.execute(
    'INSERT INTO extras (store_id, name, price) VALUES (?, ?, ?)',
    [storeId, name, price || 0]
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
  
  const [result] = await pool.execute(
    'INSERT INTO products (store_id, category_id, name, description, price, image) VALUES (?, ?, ?, ?, ?, ?)',
    [storeId, category_id || null, name, description || null, price, image || null]
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

export async function createOrder(storeId, orderData) {
  const { customer_name, items } = orderData;
  
  let total = 0;
  items.forEach(item => {
    total += item.unit_price * item.quantity;
  });

  const [result] = await pool.execute(
    'INSERT INTO orders (store_id, customer_name, total) VALUES (?, ?, ?)',
    [storeId, customer_name || null, total]
  );
  const orderId = result.insertId;

  for (const item of items) {
    await pool.execute(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price, selected_ingredients, selected_extras, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        orderId, 
        item.product_id, 
        item.quantity, 
        item.unit_price, 
        JSON.stringify(item.selected_ingredients || []),
        JSON.stringify(item.selected_extras || []),
        item.notes || null
      ]
    );
  }

  return { id: orderId, store_id: storeId, customer_name, total, status: 'pending', items };
}

export async function getOrders(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC',
    [storeId]
  );

  const orders = [];
  for (const order of rows) {
    const ord = {
      ...order,
      total: parseFloat(order.total),
      items: await getOrderItems(order.id)
    };
    orders.push(ord);
  }
  return orders;
}

async function getOrderItems(orderId) {
  const [rows] = await pool.execute(`
    SELECT oi.*, p.name as product_name 
    FROM order_items oi 
    JOIN products p ON oi.product_id = p.id 
    WHERE oi.order_id = ?
  `, [orderId]);
  
  return rows.map(row => ({
    ...row,
    unit_price: parseFloat(row.unit_price),
    selected_ingredients: JSON.parse(row.selected_ingredients || '[]'),
    selected_extras: JSON.parse(row.selected_extras || '[]')
  }));
}

export async function updateOrderStatus(orderId, storeId, status) {
  await pool.execute(
    'UPDATE orders SET status = ? WHERE id = ? AND store_id = ?',
    [status, orderId, storeId]
  );
  return { id: orderId, status };
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

export { pool };
