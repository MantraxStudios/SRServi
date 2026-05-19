import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let pool = null;

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'SDVDttniogreireg@2024',
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
      is_banned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  const createSuperadminTable = `
    CREATE TABLE IF NOT EXISTS superadmin (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
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
      is_banned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`;

  const createWorkersTable = `
    CREATE TABLE IF NOT EXISTS workers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_store_username (store_id, username),
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
      default_terminal INT DEFAULT NULL,
      allow_serve BOOLEAN NOT NULL DEFAULT TRUE,
      allow_takeout BOOLEAN NOT NULL DEFAULT TRUE,
      allow_table_service BOOLEAN NOT NULL DEFAULT FALSE,
      tip_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_payment_methods VARCHAR(255) NOT NULL DEFAULT 'tuu,mercadopago',
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
      sort_order INT NOT NULL DEFAULT 0,
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
  await pool.execute(createSuperadminTable);
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

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS store_ratings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      rating TINYINT NOT NULL,
      comment TEXT,
      source VARCHAR(20) DEFAULT 'qr',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

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

  // Migration: add pos_pin column (compatible with all MySQL versions)
  try {
    const [hasPosPin] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mercado_pago_terminals' AND COLUMN_NAME = 'pos_pin'`
    );
    if (hasPosPin.length === 0) {
      await pool.execute(`ALTER TABLE mercado_pago_terminals ADD COLUMN pos_pin VARCHAR(8) NULL`);
    }
  } catch (e) { console.warn('Migration pos_pin:', e.message); }

  // Auto-generate PINs for existing terminals that don't have one
  try {
    const [unpinned] = await pool.execute('SELECT id FROM mercado_pago_terminals WHERE pos_pin IS NULL OR pos_pin = ""');
    for (const row of unpinned) {
      let pin;
      let attempts = 0;
      do {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        const [existing] = await pool.execute('SELECT id FROM mercado_pago_terminals WHERE pos_pin = ? AND id != ?', [pin, row.id]);
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);
      await pool.execute('UPDATE mercado_pago_terminals SET pos_pin = ? WHERE id = ?', [pin, row.id]);
    }
  } catch { /* silently ignore if column didn't exist yet in first run */ }

  const createMpTerminalStoresTable = `
    CREATE TABLE IF NOT EXISTS mercadopago_terminal_stores (
      id INT PRIMARY KEY AUTO_INCREMENT,
      mercadopago_terminal_id INT NOT NULL,
      store_id INT NOT NULL,
      UNIQUE KEY unique_mp_store (mercadopago_terminal_id, store_id),
      FOREIGN KEY (mercadopago_terminal_id) REFERENCES mercado_pago_terminals(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;
  await pool.execute(createMpTerminalStoresTable);

  await pool.execute(createInventoryTable);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plugins (
      id INT PRIMARY KEY AUTO_INCREMENT,
      plugin_id VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(50) NOT NULL,
      description TEXT,
      author VARCHAR(255),
      is_active BOOLEAN DEFAULT FALSE,
      hooks JSON,
      admin_slots JSON,
      store_slots JSON,
      settings_schema JSON,
      has_routes BOOLEAN DEFAULT FALSE,
      installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plugin_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      plugin_id VARCHAR(100) NOT NULL,
      store_id INT NOT NULL,
      settings JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_plugin_store (plugin_id, store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS store_devices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      device_uid VARCHAR(100) NOT NULL,
      store_id INT NOT NULL,
      label VARCHAR(255) DEFAULT NULL,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_device_store (device_uid, store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plugin_workshop (
      id INT PRIMARY KEY AUTO_INCREMENT,
      plugin_id VARCHAR(100) UNIQUE NOT NULL,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      latest_version VARCHAR(50) NOT NULL,
      description TEXT,
      author VARCHAR(255) NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      logo TEXT DEFAULT NULL,
      downloads INT DEFAULT 0,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      hooks JSON,
      admin_slots JSON,
      store_slots JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plugin_workshop_versions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      plugin_id VARCHAR(100) NOT NULL,
      version VARCHAR(50) NOT NULL,
      zip_path TEXT NOT NULL,
      changelog TEXT DEFAULT NULL,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_plugin_version (plugin_id, version)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tuu_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      api_key VARCHAR(500) NOT NULL,
      dte_type INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tuu_devices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      serial VARCHAR(100) NOT NULL,
      device_id VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tuu_device_pos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      device_uid VARCHAR(100) NOT NULL,
      tuu_device_id INT NOT NULL,
      store_id INT NOT NULL,
      UNIQUE KEY unique_uid_store (device_uid, store_id),
      FOREIGN KEY (tuu_device_id) REFERENCES tuu_devices(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tuu_transactions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      idempotency_key VARCHAR(100) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      transaction_ref VARCHAR(255) DEFAULT NULL,
      device_serial VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Tabla unificada de terminales POS (todos los proveedores)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      store_id INT NOT NULL,
      provider VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      api_key VARCHAR(500) NOT NULL DEFAULT '',
      device_id VARCHAR(200) NOT NULL DEFAULT '',
      pos_pin VARCHAR(8) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS instagram_configs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL UNIQUE,
      ig_username VARCHAR(255) DEFAULT '',
      ig_password VARCHAR(500) DEFAULT '',
      caption_template TEXT,
      enabled BOOLEAN DEFAULT FALSE,
      template_counter INT DEFAULT 0,
      last_posted_at TIMESTAMP NULL DEFAULT NULL,
      last_error TEXT,
      ig_session MEDIUMTEXT NULL,
      ig_temp_state MEDIUMTEXT NULL,
      ig_connected TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // Migration: add session columns (compatible with all MySQL versions)
  for (const [col, def] of [
    ['ig_session', 'MEDIUMTEXT NULL'],
    ['ig_temp_state', 'MEDIUMTEXT NULL'],
    ['ig_connected', 'TINYINT(1) DEFAULT 0'],
    ['post_time', "VARCHAR(5) NOT NULL DEFAULT '10:00'"],
    ['post_days', "VARCHAR(20) NOT NULL DEFAULT '0'"],
  ]) {
    try {
      const [has] = await pool.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'instagram_configs' AND COLUMN_NAME = ?`,
        [col]
      );
      if (has.length === 0) await pool.execute(`ALTER TABLE instagram_configs ADD COLUMN ${col} ${def}`);
    } catch (e) { console.warn(`Migration instagram_configs.${col}:`, e.message); }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tiktok_configs (
      id               INT PRIMARY KEY AUTO_INCREMENT,
      store_id         INT NOT NULL UNIQUE,
      client_key       VARCHAR(255) NULL,
      client_secret    VARCHAR(500) NULL,
      access_token     TEXT NULL,
      refresh_token    TEXT NULL,
      open_id          VARCHAR(255) NULL,
      tk_connected     TINYINT(1) DEFAULT 0,
      caption_template TEXT,
      enabled          BOOLEAN DEFAULT FALSE,
      post_time        VARCHAR(5) NOT NULL DEFAULT '10:00',
      post_days        VARCHAR(20) NOT NULL DEFAULT '0',
      template_counter INT DEFAULT 0,
      last_posted_at   TIMESTAMP NULL DEFAULT NULL,
      last_error       TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // Migrations: add columns if table already exists
  for (const [col, def] of [
    ['client_key',     'VARCHAR(255) NULL'],
    ['client_secret',  'VARCHAR(500) NULL'],
    ['session_cookie', 'TEXT NULL'],
  ]) {
    try {
      const [has] = await pool.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tiktok_configs' AND COLUMN_NAME = ?`,
        [col]
      );
      if (has.length === 0) await pool.execute(`ALTER TABLE tiktok_configs ADD COLUMN ${col} ${def}`);
    } catch (e) { console.warn(`Migration tiktok_configs.${col}:`, e.message); }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cash_registers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      worker_id INT NOT NULL,
      worker_name VARCHAR(255) NOT NULL,
      opening_amount DECIMAL(10,2) DEFAULT 0,
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL,
      closed_by VARCHAR(20) DEFAULT 'manual',
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // Tabla de control de migraciones — evita que corran más de una vez
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(100) PRIMARY KEY,
      ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await migrateToUnifiedPos();
  await migrateTables();
  await migrateSrBrain();

  console.log('✅ Tablas creadas/verificadas correctamente');
}

async function migrateSrBrain() {
  // Phone column for workers
  try {
    const [cols] = await pool.execute(`SHOW COLUMNS FROM workers`);
    if (!cols.map(c => c.Field).includes('phone')) {
      await pool.execute(`ALTER TABLE workers ADD COLUMN phone VARCHAR(20) DEFAULT NULL`);
      console.log('✅ Columna phone agregada a workers');
    }
  } catch (e) { console.warn('migrateSrBrain workers.phone:', e.message); }

  // Schedule columns for ai_config
  try {
    const [cols] = await pool.execute(`SHOW COLUMNS FROM ai_config`);
    const fields = cols.map(c => c.Field);
    if (!fields.includes('send_hour')) {
      await pool.execute(`ALTER TABLE ai_config ADD COLUMN send_hour TINYINT DEFAULT 8`);
      console.log('✅ Columna send_hour agregada a ai_config');
    }
    if (!fields.includes('send_days')) {
      await pool.execute(`ALTER TABLE ai_config ADD COLUMN send_days VARCHAR(20) DEFAULT '1,2,3,4,5,6,7'`);
      console.log('✅ Columna send_days agregada a ai_config');
    }
  } catch (e) { console.warn('migrateSrBrain ai_config schedule:', e.message); }

  // AI config per store
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL UNIQUE,
      enabled BOOLEAN DEFAULT FALSE,
      auto_promotions BOOLEAN DEFAULT TRUE,
      worker_reminders BOOLEAN DEFAULT TRUE,
      morale_messages BOOLEAN DEFAULT TRUE,
      promotion_threshold INT DEFAULT 20,
      sender_name VARCHAR(100) DEFAULT 'El Administrador',
      last_run_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // AI activity log
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ai_activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      action_type VARCHAR(60) NOT NULL,
      description TEXT NOT NULL,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_store_date (store_id, created_at)
    )
  `);

  // Worker procedures
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS worker_procedures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      product_id INT NULL,
      title VARCHAR(255) NOT NULL,
      steps JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
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
      if (!orderColumnNames.includes('sequence_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN sequence_id VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna sequence_id agregada a orders');
      }
      if (!orderColumnNames.includes('reference_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN reference_id VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna reference_id agregada a orders');
      }
      if (!orderColumnNames.includes('table_number')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN table_number INT DEFAULT NULL');
        console.log('✅ Columna table_number agregada a orders');
      }
      if (!orderColumnNames.includes('pos_pin')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN pos_pin VARCHAR(8) DEFAULT NULL');
        console.log('✅ Columna pos_pin agregada a orders');
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
      if (!productColNames.includes('sort_order')) {
        console.log('⚠️ Agregando columna sort_order a tabla products...');
        await pool.execute('ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
        console.log('✅ Columna sort_order agregada a products');
      } else {
        console.log('ℹ️ Tabla products ya tiene columna sort_order');
      }
      if (!productColNames.includes('has_extras')) {
        await pool.execute('ALTER TABLE products ADD COLUMN has_extras BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna has_extras agregada a products');
      }
      if (!productColNames.includes('has_ingredients')) {
        await pool.execute('ALTER TABLE products ADD COLUMN has_ingredients BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna has_ingredients agregada a products');
      }
      if (!productColNames.includes('max_extras')) {
        await pool.execute('ALTER TABLE products ADD COLUMN max_extras INT NOT NULL DEFAULT 0');
        console.log('✅ Columna max_extras agregada a products');
      }
      if (!productColNames.includes('max_ingredients')) {
        await pool.execute('ALTER TABLE products ADD COLUMN max_ingredients INT NOT NULL DEFAULT 0');
        console.log('✅ Columna max_ingredients agregada a products');
      }
      if (!productColNames.includes('complements_configured')) {
        await pool.execute('ALTER TABLE products ADD COLUMN complements_configured BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna complements_configured agregada a products');
      }
    } catch (migErr) {
      console.error('❌ Error migrando products:', migErr.message);
    }

    try {
      const [catCols] = await pool.execute('SHOW COLUMNS FROM categories');
      const catColNames = catCols.map(c => c.Field);
      if (!catColNames.includes('sort_order')) {
        await pool.execute('ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
        console.log('✅ Columna sort_order agregada a categories');
      }
    } catch (migErr) {
      console.error('❌ Error migrando categories:', migErr.message);
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
      const [ingCols2] = await pool.execute('SHOW COLUMNS FROM ingredients');
      if (!ingCols2.map(c => c.Field).includes('sort_order')) {
        await pool.execute('ALTER TABLE ingredients ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
        console.log('✅ Columna sort_order agregada a ingredients');
      }
    } catch (err) {
      console.error('❌ Error migrando sort_order en ingredients:', err.message);
    }

    try {
      const [extCols2] = await pool.execute('SHOW COLUMNS FROM extras');
      if (!extCols2.map(c => c.Field).includes('sort_order')) {
        await pool.execute('ALTER TABLE extras ADD COLUMN sort_order INT NOT NULL DEFAULT 0');
        console.log('✅ Columna sort_order agregada a extras');
      }
    } catch (err) {
      console.error('❌ Error migrando sort_order en extras:', err.message);
    }

    try {
      const [ingCols3] = await pool.execute('SHOW COLUMNS FROM ingredients');
      if (!ingCols3.map(c => c.Field).includes('stock_unit')) {
        await pool.execute("ALTER TABLE ingredients ADD COLUMN stock_unit VARCHAR(10) NOT NULL DEFAULT 'unidades'");
        console.log('✅ Columna stock_unit agregada a ingredients');
      }
      const [extCols3] = await pool.execute('SHOW COLUMNS FROM extras');
      if (!extCols3.map(c => c.Field).includes('stock_unit')) {
        await pool.execute("ALTER TABLE extras ADD COLUMN stock_unit VARCHAR(10) NOT NULL DEFAULT 'unidades'");
        console.log('✅ Columna stock_unit agregada a extras');
      }
    } catch (err) {
      console.error('❌ Error migrando stock_unit:', err.message);
    }

    // Materias primas (raw materials)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS raw_materials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          store_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
          unit VARCHAR(20) NOT NULL DEFAULT 'unidades',
          min_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
          cost_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rm_store (store_id)
        )
      `);
      console.log('✅ Tabla raw_materials lista');
    } catch (err) {
      console.error('❌ Error creando raw_materials:', err.message);
    }

    // Recetas: qué materias primas usa cada producto/extra/ingrediente
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS product_recipes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_type ENUM('product','extra','ingredient') NOT NULL,
          item_id INT NOT NULL,
          raw_material_id INT NOT NULL,
          quantity_used DECIMAL(10,4) NOT NULL DEFAULT 1,
          UNIQUE KEY unique_recipe (item_type, item_id, raw_material_id),
          INDEX idx_pr_item (item_type, item_id),
          INDEX idx_pr_rm (raw_material_id)
        )
      `);
      console.log('✅ Tabla product_recipes lista');
    } catch (err) {
      console.error('❌ Error creando product_recipes:', err.message);
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
      if (!configColNames.includes('hide_decimals')) {
        console.log('⚠️ Agregando columna hide_decimals a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN hide_decimals BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna hide_decimals agregada a store_configurations');
      }
      if (!configColNames.includes('allow_table_service')) {
        console.log('⚠️ Agregando columna allow_table_service a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN allow_table_service BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna allow_table_service agregada a store_configurations');
      }
      if (!configColNames.includes('tip_percentage')) {
        console.log('⚠️ Agregando columna tip_percentage a tabla store_configurations...');
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN tip_percentage DECIMAL(5,2) NOT NULL DEFAULT 0');
        console.log('✅ Columna tip_percentage agregada a store_configurations');
      }
      if (!configColNames.includes('delivery_enabled')) {
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE');
      }
      if (!configColNames.includes('delivery_payment_methods')) {
        await pool.execute("ALTER TABLE store_configurations ADD COLUMN delivery_payment_methods VARCHAR(255) NOT NULL DEFAULT 'tuu,mercadopago'");
      }
    } catch (migErr) {
      if (migErr.message.includes('Duplicate column')) {
        console.log('ℹ️ Columnas ya existen en store_configurations');
      } else {
        console.error('❌ Error migrando store_configurations:', migErr.message);
      }
    }

    try {
      const [userCols] = await pool.execute('SHOW COLUMNS FROM users');
      const userColNames = userCols.map(c => c.Field);
      if (!userColNames.includes('is_banned')) {
        console.log('⚠️ Agregando columna is_banned a tabla users...');
        await pool.execute('ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna is_banned agregada a users');
      } else {
        console.log('ℹ️ Tabla users ya tiene columna is_banned');
      }
      
      if (!userColNames.includes('last_active')) {
        console.log('⚠️ Agregando columna last_active a tabla users...');
        await pool.execute('ALTER TABLE users ADD COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        console.log('✅ Columna last_active agregada a users');
      } else {
        console.log('ℹ️ Tabla users ya tiene columna last_active');
      }
      if (!userColNames.includes('totp_secret')) {
        await pool.execute('ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64) DEFAULT NULL');
        console.log('✅ Columna totp_secret agregada a users');
      }
      if (!userColNames.includes('totp_enabled')) {
        await pool.execute('ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna totp_enabled agregada a users');
      }
      if (!userColNames.includes('email_verified')) {
        await pool.execute('ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE');
        // Mark existing users as already verified so they aren't locked out
        await pool.execute('UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE');
        console.log('✅ Columna email_verified agregada a users');
      }
      if (!userColNames.includes('verification_code')) {
        await pool.execute('ALTER TABLE users ADD COLUMN verification_code VARCHAR(6) DEFAULT NULL');
        console.log('✅ Columna verification_code agregada a users');
      }
      if (!userColNames.includes('verification_expires')) {
        await pool.execute('ALTER TABLE users ADD COLUMN verification_expires DATETIME DEFAULT NULL');
        console.log('✅ Columna verification_expires agregada a users');
      }
      if (!userColNames.includes('country')) {
        await pool.execute('ALTER TABLE users ADD COLUMN country VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna country agregada a users');
      }
      if (!userColNames.includes('chatgpt_api_key')) {
        await pool.execute('ALTER TABLE users ADD COLUMN chatgpt_api_key VARCHAR(255) DEFAULT NULL');
        console.log('✅ Columna chatgpt_api_key agregada a users');
      }
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ️ Columnas ya existen en users');
      } else {
        console.error('❌ Error migrando users:', err.message);
      }
    }

    try {
      const [storeCols] = await pool.execute('SHOW COLUMNS FROM stores');
      const storeColNames = storeCols.map(c => c.Field);
      if (!storeColNames.includes('is_banned')) {
        console.log('⚠️ Agregando columna is_banned a tabla stores...');
        await pool.execute('ALTER TABLE stores ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna is_banned agregada a stores');
      } else {
        console.log('ℹ️ Tabla stores ya tiene columna is_banned');
      }

      const [logoCheck] = await pool.execute("SHOW COLUMNS FROM stores LIKE 'logo_url'");
      if (logoCheck.length === 0) {
        await pool.execute('ALTER TABLE stores ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL');
        console.log('✅ Columna logo_url agregada a stores');
      } else {
        console.log('ℹ️ Tabla stores ya tiene columna logo_url');
      }
      if (!storeColNames.includes('store_edit_pin')) {
        console.log('⚠️ Agregando columna store_edit_pin a tabla stores...');
        await pool.execute('ALTER TABLE stores ADD COLUMN store_edit_pin VARCHAR(10) DEFAULT NULL');
        console.log('✅ Columna store_edit_pin agregada a stores');
      } else {
        console.log('ℹ️ Tabla stores ya tiene columna store_edit_pin');
      }

      if (!storeColNames.includes('address')) {
        await pool.execute('ALTER TABLE stores ADD COLUMN address VARCHAR(500) DEFAULT NULL');
        console.log('✅ Columna address agregada a stores');
      }
      if (!storeColNames.includes('opening_hours')) {
        await pool.execute('ALTER TABLE stores ADD COLUMN opening_hours VARCHAR(500) DEFAULT NULL');
        console.log('✅ Columna opening_hours agregada a stores');
      }

      // Worker payment methods table
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS worker_payment_methods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          store_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(20) NOT NULL DEFAULT '#D4AF37',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Tabla worker_payment_methods verificada');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ️ Columnas worker ya existen en stores');
      } else {
        console.error('❌ Error migrando stores:', err.message);
      }
    }

    // Migrate workers: drop global unique on username, add composite unique per store
    try {
      const [indexes] = await pool.execute("SHOW INDEX FROM workers WHERE Key_name = 'username'");
      if (indexes.length > 0) {
        await pool.execute('ALTER TABLE workers DROP INDEX username');
        console.log('✅ Índice único global username en workers eliminado');
      }
      const [compIdx] = await pool.execute("SHOW INDEX FROM workers WHERE Key_name = 'unique_store_username'");
      if (compIdx.length === 0) {
        await pool.execute('ALTER TABLE workers ADD UNIQUE KEY unique_store_username (store_id, username)');
        console.log('✅ Índice único compuesto (store_id, username) en workers creado');
      }
    } catch (err) {
      console.error('❌ Error migrando índice workers:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS plans (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          max_stores INT NOT NULL DEFAULT 2,
          price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
          price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
          features JSON,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('ℹ️ Tabla plans verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla plans:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_plans (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          plan_id INT NOT NULL,
          billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
          starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ends_at TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        )
      `);
      console.log('ℹ️ Tabla user_plans verificada/creada');

      const [planRows] = await pool.execute('SELECT COUNT(*) as count FROM plans');
      if (planRows[0].count === 0) {
        console.log('⚠️ Insertando planes por defecto...');
        await pool.execute(`
          INSERT INTO plans (name, description, max_stores, price_monthly, price_yearly, features) VALUES
          ('Gratis', 'Plan gratuito básico', 2, 0, 0, '["2 tiendas máximo", "Gestión de productos", "Punto de venta"]'),
          ('Premium', 'Plan para negocios en crecimiento', 10, 11.00, 11.00, '["Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]')
        `);
        console.log('✅ Planes por defecto insertados');
      } else {
        const [existingPlans] = await pool.execute('SELECT * FROM plans');
        for (const plan of existingPlans) {
          if (plan.name === 'Profesional' || plan.name === 'Empresarial') {
            await pool.execute('DELETE FROM plans WHERE id = ?', [plan.id]);
            console.log('⚠️ Eliminando plan obsoleto:', plan.name);
          } else if (plan.name === 'Gratis') {
            await pool.execute(
              'UPDATE plans SET features = ? WHERE id = ?',
              ['["2 tiendas máximo", "Gestión de productos", "Punto de venta"]', plan.id]
            );
            console.log('ℹ️ Plan Gratis actualizado');
          }
        }
        const [remainingPlans] = await pool.execute("SELECT COUNT(*) as count FROM plans WHERE name = 'Premium'");
        if (remainingPlans[0].count === 0) {
          await pool.execute(`
            INSERT INTO plans (name, description, max_stores, price_monthly, price_yearly, features) VALUES
            ('Premium', 'Plan para negocios en crecimiento', 10, 11.00, 11.00, '["Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]')
          `);
          console.log('✅ Plan Premium insertado');
        } else {
          await pool.execute(
            'UPDATE plans SET price_monthly = 11.00, price_yearly = 11.00 WHERE name = ?',
            ['Premium']
          );
          console.log('ℹ️ Plan Premium actualizado a $11/$11');
        }
      }
    } catch (err) {
      console.error('❌ Error en user_plans:', err.message);
    }

    try {
      await pool.execute("ALTER TABLE user_plans MODIFY COLUMN billing_cycle ENUM('monthly', 'yearly', 'forever') DEFAULT 'monthly'");
      console.log('ℹ️ billing_cycle ENUM actualizado con forever');
    } catch (err) {
      if (!err.message.includes('Duplicate')) {
        console.error('❌ Error actualizando billing_cycle ENUM:', err.message);
      }
    }

    try {
      const [storeCols] = await pool.execute('SHOW COLUMNS FROM stores');
      const storeColNames = storeCols.map(c => c.Field);
      if (!storeColNames.includes('mp_access_token')) {
        await pool.execute('ALTER TABLE stores ADD COLUMN mp_access_token VARCHAR(500) DEFAULT NULL');
        console.log('✅ Columna mp_access_token agregada a stores');
      }
    } catch (err) {
      console.error('❌ Error migrando stores mp_access_token:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS apk_releases (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          version VARCHAR(50) NOT NULL,
          version_code INT NOT NULL DEFAULT 1,
          logo TEXT,
          apk_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('ℹ️ Tabla apk_releases verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla apk_releases:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL,
          worker_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          day_of_week TINYINT NOT NULL,
          due_time VARCHAR(5) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
          FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        )
      `);
      console.log('ℹ️ Tabla tasks verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla tasks:', err.message);
    }

    // Migración: agregar description a tasks si no existe
    try {
      const [taskCols] = await pool.execute('SHOW COLUMNS FROM tasks');
      if (!taskCols.map(c => c.Field).includes('description')) {
        await pool.execute('ALTER TABLE tasks ADD COLUMN description TEXT DEFAULT NULL AFTER name');
        console.log('✅ Columna description agregada a tasks');
      }
    } catch (err) {
      console.error('❌ Error migrando tasks.description:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS task_completions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          task_id INT NOT NULL,
          week_start DATE NOT NULL,
          completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_by_worker_id INT,
          UNIQUE KEY unique_task_week (task_id, week_start),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (completed_by_worker_id) REFERENCES workers(id) ON DELETE SET NULL
        )
      `);
      console.log('ℹ️ Tabla task_completions verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla task_completions:', err.message);
    }

    // Track which system update each user has seen last
    try {
      const [userCols] = await pool.execute('SHOW COLUMNS FROM users');
      if (!userCols.map(c => c.Field).includes('last_seen_update_id')) {
        await pool.execute('ALTER TABLE users ADD COLUMN last_seen_update_id INT NOT NULL DEFAULT 0');
        console.log('✅ Columna last_seen_update_id agregada a users');
      }
    } catch (err) {
      console.error('❌ Error agregando last_seen_update_id:', err.message);
    }

    // UberEats integration config
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ubereats_config (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL UNIQUE,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          webhook_secret VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);
      console.log('ℹ️ Tabla ubereats_config verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla ubereats_config:', err.message);
    }

    try {
      const [ordCols] = await pool.execute('SHOW COLUMNS FROM orders');
      if (!ordCols.map(c => c.Field).includes('ubereats_order_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN ubereats_order_id VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna ubereats_order_id agregada a orders');
      }
    } catch (err) {
      console.error('❌ Error agregando ubereats_order_id:', err.message);
    }

    // PedidosYa integration config
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS pedidosya_config (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL UNIQUE,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          webhook_secret VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);
      console.log('ℹ️ Tabla pedidosya_config verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla pedidosya_config:', err.message);
    }

    // Add pedidosya_order_id column to orders if needed
    try {
      const [ordCols] = await pool.execute('SHOW COLUMNS FROM orders');
      if (!ordCols.map(c => c.Field).includes('pedidosya_order_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN pedidosya_order_id VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna pedidosya_order_id agregada a orders');
      }
    } catch (err) {
      console.error('❌ Error agregando pedidosya_order_id:', err.message);
    }

    // Rappi integration config
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS rappi_config (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL UNIQUE,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          webhook_secret VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);
      console.log('ℹ️ Tabla rappi_config verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla rappi_config:', err.message);
    }

    // Add external columns to orders for Rappi/external platforms
    try {
      const [ordCols] = await pool.execute('SHOW COLUMNS FROM orders');
      const ordColNames = ordCols.map(c => c.Field);
      if (!ordColNames.includes('external_items')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN external_items JSON DEFAULT NULL');
        console.log('✅ Columna external_items agregada a orders');
      }
      if (!ordColNames.includes('customer_name')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN customer_name VARCHAR(255) DEFAULT NULL');
        console.log('✅ Columna customer_name agregada a orders');
      }
      if (!ordColNames.includes('customer_phone')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50) DEFAULT NULL');
        console.log('✅ Columna customer_phone agregada a orders');
      }
      if (!ordColNames.includes('rappi_order_id')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN rappi_order_id VARCHAR(100) DEFAULT NULL');
        console.log('✅ Columna rappi_order_id agregada a orders');
      }
      if (!ordColNames.includes('source')) {
        await pool.execute("ALTER TABLE orders ADD COLUMN source VARCHAR(20) DEFAULT NULL");
        console.log('✅ Columna source agregada a orders');
      }
    } catch (err) {
      console.error('❌ Error migrando columnas de orders para Rappi:', err.message);
    }

    // Client surveys (ideal client finder)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS client_surveys (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL,
          answers JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cs_store (store_id)
        )
      `);
      console.log('ℹ️ Tabla client_surveys verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla client_surveys:', err.message);
    }

    // Custom survey questions per store
    try {
      const [storeCols] = await pool.execute('SHOW COLUMNS FROM stores');
      if (!storeCols.map(c => c.Field).includes('survey_questions')) {
        await pool.execute('ALTER TABLE stores ADD COLUMN survey_questions JSON DEFAULT NULL');
        console.log('✅ Columna survey_questions agregada a stores');
      }
    } catch (err) {
      console.error('❌ Error agregando survey_questions:', err.message);
    }

    // Limpiar entradas duplicadas en inventory (mantener solo la de menor id por producto)
    try {
      await pool.execute(`
        DELETE i1 FROM inventory i1
        INNER JOIN inventory i2
        WHERE i1.product_id = i2.product_id AND i1.id > i2.id
      `);
      console.log('ℹ️ Duplicados de inventory limpiados');
    } catch (err) {
      console.error('❌ Error limpiando inventory duplicados:', err.message);
    }

    try {
      const [crCols] = await pool.execute('SHOW COLUMNS FROM cash_registers');
      if (!crCols.map(c => c.Field).includes('opening_amount')) {
        await pool.execute('ALTER TABLE cash_registers ADD COLUMN opening_amount DECIMAL(10,2) DEFAULT 0 AFTER worker_name');
        console.log('✅ Columna opening_amount agregada a cash_registers');
      }
    } catch (err) {
      console.error('❌ Error migrando cash_registers:', err.message);
    }

    // Scheduled WhatsApp messages
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS scheduled_whatsapp_messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          store_id INT NOT NULL,
          message TEXT NOT NULL,
          recipients JSON NOT NULL,
          scheduled_at DATETIME NOT NULL,
          recurrence ENUM('none','daily') DEFAULT 'none',
          status ENUM('pending','sent','failed','cancelled') DEFAULT 'pending',
          sent_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_swm_status (status),
          INDEX idx_swm_scheduled (scheduled_at)
        )
      `);
      // Add recurrence column if table already existed without it
      try {
        await pool.execute(`ALTER TABLE scheduled_whatsapp_messages ADD COLUMN recurrence ENUM('none','daily') DEFAULT 'none'`);
      } catch {}
      console.log('ℹ️ Tabla scheduled_whatsapp_messages verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla scheduled_whatsapp_messages:', err.message);
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

function generateUniqueVendorUsername() {
  // Genera un username único: "vendor_XXXXX" donde X es aleatorio
  // Formato: vendor_ABC123 (vendor_ + 6 caracteres aleatorios)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `vendor_${suffix}`;
}

export async function createUser(username, email, password, business_name, country) {
  const hashedPassword = await bcrypt.hash(password, 10);
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password, code, business_name, country, email_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)',
    [username, email, hashedPassword, code, business_name || null, country || null]
  );

  return {
    id: result.insertId,
    username,
    email,
    code,
    business_name,
    email_verified: false
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

  await pool.execute('UPDATE users SET last_active = NOW() WHERE id = ?', [user.id]);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    code: user.code,
    business_name: user.business_name,
    is_banned: user.is_banned,
    totp_enabled: Boolean(user.totp_enabled),
    totp_secret: user.totp_secret || null,
    email_verified: Boolean(user.email_verified)
  };
}

export async function setTotpSecret(userId, secret) {
  await pool.execute('UPDATE users SET totp_secret = ? WHERE id = ?', [secret, userId]);
}

export async function enableTotp(userId) {
  await pool.execute('UPDATE users SET totp_enabled = TRUE WHERE id = ?', [userId]);
}

export async function disableTotp(userId) {
  await pool.execute('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = ?', [userId]);
}

export async function updateUserPassword(userId, hashedPassword) {
  await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
}

export async function getUserByEmail(email) {
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

export async function setVerificationCode(userId, code, expires) {
  await pool.execute(
    'UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?',
    [code, expires, userId]
  );
}

export async function markEmailVerified(userId) {
  await pool.execute(
    'UPDATE users SET email_verified = TRUE, verification_code = NULL, verification_expires = NULL WHERE id = ?',
    [userId]
  );
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
    'SELECT id, username, email, code, business_name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, totp_enabled, totp_secret FROM users WHERE id = ?',
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
  const canCreate = await canUserCreateStore(userId);
  
  if (!canCreate.canCreate) {
    const error = new Error(`Has alcanzado el límite de ${canCreate.maxStores} tiendas. Actualiza tu plan para crear más tiendas.`);
    error.code = 'STORE_LIMIT_REACHED';
    error.maxStores = canCreate.maxStores;
    error.currentPlan = canCreate.currentPlan;
    throw error;
  }

  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, logo_url } = data;
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    `INSERT INTO stores (user_id, code, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, logo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, code, name, primary_color || '#000000', secondary_color || '#FFFFFF', accent_color || '#D4AF37', header_color || '#000000', currency_code || 'USD', currency_symbol || '$', currency_name || 'Dólar Estadounidense', logo_url || null]
  );

  const storeId = result.insertId;
  
  // Generar username único y aleatorio para el vendedor
  let vendorUsername = generateUniqueVendorUsername();
  let [existingWorker] = await pool.execute('SELECT id FROM workers WHERE username = ?', [vendorUsername]);
  
  // Asegurar que el username sea realmente único
  while (existingWorker.length > 0) {
    vendorUsername = generateUniqueVendorUsername();
    [existingWorker] = await pool.execute('SELECT id FROM workers WHERE username = ?', [vendorUsername]);
  }
  
  const defaultPassword = await bcrypt.hash('12345', 10);
  await pool.execute(
    'INSERT INTO workers (store_id, username, password, name) VALUES (?, ?, ?, ?)',
    [storeId, vendorUsername, defaultPassword, 'Vendedor']
  );

  return {
    id: storeId,
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
    logo_url: logo_url || null
  };
}

export async function updateStore(storeId, userId, data) {
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, logo_url, worker_accept_cash, worker_accept_card, smart_mode, inactivity_timeout, hide_decimals, show_top_selling } = data;

  // Ensure columns exist
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM stores');
    const names = cols.map(c => c.Field);
    if (!names.includes('smart_mode')) await pool.execute('ALTER TABLE stores ADD COLUMN smart_mode BOOLEAN DEFAULT TRUE');
    if (!names.includes('inactivity_timeout')) await pool.execute('ALTER TABLE stores ADD COLUMN inactivity_timeout INT DEFAULT 120');
    if (!names.includes('hide_decimals')) await pool.execute('ALTER TABLE stores ADD COLUMN hide_decimals BOOLEAN DEFAULT FALSE');
    if (!names.includes('show_top_selling')) await pool.execute('ALTER TABLE stores ADD COLUMN show_top_selling BOOLEAN DEFAULT TRUE');
  } catch { /* ignore */ }

  let query = `UPDATE stores SET name = ?, primary_color = ?, secondary_color = ?, accent_color = ?, header_color = ?, currency_code = ?, currency_symbol = ?, currency_name = ?`;
  let params = [name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name];

  if (logo_url !== undefined) {
    query += `, logo_url = ?`;
    params.push(logo_url);
  }

  if (worker_accept_cash !== undefined) {
    query += `, worker_accept_cash = ?`;
    params.push(worker_accept_cash ? 1 : 0);
  }

  if (worker_accept_card !== undefined) {
    query += `, worker_accept_card = ?`;
    params.push(worker_accept_card ? 1 : 0);
  }

  if (smart_mode !== undefined) {
    query += `, smart_mode = ?`;
    params.push(smart_mode === true || smart_mode === 'true' || smart_mode === '1' ? 1 : 0);
  }

  if (inactivity_timeout !== undefined) {
    query += `, inactivity_timeout = ?`;
    params.push(parseInt(inactivity_timeout) || 120);
  }

  if (hide_decimals !== undefined) {
    query += `, hide_decimals = ?`;
    params.push(hide_decimals ? 1 : 0);
  }

  if (show_top_selling !== undefined) {
    query += `, show_top_selling = ?`;
    params.push(show_top_selling ? 1 : 0);
  }

  query += ` WHERE id = ? AND user_id = ?`;
  params.push(storeId, userId);
  
  await pool.execute(query, params);
  
  const [rows] = await pool.execute('SELECT * FROM stores WHERE id = ?', [storeId]);
  return rows[0];
}

export async function deleteStore(storeId, userId) {
  await pool.execute(
    'DELETE FROM stores WHERE id = ? AND user_id = ?',
    [storeId, userId]
  );
  return true;
}

export async function verifyStoreOwnership(storeId, userId) {
  const [rows] = await pool.execute(
    'SELECT id FROM stores WHERE id = ? AND user_id = ?',
    [storeId, userId]
  );
  return rows.length > 0;
}

export async function duplicateStore(storeId, userId, newName) {
  const canCreate = await canUserCreateStore(userId);
  if (!canCreate.canCreate) {
    const error = new Error(`Has alcanzado el límite de ${canCreate.maxStores} tiendas. Actualiza tu plan para crear más tiendas.`);
    error.code = 'STORE_LIMIT_REACHED';
    error.maxStores = canCreate.maxStores;
    error.currentPlan = canCreate.currentPlan;
    throw error;
  }

  const [origRows] = await pool.execute('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, userId]);
  if (!origRows.length) throw new Error('Tienda no encontrada');
  const orig = origRows[0];

  let code = generateCode();
  while (true) {
    const [ex] = await pool.execute('SELECT id FROM stores WHERE code = ?', [code]);
    if (!ex.length) break;
    code = generateCode();
  }

  const [storeResult] = await pool.execute(
    `INSERT INTO stores (user_id, code, name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, logo_url, smart_mode, inactivity_timeout, hide_decimals, show_top_selling, worker_accept_cash, worker_accept_card)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, code, newName, orig.primary_color, orig.secondary_color, orig.accent_color, orig.header_color,
     orig.currency_code, orig.currency_symbol, orig.currency_name, orig.logo_url,
     orig.smart_mode ?? 1, orig.inactivity_timeout ?? 120, orig.hide_decimals ?? 0,
     orig.show_top_selling ?? 1, orig.worker_accept_cash ?? null, orig.worker_accept_card ?? null]
  );
  const newStoreId = storeResult.insertId;

  // Create default vendor worker for the new store with unique username
  let vendorUsername = generateUniqueVendorUsername();
  let [existingWorker] = await pool.execute('SELECT id FROM workers WHERE username = ?', [vendorUsername]);
  
  // Asegurar que el username sea realmente único
  while (existingWorker.length > 0) {
    vendorUsername = generateUniqueVendorUsername();
    [existingWorker] = await pool.execute('SELECT id FROM workers WHERE username = ?', [vendorUsername]);
  }
  
  const defaultPassword = await bcrypt.hash('12345', 10);
  await pool.execute(
    'INSERT INTO workers (store_id, username, password, name) VALUES (?, ?, ?, ?)',
    [newStoreId, vendorUsername, defaultPassword, 'Vendedor']
  );

  // Copy categories
  const [cats] = await pool.execute('SELECT * FROM categories WHERE store_id = ?', [storeId]);
  const catMap = {};
  for (const cat of cats) {
    const [r] = await pool.execute(
      'INSERT INTO categories (store_id, user_id, name, description) VALUES (?, ?, ?, ?)',
      [newStoreId, cat.user_id, cat.name, cat.description]
    );
    catMap[cat.id] = r.insertId;
  }

  // Copy ingredients
  const [ings] = await pool.execute('SELECT * FROM ingredients WHERE store_id = ?', [storeId]);
  const ingMap = {};
  for (const ing of ings) {
    const newCatId = ing.category_id ? (catMap[ing.category_id] ?? null) : null;
    const [r] = await pool.execute(
      'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image) VALUES (?, ?, ?, ?, ?, ?)',
      [newStoreId, userId, ing.name, ing.price, newCatId, ing.image]
    );
    ingMap[ing.id] = r.insertId;
  }

  // Copy extras
  const [exts] = await pool.execute('SELECT * FROM extras WHERE store_id = ?', [storeId]);
  const extMap = {};
  for (const ext of exts) {
    const newCatId = ext.category_id ? (catMap[ext.category_id] ?? null) : null;
    const [r] = await pool.execute(
      'INSERT INTO extras (store_id, user_id, name, price, category_id, image) VALUES (?, ?, ?, ?, ?, ?)',
      [newStoreId, userId, ext.name, ext.price, newCatId, ext.image]
    );
    extMap[ext.id] = r.insertId;
  }

  // Copy products
  const [prods] = await pool.execute('SELECT * FROM products WHERE store_id = ?', [storeId]);
  const prodMap = {};
  for (const prod of prods) {
    const newCatId = prod.category_id ? (catMap[prod.category_id] ?? null) : null;
    const [r] = await pool.execute(
      'INSERT INTO products (store_id, user_id, category_id, name, description, price, image, sort_order, complements_configured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newStoreId, userId, newCatId, prod.name, prod.description, prod.price, prod.image, prod.sort_order, prod.complements_configured ?? 0]
    );
    prodMap[prod.id] = r.insertId;

    // Copy product_ingredients
    const [pings] = await pool.execute('SELECT * FROM product_ingredients WHERE product_id = ?', [prod.id]);
    for (const pi of pings) {
      const newIngId = ingMap[pi.ingredient_id];
      if (newIngId) {
        await pool.execute(
          'INSERT INTO product_ingredients (product_id, ingredient_id, is_required, max_selections) VALUES (?, ?, ?, ?)',
          [prodMap[prod.id], newIngId, pi.is_required, pi.max_selections]
        );
      }
    }

    // Copy product_extras
    const [pexts] = await pool.execute('SELECT * FROM product_extras WHERE product_id = ?', [prod.id]);
    for (const pe of pexts) {
      const newExtId = extMap[pe.extra_id];
      if (newExtId) {
        await pool.execute(
          'INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)',
          [prodMap[prod.id], newExtId]
        );
      }
    }

    // Copy inventory
    const [invRows] = await pool.execute('SELECT * FROM inventory WHERE product_id = ?', [prod.id]);
    if (invRows.length) {
      const inv = invRows[0];
      await pool.execute(
        'INSERT INTO inventory (product_id, stock, min_stock, unlimited_stock) VALUES (?, ?, ?, ?)',
        [prodMap[prod.id], inv.stock, inv.min_stock, inv.unlimited_stock]
      );
    }
  }

  // Copy store configurations
  const [configs] = await pool.execute('SELECT * FROM store_configurations WHERE store_id = ?', [storeId]);
  for (const cfg of configs) {
    await pool.execute(
      `INSERT INTO store_configurations (store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newStoreId, cfg.name, cfg.description, cfg.accept_cash, cfg.accept_card, cfg.is_active, cfg.is_default,
       cfg.is_minimarket, cfg.allow_serve, cfg.allow_takeout, cfg.hide_decimals, cfg.allow_table_service,
       cfg.tip_percentage, cfg.delivery_enabled, cfg.delivery_payment_methods]
    );
  }

  const [newStore] = await pool.execute('SELECT * FROM stores WHERE id = ?', [newStoreId]);
  return newStore[0];
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

export async function setStoreEditPin(storeId, userId, pin) {
  await pool.execute(
    'UPDATE stores SET store_edit_pin = ? WHERE id = ? AND user_id = ?',
    [pin || null, storeId, userId]
  );
  return true;
}

export async function verifyStoreEditPin(storeId, pin) {
  const [rows] = await pool.execute(
    'SELECT store_edit_pin FROM stores WHERE id = ?',
    [storeId]
  );
  if (rows.length === 0) return false;
  const storedPin = rows[0].store_edit_pin || '1234';
  return storedPin === pin;
}

export async function getStoreEditPin(storeId) {
  const [rows] = await pool.execute(
    'SELECT store_edit_pin FROM stores WHERE id = ?',
    [storeId]
  );
  return rows.length > 0 ? rows[0].store_edit_pin : null;
}

export async function getCategories(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM categories WHERE store_id = ? ORDER BY sort_order ASC, name ASC',
    [storeId]
  );
  return rows;
}

export async function updateCategoriesOrder(storeId, categoryOrders) {
  for (let i = 0; i < categoryOrders.length; i++) {
    await pool.execute(
      'UPDATE categories SET sort_order = ? WHERE id = ? AND store_id = ?',
      [i, categoryOrders[i].id, storeId]
    );
  }
  return true;
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

export async function updateIngredientsOrder(storeId, items) {
  for (const item of items) {
    await pool.execute('UPDATE ingredients SET sort_order = ? WHERE id = ? AND store_id = ?', [item.sort_order, item.id, storeId]);
  }
}

export async function updateExtrasOrder(storeId, items) {
  for (const item of items) {
    await pool.execute('UPDATE extras SET sort_order = ? WHERE id = ? AND store_id = ?', [item.sort_order, item.id, storeId]);
  }
}

export async function getIngredients(storeId) {
  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category_name FROM ingredients i
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.store_id = ? ORDER BY i.sort_order, i.name`,
    [storeId]
  );
  return rows.map(ing => ({
    ...ing,
    price: parseFloat(ing.price) || 0,
    stock: parseInt(ing.stock) || 0,
    unlimited_stock: ing.unlimited_stock || false,
    stock_unit: ing.stock_unit || 'unidades',
  }));
}

export async function createIngredient(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades']
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function updateIngredient(ingredientId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit } = data;
  await pool.execute(
    'UPDATE ingredients SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ?, stock_unit = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades', ingredientId, storeId]
  );
  return { id: ingredientId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
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
     WHERE e.store_id = ? ORDER BY e.sort_order, e.name`,
    [storeId]
  );
  return rows.map(ext => ({
    ...ext,
    price: parseFloat(ext.price) || 0,
    stock: parseInt(ext.stock) || 0,
    unlimited_stock: ext.unlimited_stock || false,
    stock_unit: ext.stock_unit || 'unidades',
  }));
}

export async function createExtra(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit } = data;
  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO extras (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades']
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function updateExtra(extraId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit } = data;
  await pool.execute(
    'UPDATE extras SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ?, stock_unit = ? WHERE id = ? AND store_id = ?',
    [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades', extraId, storeId]
  );
  return { id: extraId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
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
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods } = data;
  const tipPct = parseFloat(tip_percentage) || 0;
  const delivMethods = Array.isArray(delivery_payment_methods) ? delivery_payment_methods.join(',') : (delivery_payment_methods || 'tuu,mercadopago');

  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }

  const [result] = await pool.execute(
    'INSERT INTO store_configurations (store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, is_default === true, is_minimarket === true, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false, hide_decimals === true, allow_table_service === true, tipPct, delivery_enabled === true, delivMethods]
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
    allow_takeout: allow_takeout !== false,
    hide_decimals: hide_decimals === true,
    allow_table_service: allow_table_service === true,
    tip_percentage: tipPct,
    delivery_enabled: delivery_enabled === true,
    delivery_payment_methods: delivMethods
  };
}

export async function updateStoreConfiguration(configId, storeId, data) {
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods } = data;
  const tipPct = parseFloat(tip_percentage) || 0;
  const delivMethods = Array.isArray(delivery_payment_methods) ? delivery_payment_methods.join(',') : (delivery_payment_methods || 'tuu,mercadopago');

  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }

  await pool.execute(
    'UPDATE store_configurations SET name = ?, description = ?, accept_cash = ?, accept_card = ?, is_active = ?, is_default = ?, is_minimarket = ?, default_minimarket_terminal = ?, allow_serve = ?, allow_takeout = ?, hide_decimals = ?, allow_table_service = ?, tip_percentage = ?, delivery_enabled = ?, delivery_payment_methods = ? WHERE id = ? AND store_id = ?',
    [name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, is_default === true, is_minimarket === true, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false, hide_decimals === true, allow_table_service === true, tipPct, delivery_enabled === true, delivMethods, configId, storeId]
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
    allow_takeout: allow_takeout !== false,
    hide_decimals: hide_decimals === true,
    allow_table_service: allow_table_service === true,
    tip_percentage: tipPct,
    delivery_enabled: delivery_enabled === true,
    delivery_payment_methods: delivMethods
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
  const [prodRows] = await pool.execute(
    'SELECT complements_configured, has_ingredients, store_id FROM products WHERE id = ?', [productId]
  );
  if (!prodRows.length) return [];
  const { complements_configured, has_ingredients, store_id } = prodRows[0];

  const mapRow = row => ({
    id: row.id, name: row.name, price: parseFloat(row.price), category_id: row.category_id, image: row.image,
    stock: parseInt(row.stock) || 0, unlimited_stock: row.unlimited_stock || false,
    is_required: false, max_selections: 1
  });

  if (complements_configured) {
    const [rows] = await pool.execute(`
      SELECT i.*, COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
      FROM ingredients i
      INNER JOIN product_ingredients pi ON pi.ingredient_id = i.id AND pi.product_id = ?
      ORDER BY i.sort_order, i.name
    `, [productId]);
    // If specifically configured but no links exist and product still expects ingredients,
    // fall back to all store-level ingredients so the step is not silently skipped
    if (rows.length > 0 || !has_ingredients) return rows.map(mapRow);
  }

  const [rows] = await pool.execute(`
    SELECT i.*, COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
    FROM ingredients i
    WHERE i.store_id = ?
    ORDER BY i.sort_order, i.name
  `, [store_id]);
  return rows.map(mapRow);
}

async function getProductExtras(productId, categoryId = null) {
  const [prodRows] = await pool.execute(
    'SELECT complements_configured, has_extras, store_id FROM products WHERE id = ?', [productId]
  );
  if (!prodRows.length) return [];
  const { complements_configured, has_extras, store_id } = prodRows[0];

  const mapRow = row => ({
    id: row.id, name: row.name, price: parseFloat(row.price), category_id: row.category_id, image: row.image,
    stock: parseInt(row.stock) || 0, unlimited_stock: row.unlimited_stock || false
  });

  if (complements_configured) {
    const [rows] = await pool.execute(`
      SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
      FROM extras e
      INNER JOIN product_extras pe ON pe.extra_id = e.id AND pe.product_id = ?
      ORDER BY e.sort_order, e.name
    `, [productId]);
    // If specifically configured but no links exist and product still expects extras,
    // fall back to all store-level extras so the step is not silently skipped
    if (rows.length > 0 || !has_extras) return rows.map(mapRow);
  }

  const [rows] = await pool.execute(`
    SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
    FROM extras e
    WHERE e.store_id = ?
    ORDER BY e.sort_order, e.name
  `, [store_id]);
  return rows.map(mapRow);
}

export async function getProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name,
           COALESCE((SELECT stock FROM inventory WHERE product_id = p.id LIMIT 1), 0) as stock,
           CASE WHEN (SELECT id FROM inventory WHERE product_id = p.id LIMIT 1) IS NULL
                THEN TRUE
                ELSE COALESCE((SELECT unlimited_stock FROM inventory WHERE product_id = p.id LIMIT 1), FALSE)
           END as unlimited_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ?
    ORDER BY p.sort_order ASC, p.created_at DESC
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      stock: parseInt(product.stock) || 0,
      unlimited_stock: product.unlimited_stock || false,
      has_extras: !!product.has_extras,
      has_ingredients: !!product.has_ingredients,
      max_extras: parseInt(product.max_extras) || 0,
      max_ingredients: parseInt(product.max_ingredients) || 0,
      ingredients: await getProductIngredients(product.id, product.category_id),
      extras: await getProductExtras(product.id, product.category_id)
    };
    products.push(prod);
  }
  return products;
}

export async function createProduct(storeId, data) {
  const { name, barcode, description, price, category_id, image, has_extras, has_ingredients, max_extras, max_ingredients } = data;

  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO products (store_id, user_id, category_id, name, barcode, description, price, image, has_extras, has_ingredients, max_extras, max_ingredients) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, category_id || null, name, barcode || null, description || null, price, image || null, has_extras ? 1 : 0, has_ingredients ? 1 : 0, parseInt(max_extras) || 0, parseInt(max_ingredients) || 0]
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
    image,
    has_extras: !!has_extras,
    has_ingredients: !!has_ingredients,
    max_extras: parseInt(max_extras) || 0,
    max_ingredients: parseInt(max_ingredients) || 0,
    stock: 0,
    unlimited_stock: true,
    ingredients: await getProductIngredients(productId, category_id),
    extras: await getProductExtras(productId, category_id)
  };
}

export async function updateProduct(productId, storeId, data) {
  const { name, barcode, description, price, category_id, image, has_extras, has_ingredients, max_extras, max_ingredients } = data;

  await pool.execute(
    'UPDATE products SET name = ?, barcode = ?, description = ?, price = ?, category_id = ?, image = ?, has_extras = ?, has_ingredients = ?, max_extras = ?, max_ingredients = ? WHERE id = ? AND store_id = ?',
    [name, barcode || null, description || null, price, category_id || null, image || null, has_extras ? 1 : 0, has_ingredients ? 1 : 0, parseInt(max_extras) || 0, parseInt(max_ingredients) || 0, productId, storeId]
  );

  // Get current stock from inventory
  const [invRows] = await pool.execute(
    'SELECT stock, unlimited_stock FROM inventory WHERE product_id = ?', [productId]
  );
  const stock = invRows[0]?.stock || 0;
  const unlimited_stock = invRows[0]?.unlimited_stock || false;

  return {
    id: productId,
    store_id: storeId,
    category_id,
    name,
    barcode,
    description,
    price,
    image,
    has_extras: !!has_extras,
    has_ingredients: !!has_ingredients,
    max_extras: parseInt(max_extras) || 0,
    max_ingredients: parseInt(max_ingredients) || 0,
    stock: parseInt(stock) || 0,
    unlimited_stock: !!unlimited_stock,
    ingredients: await getProductIngredients(productId, category_id),
    extras: await getProductExtras(productId, category_id)
  };
}

export async function deleteProduct(productId, storeId) {
  await pool.execute(
    'DELETE FROM products WHERE id = ? AND store_id = ?',
    [productId, storeId]
  );
  return true;
}

export async function updateProductsOrder(storeId, productOrders) {
  for (let i = 0; i < productOrders.length; i++) {
    await pool.execute(
      'UPDATE products SET sort_order = ? WHERE id = ? AND store_id = ?',
      [i, productOrders[i].id, storeId]
    );
  }
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
    has_extras: !!rows[0].has_extras,
    has_ingredients: !!rows[0].has_ingredients,
    max_extras: parseInt(rows[0].max_extras) || 0,
    max_ingredients: parseInt(rows[0].max_ingredients) || 0,
    ingredients: await getProductIngredients(productId, rows[0].category_id),
    extras: await getProductExtras(productId, rows[0].category_id)
  };
  return product;
}

export async function getPublicProducts(storeId) {
  const [rows] = await pool.execute(`
    SELECT p.*, c.name as category_name,
           COALESCE((SELECT stock FROM inventory WHERE product_id = p.id LIMIT 1), 0) as stock,
           CASE WHEN (SELECT id FROM inventory WHERE product_id = p.id LIMIT 1) IS NULL
                THEN TRUE
                ELSE COALESCE((SELECT unlimited_stock FROM inventory WHERE product_id = p.id LIMIT 1), FALSE)
           END as unlimited_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ?
    ORDER BY p.sort_order ASC, p.name
  `, [storeId]);
  
  const products = [];
  for (const product of rows) {
    const prod = {
      ...product,
      price: parseFloat(product.price),
      stock: parseInt(product.stock) || 0,
      unlimited_stock: product.unlimited_stock || false,
      has_extras: !!product.has_extras,
      has_ingredients: !!product.has_ingredients,
      max_extras: parseInt(product.max_extras) || 0,
      max_ingredients: parseInt(product.max_ingredients) || 0,
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

export async function generateUniqueOrderNumber(storeId) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const [usedRows] = await pool.execute(
    "SELECT order_number FROM orders WHERE store_id = ? AND DATE(created_at) = CURDATE() AND order_number IS NOT NULL",
    [storeId]
  );
  const used = new Set(usedRows.map(r => r.order_number));
  // Try random letter+2 digits up to 100 attempts
  for (let i = 0; i < 100; i++) {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const num = (Math.floor(Math.random() * 99) + 1).toString().padStart(2, '0');
    const candidate = `${letter}${num}`;
    if (!used.has(candidate)) return candidate;
  }
  // Fallback: linear scan if random fails (when most are used)
  for (const letter of letters) {
    for (let n = 1; n <= 99; n++) {
      const candidate = `${letter}${n.toString().padStart(2, '0')}`;
      if (!used.has(candidate)) return candidate;
    }
  }
  // All 2574 used: fallback to numeric
  return (used.size + 1).toString();
}

export async function createOrder(storeId, orderData) {
  const { order_type, items, payment_method, coupon_code, table_number } = orderData;
  
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.unit_price * item.quantity;
  });

  const couponData = await resolveCouponForOrder(storeId, coupon_code, subtotal);
  const total = orderData.custom_total != null ? Number(orderData.custom_total) : couponData.total;

  const fromWorker = orderData.from_worker === true;
  const cashApproved = payment_method === 'card' ? true : fromWorker;
  const paymentProcess = fromWorker ? 1 : 0;

  const store = await getStoreById(storeId);
  const initialStatus = paymentProcess === 1 ? 'preparing' : 'pending';

  // Resolve pos_pin from terminal_id if not provided directly
  let posPin = orderData.pos_pin || null;
  if (!posPin && orderData.terminal_id) {
    const [pinRows] = await pool.execute('SELECT pos_pin FROM pos_terminals WHERE id = ? LIMIT 1', [orderData.terminal_id]).catch(() => [[]]);
    posPin = pinRows[0]?.pos_pin || null;
  }

  const [result] = await pool.execute(
    'INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, coupon_code, total, payment_method, cash_approved, mp_order_id, external_reference, terminal_id, pos_pin, payment_process, status, table_number, source, customer_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, order_type || 'serve', couponData.subtotal, couponData.discount_total, couponData.coupon_code, total, payment_method || 'card', cashApproved, orderData.mp_order_id || null, orderData.external_reference || null, orderData.terminal_id || null, posPin, paymentProcess, initialStatus, table_number || null, orderData.source || null, orderData.customer_phone || null]
  );
  const orderId = result.insertId;

  if (couponData.coupon_id) {
    await pool.execute(
      'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?',
      [couponData.coupon_id]
    );
  }
  
  let orderNumber = null;
  if (!orderData.delivery) {
    orderNumber = await generateUniqueOrderNumber(storeId);
    await pool.execute('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);
  }
  const finalOrder = {
    id: orderId,
    order_number: orderNumber,
    store_id: storeId,
    order_type,
    subtotal: couponData.subtotal,
    discount_total: couponData.discount_total,
    coupon_code: couponData.coupon_code,
    total,
    status: initialStatus,
    payment_method,
    cash_approved: cashApproved,
    table_number: table_number || null,
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

    // Deduct product stock
    const [invRows] = await pool.execute(
      'SELECT unlimited_stock FROM inventory WHERE product_id = ?',
      [item.product_id]
    );
    if (invRows.length > 0 && !invRows[0].unlimited_stock) {
      await pool.execute(
        'UPDATE inventory SET stock = GREATEST(0, stock - ?) WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Deduct complement (ingredient) stock and raw materials
    for (const ing of (item.selected_ingredients || [])) {
      const ingName = typeof ing === 'string' ? ing : ing?.name;
      if (!ingName) continue;
      const [ingRows] = await pool.execute(
        'SELECT id, unlimited_stock FROM ingredients WHERE store_id = ? AND name = ? LIMIT 1',
        [storeId, ingName]
      );
      if (ingRows.length > 0) {
        if (!ingRows[0].unlimited_stock) {
          await pool.execute(
            'UPDATE ingredients SET stock = GREATEST(0, stock - ?) WHERE id = ?',
            [item.quantity, ingRows[0].id]
          );
        }
        // Deduct raw materials for this ingredient (recipe) — multiplied by order quantity
        const [ingRecipe] = await pool.execute(
          'SELECT raw_material_id, quantity_used FROM product_recipes WHERE item_type = ? AND item_id = ?',
          ['ingredient', ingRows[0].id]
        );
        for (const r of ingRecipe) {
          await pool.execute(
            'UPDATE raw_materials SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
            [r.quantity_used * item.quantity, r.raw_material_id]
          );
        }
      }
    }

    // Deduct extra stock and raw materials
    for (const ext of (item.selected_extras || [])) {
      const extName = typeof ext === 'string' ? ext : ext?.name;
      if (!extName) continue;
      const [extRows] = await pool.execute(
        'SELECT id, unlimited_stock FROM extras WHERE store_id = ? AND name = ? LIMIT 1',
        [storeId, extName]
      );
      if (extRows.length > 0) {
        if (!extRows[0].unlimited_stock) {
          await pool.execute(
            'UPDATE extras SET stock = GREATEST(0, stock - ?) WHERE id = ?',
            [item.quantity, extRows[0].id]
          );
        }
        // Deduct raw materials for this extra (recipe) — multiplied by order quantity
        const [extRecipe] = await pool.execute(
          'SELECT raw_material_id, quantity_used FROM product_recipes WHERE item_type = ? AND item_id = ?',
          ['extra', extRows[0].id]
        );
        for (const r of extRecipe) {
          await pool.execute(
            'UPDATE raw_materials SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
            [r.quantity_used * item.quantity, r.raw_material_id]
          );
        }
      }
    }

    // Deduct raw materials for product (recipe) — multiplied by order quantity
    const [prodRecipe] = await pool.execute(
      'SELECT raw_material_id, quantity_used FROM product_recipes WHERE item_type = ? AND item_id = ?',
      ['product', item.product_id]
    );
    for (const r of prodRecipe) {
      await pool.execute(
        'UPDATE raw_materials SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
        [r.quantity_used * item.quantity, r.raw_material_id]
      );
    }
  }

  return finalOrder;
}

export async function getOrders(storeId, todayOnly = false) {
  const dateFilter = todayOnly ? 'AND DATE(o.created_at) = CURDATE()' : '';
  const [rows] = await pool.execute(
    `SELECT o.*, w.name as completed_by_name
     FROM orders o
     LEFT JOIN workers w ON o.completed_by = w.id
     WHERE o.store_id = ? AND (o.payment_process = 1 OR (o.payment_method = 'cash' AND o.cash_approved = 0))
     ${dateFilter}
     ORDER BY o.created_at DESC`,
    [storeId]
  );

  const orders = [];
  for (const order of rows) {
    const totalValue = parseFloat(order.total);
    let items = await getOrderItems(order.id);
    // For external-platform orders (Rappi etc.) use external_items when no order_items exist
    if (!items.length && order.external_items) {
      try {
        const ext = typeof order.external_items === 'string' ? JSON.parse(order.external_items) : order.external_items;
        items = ext.map(i => ({ ...i, product_name: i.name, selected_ingredients: [], selected_extras: [] }));
      } catch {}
    }
    const ord = {
      ...order,
      total: isNaN(totalValue) ? 0 : totalValue,
      table_number: order.table_number ?? null,
      service_type: order.table_number != null ? 'servir' : 'llevar',
      items,
    };
    orders.push(ord);
  }
  return orders;
}

export async function getWhatsAppOrders(storeId) {
  const [rows] = await pool.execute(
    `SELECT o.*, w.name as completed_by_name
     FROM orders o
     LEFT JOIN workers w ON o.completed_by = w.id
     WHERE o.store_id = ? AND o.source = 'whatsapp' AND DATE(o.created_at) = CURDATE()
     ORDER BY o.created_at DESC`,
    [storeId]
  );
  const orders = [];
  for (const order of rows) {
    const items = await getOrderItems(order.id);
    orders.push({
      ...order,
      total: parseFloat(order.total) || 0,
      items,
    });
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
    "UPDATE orders SET cash_approved = TRUE, payment_process = 1, status = 'preparing' WHERE id = ? AND store_id = ?",
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

  const [existing] = await pool.execute(
    'SELECT id FROM workers WHERE username = ? LIMIT 1',
    [username]
  );
  if (existing.length > 0) {
    throw new Error('El nombre de usuario ya está en uso. Elige otro.');
  }

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
    'SELECT id, store_id, username, name, phone, created_at FROM workers WHERE store_id = ? ORDER BY name',
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
  const { name, mercadopago_access_token, mercadopago_terminal_id, pos_pin } = data;

  const [result] = await pool.execute(
    `INSERT INTO mercado_pago_terminals (user_id, name, mercadopago_access_token, mercadopago_terminal_id, pos_pin)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, name, mercadopago_access_token, mercadopago_terminal_id, pos_pin || null]
  );

  return {
    id: result.insertId,
    user_id: userId,
    name,
    mercadopago_access_token,
    mercadopago_terminal_id,
    pos_pin: pos_pin || null
  };
}

export async function getMercadoPagoTerminalByPin(pin) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM mercado_pago_terminals WHERE pos_pin = ? LIMIT 1',
      [pin]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

export async function getMercadoPagoTerminals(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM mercado_pago_terminals WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function getMercadoPagoTerminalsByStore(storeId) {
  try {
    const [rows] = await pool.execute(
      `SELECT m.id, m.name, m.mercadopago_terminal_id
       FROM mercado_pago_terminals m
       JOIN mercadopago_terminal_stores ms ON ms.mercadopago_terminal_id = m.id
       WHERE ms.store_id = ?
       ORDER BY m.created_at DESC`,
      [storeId]
    );
    return rows;
  } catch {
    // Fallback if junction table doesn't exist
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
    const terminal = await getPosTerminalForStore(storeId, selected_terminal_id);
    if (!terminal) {
      throw new Error('La máquina seleccionada no está disponible para esta tienda');
    }
    mercadopago_access_token = terminal.api_key;
    mercadopago_terminal_id = terminal.device_id;
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
    `UPDATE orders SET cash_approved = TRUE, payment_process = 1, status = 'preparing',
     reference_id = COALESCE(reference_id, mp_order_id),
     sequence_id = COALESCE(sequence_id, external_reference)
     WHERE id = ? AND store_id = ?`,
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

export async function authenticateSuperadmin(email, password) {
  const [rows] = await pool.execute(
    'SELECT * FROM superadmin WHERE email = ?',
    [email]
  );
  
  if (rows.length === 0) {
    return null;
  }
  
  const superadmin = rows[0];
  const isValid = await bcrypt.compare(password, superadmin.password);
  
  if (!isValid) {
    return null;
  }
  
  const { password: _, ...safeSuperadmin } = superadmin;
  return safeSuperadmin;
}

export async function getAllUsers() {
  const [rows] = await pool.execute(`
    SELECT u.id, u.username, u.email, u.business_name, u.code, u.is_banned, u.created_at, u.last_active, u.country,
           COUNT(s.id) as store_count
    FROM users u
    LEFT JOIN stores s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY u.last_active DESC
  `);
  return rows;
}

export async function updateUserHeartbeat(userId, country) {
  if (country) {
    await pool.execute('UPDATE users SET last_active = NOW(), country = ? WHERE id = ?', [country, userId]);
  } else {
    await pool.execute('UPDATE users SET last_active = NOW() WHERE id = ?', [userId]);
  }
}

export async function updateUserBySuperadmin(userId, data) {
  const { email, password, is_banned } = data;
  
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute(
      'UPDATE users SET email = ?, password = ?, is_banned = ? WHERE id = ?',
      [email, hashedPassword, is_banned, userId]
    );
  } else {
    await pool.execute(
      'UPDATE users SET email = ?, is_banned = ? WHERE id = ?',
      [email, is_banned, userId]
    );
  }
  
  return { success: true };
}

export async function deleteUserBySuperadmin(userId) {
  await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  return { success: true };
}

export async function getAllStores() {
  const [rows] = await pool.execute(`
    SELECT s.*, u.username, u.email as user_email, u.business_name as user_business,
           (SELECT COUNT(*) FROM products WHERE store_id = s.id) as product_count,
           (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as order_count,
           (SELECT COUNT(*) FROM orders WHERE store_id = s.id AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as orders_30d,
           (SELECT MAX(created_at) FROM orders WHERE store_id = s.id) as last_order_at
    FROM stores s
    JOIN users u ON s.user_id = u.id
    ORDER BY last_order_at DESC, s.created_at DESC
  `);
  return rows;
}

export async function updateStoreBySuperadmin(storeId, data) {
  const { is_banned } = data;
  
  await pool.execute(
    'UPDATE stores SET is_banned = ? WHERE id = ?',
    [is_banned, storeId]
  );
  
  return { success: true };
}

export async function deleteStoreBySuperadmin(storeId) {
  await pool.execute('DELETE FROM stores WHERE id = ?', [storeId]);
  return { success: true };
}

// Worker Payment Methods
export async function getWorkerPaymentMethods(storeId) {
  const [rows] = await pool.execute('SELECT * FROM worker_payment_methods WHERE store_id = ? ORDER BY created_at ASC', [storeId]);
  return rows;
}

export async function createWorkerPaymentMethod(storeId, data) {
  const [result] = await pool.execute(
    'INSERT INTO worker_payment_methods (store_id, name, color, is_active) VALUES (?, ?, ?, ?)',
    [storeId, data.name, data.color || '#D4AF37', data.is_active !== false]
  );
  return { id: result.insertId, store_id: storeId, name: data.name, color: data.color || '#D4AF37', is_active: true };
}

export async function updateWorkerPaymentMethod(id, storeId, data) {
  await pool.execute(
    'UPDATE worker_payment_methods SET name = ?, color = ?, is_active = ? WHERE id = ? AND store_id = ?',
    [data.name, data.color, data.is_active !== false, id, storeId]
  );
  return { id, store_id: storeId, ...data };
}

export async function deleteWorkerPaymentMethod(id, storeId) {
  await pool.execute('DELETE FROM worker_payment_methods WHERE id = ? AND store_id = ?', [id, storeId]);
  return { success: true };
}

export async function createSuperadmin(email, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.execute(
    'INSERT INTO superadmin (email, password) VALUES (?, ?)',
    [email, hashedPassword]
  );
  return { success: true };
}

export async function getAllPlans() {
  const [rows] = await pool.execute('SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_monthly ASC');
  return rows;
}

export async function getUserPlan(userId) {
  const [rows] = await pool.execute(`
    SELECT up.*, p.name as plan_name, p.max_stores, p.price_monthly, p.price_yearly, p.features
    FROM user_plans up
    JOIN plans p ON up.plan_id = p.id
    WHERE up.user_id = ? AND up.is_active = TRUE AND up.ends_at > NOW()
    ORDER BY up.created_at DESC
    LIMIT 1
  `, [userId]);
  return rows[0] || null;
}

export async function getUserStoreCount(userId) {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM stores WHERE user_id = ?', [userId]);
  return rows[0].count;
}

export async function getAllSubscriptions() {
  const [rows] = await pool.execute(`
    SELECT 
      up.id as subscription_id,
      up.user_id,
      up.billing_cycle,
      up.starts_at,
      up.ends_at,
      up.is_active,
      up.created_at as subscribed_at,
      COALESCE(p.id, 1) as plan_id,
      COALESCE(p.name, 'Gratis') as plan_name,
      COALESCE(p.max_stores, 2) as max_stores,
      COALESCE(p.price_monthly, 0) as price_monthly,
      COALESCE(p.price_yearly, 0) as price_yearly,
      COALESCE(p.features, '["2 tiendas máximo", "Gestión de productos", "Punto de venta"]') as features,
      u.username,
      u.email,
      u.business_name,
      u.is_banned,
      u.created_at as user_created_at
    FROM users u
    LEFT JOIN user_plans up ON u.id = up.user_id
    LEFT JOIN plans p ON up.plan_id = p.id
    ORDER BY u.created_at DESC
  `);
  return rows;
}

export async function getSubscriptionHistory() {
  const [rows] = await pool.execute(`
    SELECT 
      u.id as user_id,
      u.username,
      u.email,
      u.business_name,
      u.is_banned,
      u.created_at as user_created_at,
      COALESCE(up.id, 0) as subscription_id,
      COALESCE(p.name, 'Gratis') as plan_name,
      COALESCE(p.id, 1) as plan_id,
      up.billing_cycle,
      up.starts_at,
      up.ends_at,
      up.is_active,
      up.created_at as subscribed_at,
      COALESCE(p.price_monthly, 0) as price_monthly,
      COALESCE(p.price_yearly, 0) as price_yearly
    FROM users u
    LEFT JOIN user_plans up ON u.id = up.user_id
    LEFT JOIN plans p ON up.plan_id = p.id
    ORDER BY u.email ASC, up.created_at DESC
  `);
  
  const usersMap = new Map();
  rows.forEach(row => {
    if (!usersMap.has(row.email)) {
      usersMap.set(row.email, {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        business_name: row.business_name,
        is_banned: row.is_banned,
        user_created_at: row.user_created_at,
        current_plan: row.plan_name,
        current_plan_id: row.plan_id,
        current_billing_cycle: row.billing_cycle,
        current_starts_at: row.starts_at,
        current_ends_at: row.ends_at,
        current_is_active: row.is_active,
        current_price_monthly: row.price_monthly,
        current_price_yearly: row.price_yearly,
        subscriptions: []
      });
    }
    if (row.subscription_id) {
      usersMap.get(row.email).subscriptions.push({
        id: row.subscription_id,
        plan_name: row.plan_name,
        plan_id: row.plan_id,
        billing_cycle: row.billing_cycle,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        is_active: row.is_active,
        subscribed_at: row.subscribed_at,
        price_monthly: row.price_monthly,
        price_yearly: row.price_yearly
      });
    }
  });
  
  return Array.from(usersMap.values());
}

export async function canUserCreateStore(userId) {
  const plan = await getUserPlan(userId);
  const storeCount = await getUserStoreCount(userId);
  
  if (!plan) {
    return { canCreate: storeCount < 2, maxStores: 2, currentPlan: 'Gratis' };
  }
  
  const maxStores = plan.max_stores;
  return { 
    canCreate: storeCount < maxStores, 
    maxStores, 
    currentPlan: plan.plan_name,
    storeCount 
  };
}

export async function assignPlanToUser(userId, planId, billingCycle = 'monthly') {
  const [plans] = await pool.execute('SELECT * FROM plans WHERE id = ?', [planId]);
  if (plans.length === 0) {
    throw new Error('Plan no encontrado');
  }
  
  const plan = plans[0];
  let endsAt;
  
  if (billingCycle === 'yearly') {
    endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  } else {
    endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);
  }
  
  await pool.execute(
    'UPDATE user_plans SET is_active = FALSE WHERE user_id = ?',
    [userId]
  );
  
  await pool.execute(
    'INSERT INTO user_plans (user_id, plan_id, billing_cycle, ends_at) VALUES (?, ?, ?, ?)',
    [userId, planId, billingCycle, endsAt]
  );
  
  return { success: true, plan: plan.name };
}

export async function getPlanById(planId) {
  const [rows] = await pool.execute('SELECT * FROM plans WHERE id = ?', [planId]);
  return rows[0] || null;
}

export async function assignPremiumByAdmin(userId, planId, forever, endsAtDate) {
  const [plans] = await pool.execute('SELECT * FROM plans WHERE id = ?', [planId]);
  if (plans.length === 0) {
    throw new Error('Plan no encontrado');
  }

  const plan = plans[0];
  let endsAt;

  if (forever) {
    endsAt = new Date('2037-12-31T23:59:59');
  } else if (endsAtDate) {
    endsAt = new Date(endsAtDate);
  } else {
    throw new Error('Debe especificar fecha o para siempre');
  }

  await pool.execute(
    'UPDATE user_plans SET is_active = FALSE WHERE user_id = ?',
    [userId]
  );

  await pool.execute(
    'INSERT INTO user_plans (user_id, plan_id, billing_cycle, ends_at) VALUES (?, ?, ?, ?)',
    [userId, planId, 'forever', endsAt]
  );

  return { success: true, plan: plan.name, ends_at: endsAt };
}

export async function getAnalytics(storeId, dateRange = 'week') {
  let dateFilter = '';
  const now = new Date();
  
  switch (dateRange) {
    case 'today':
      dateFilter = `AND DATE(o.created_at) = CURDATE()`;
      break;
    case 'week':
      dateFilter = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
      break;
    case 'month':
      dateFilter = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
      break;
    case 'year':
      dateFilter = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
      break;
    default:
      dateFilter = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  }

  const totalOrdersQuery = `
    SELECT COUNT(*) as total, 
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status IN ('pending', 'waiting') THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status IN ('cancelled') THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN total ELSE 0 END) as revenue
    FROM orders o
    WHERE store_id = ? ${dateFilter}
  `;

  const [totals] = await pool.execute(totalOrdersQuery, [storeId]);

  const avgOrderQuery = `
    SELECT AVG(total) as avg_order
    FROM orders
    WHERE store_id = ? AND status IN ('paid', 'processed', 'completed', 'approved') ${dateFilter.replace('o.', '')}
  `;
  
  const [avgResult] = await pool.execute(avgOrderQuery.replace('o.created_at', 'created_at').replace('DATE(o.created_at)', 'DATE(created_at)'), [storeId]);

  return {
    totalOrders: totals[0].total || 0,
    completedOrders: totals[0].completed || 0,
    pendingOrders: totals[0].pending || 0,
    cancelledOrders: totals[0].cancelled || 0,
    revenue: parseFloat(totals[0].revenue || 0),
    avgOrder: parseFloat(avgResult[0].avg_order || 0)
  };
}

export async function getSalesByDay(storeId, dateRange = 'week') {
  let interval = '7 DAY';
  switch (dateRange) {
    case 'today': interval = '1 DAY'; break;
    case 'week': interval = '7 DAY'; break;
    case 'month': interval = '30 DAY'; break;
    case 'year': interval = '365 DAY'; break;
  }

  const query = `
    SELECT DATE(created_at) as date,
           COUNT(*) as orders,
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN total ELSE 0 END) as revenue
    FROM orders
    WHERE store_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  
  const [rows] = await pool.execute(query, [storeId]);
  return rows;
}

export async function getTopProducts(storeId, limit = 10, dateRange = 'week') {
  let interval = '7 DAY';
  switch (dateRange) {
    case 'today': interval = '1 DAY'; break;
    case 'week': interval = '7 DAY'; break;
    case 'month': interval = '30 DAY'; break;
    case 'year': interval = '365 DAY'; break;
  }

  const query = `
    SELECT 
      p.id,
      p.name,
      p.image,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.store_id = ? 
      AND o.status IN ('paid', 'processed', 'completed', 'approved')
      AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    GROUP BY p.id, p.name, p.image
    ORDER BY total_sold DESC
    LIMIT ${parseInt(limit)}
  `;

  const [rows] = await pool.execute(query, [storeId]);
  return rows;
}

export async function getOrdersByHour(storeId, dateRange = 'week') {
  let interval = '7 DAY';
  switch (dateRange) {
    case 'today': interval = '1 DAY'; break;
    case 'week': interval = '7 DAY'; break;
    case 'month': interval = '30 DAY'; break;
    case 'year': interval = '365 DAY'; break;
  }

  const query = `
    SELECT 
      HOUR(created_at) as hour,
      COUNT(*) as orders
    FROM orders
    WHERE store_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
    GROUP BY HOUR(created_at)
    ORDER BY hour ASC
  `;
  
  const [rows] = await pool.execute(query, [storeId]);
  return rows;
}

export async function getRecentOrders(storeId, limit = 10) {
  const query = `
    SELECT 
      o.id,
      o.status,
      o.total,
      o.created_at,
      COUNT(oi.id) as items_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.store_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ${parseInt(limit)}
  `;

  const [rows] = await pool.execute(query, [storeId]);
  return rows;
}

// ============================================================
// MIGRACIÓN A TABLA UNIFICADA pos_terminals
// ============================================================

async function migrateToUnifiedPos() {
  try {
    // Solo corre una vez — si ya está marcada, salir
    const [done] = await pool.execute("SELECT name FROM _migrations WHERE name = 'pos_unified_v1'");
    if (done.length > 0) return;

    // ── Mercado Pago ──
    const [mpTerminals] = await pool.execute('SELECT * FROM mercado_pago_terminals').catch(() => [[]]);
    for (const t of mpTerminals) {
      const [storeRows] = await pool.execute(
        'SELECT store_id FROM mercadopago_terminal_stores WHERE mercadopago_terminal_id = ? LIMIT 1', [t.id]
      ).catch(() => [[]]);
      let storeId = storeRows[0]?.store_id;
      if (!storeId) {
        const [s] = await pool.execute('SELECT id FROM stores WHERE user_id = ? LIMIT 1', [t.user_id]).catch(() => [[]]);
        storeId = s[0]?.id;
      }
      if (!storeId) continue;
      const [ex] = await pool.execute('SELECT id FROM pos_terminals WHERE provider = "mercadopago" AND device_id = ?', [t.mercadopago_terminal_id]);
      if (ex.length > 0) continue;
      const pin = t.pos_pin || String(Math.floor(100000 + Math.random() * 900000));
      await pool.execute(
        `INSERT INTO pos_terminals (user_id, store_id, provider, name, api_key, device_id, pos_pin) VALUES (?, ?, 'mercadopago', ?, ?, ?, ?)`,
        [t.user_id, storeId, t.name, t.mercadopago_access_token, t.mercadopago_terminal_id, pin]
      );
    }

    // ── TUU ──
    const [tuuDevices] = await pool.execute('SELECT * FROM tuu_devices').catch(() => [[]]);
    for (const d of tuuDevices) {
      const [dpRows] = await pool.execute(
        'SELECT store_id FROM tuu_device_pos WHERE tuu_device_id = ? LIMIT 1', [d.id]
      ).catch(() => [[]]);
      let storeId = dpRows[0]?.store_id;
      if (!storeId) {
        const [s] = await pool.execute('SELECT id FROM stores WHERE user_id = ? LIMIT 1', [d.user_id]).catch(() => [[]]);
        storeId = s[0]?.id;
      }
      if (!storeId) continue;
      const [cfgRows] = await pool.execute('SELECT api_key FROM tuu_config WHERE user_id = ? LIMIT 1', [d.user_id]).catch(() => [[]]);
      const apiKey = cfgRows[0]?.api_key || '';
      const serial = d.serial || d.device_id || '';
      const [ex] = await pool.execute('SELECT id FROM pos_terminals WHERE provider = "tuu" AND device_id = ?', [serial]);
      if (ex.length > 0) continue;
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      await pool.execute(
        `INSERT INTO pos_terminals (user_id, store_id, provider, name, api_key, device_id, pos_pin) VALUES (?, ?, 'tuu', ?, ?, ?, ?)`,
        [d.user_id, storeId, d.name, apiKey, serial, pin]
      );
    }

    // ── Square ──
    const [sqDevices] = await pool.execute('SELECT * FROM square_devices').catch(() => [[]]);
    for (const d of sqDevices) {
      const [cfgRows] = await pool.execute(
        'SELECT access_token FROM square_config WHERE user_id = ? AND (store_id = ? OR store_id IS NULL) ORDER BY store_id DESC LIMIT 1',
        [d.user_id, d.store_id]
      ).catch(() => [[]]);
      const apiKey = cfgRows[0]?.access_token || '';
      const [ex] = await pool.execute('SELECT id FROM pos_terminals WHERE provider = "square" AND device_id = ?', [d.device_id]);
      if (ex.length > 0) continue;
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      await pool.execute(
        `INSERT INTO pos_terminals (user_id, store_id, provider, name, api_key, device_id, pos_pin) VALUES (?, ?, 'square', ?, ?, ?, ?)`,
        [d.user_id, d.store_id, d.name, apiKey, d.device_id, pin]
      );
    }

    // Auto-PIN para terminales sin PIN
    const [unpinned] = await pool.execute('SELECT id FROM pos_terminals WHERE pos_pin IS NULL OR pos_pin = ""');
    for (const row of unpinned) {
      let pin;
      let attempts = 0;
      do {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        const [ex2] = await pool.execute('SELECT id FROM pos_terminals WHERE pos_pin = ? AND id != ?', [pin, row.id]);
        if (ex2.length === 0) break;
        attempts++;
      } while (attempts < 10);
      await pool.execute('UPDATE pos_terminals SET pos_pin = ? WHERE id = ?', [pin, row.id]);
    }

    // Marcar como completada para no volver a correr
    await pool.execute("INSERT IGNORE INTO _migrations (name) VALUES ('pos_unified_v1')");
    console.log('✅ Migración pos_terminals completada');
  } catch (e) {
    console.error('⚠️ migrateToUnifiedPos:', e.message);
  }
}

// ============================================================
// CRUD pos_terminals
// ============================================================

export async function createPosTerminal(data) {
  const { user_id, store_id, provider, name, api_key, device_id, pos_pin } = data;
  const [result] = await pool.execute(
    `INSERT INTO pos_terminals (user_id, store_id, provider, name, api_key, device_id, pos_pin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user_id, store_id, provider, name, api_key || '', device_id || '', pos_pin || null]
  );
  return { id: result.insertId, user_id, store_id, provider, name, api_key: api_key || '', device_id: device_id || '', pos_pin: pos_pin || null };
}

export async function getPosTerminals(userId, storeId = null) {
  if (storeId) {
    const [rows] = await pool.execute(
      'SELECT * FROM pos_terminals WHERE user_id = ? AND store_id = ? ORDER BY created_at DESC',
      [userId, storeId]
    );
    return rows;
  }
  const [rows] = await pool.execute(
    'SELECT * FROM pos_terminals WHERE user_id = ? ORDER BY created_at DESC', [userId]
  );
  return rows;
}

export async function getPosTerminalsByStore(storeId) {
  const [rows] = await pool.execute(
    'SELECT id, provider, name, device_id, pos_pin FROM pos_terminals WHERE store_id = ? ORDER BY created_at DESC',
    [storeId]
  );
  return rows;
}

export async function getPosTerminalById(id) {
  const [rows] = await pool.execute('SELECT * FROM pos_terminals WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function getPosTerminalByPin(pin) {
  const [rows] = await pool.execute('SELECT * FROM pos_terminals WHERE pos_pin = ? LIMIT 1', [pin]);
  return rows[0] || null;
}

export async function getPosTerminalForStore(storeId, terminalId) {
  const [rows] = await pool.execute(
    'SELECT * FROM pos_terminals WHERE id = ? AND store_id = ? LIMIT 1',
    [terminalId, storeId]
  );
  if (rows.length > 0) return rows[0];
  const [rows2] = await pool.execute(
    `SELECT pt.* FROM pos_terminals pt
     JOIN stores s ON s.user_id = pt.user_id
     WHERE pt.id = ? AND s.id = ? LIMIT 1`,
    [terminalId, storeId]
  );
  return rows2[0] || null;
}

export async function updatePosTerminal(id, userId, data) {
  const { name, api_key, device_id } = data;
  await pool.execute(
    'UPDATE pos_terminals SET name = ?, api_key = ?, device_id = ? WHERE id = ? AND user_id = ?',
    [name, api_key || '', device_id || '', id, userId]
  );
  return { id, ...data };
}

export async function deletePosTerminal(id, userId) {
  await pool.execute('DELETE FROM pos_terminals WHERE id = ? AND user_id = ?', [id, userId]);
}

// ─── Instagram Auto-Post ─────────────────────────────────────────────────────

export async function getInstagramConfig(storeId) {
  const [rows] = await pool.execute('SELECT * FROM instagram_configs WHERE store_id = ?', [storeId]);
  return rows[0] || null;
}

export async function saveInstagramConfig(storeId, { ig_username, ig_password, caption_template, enabled, post_time, post_days }) {
  await pool.execute(`
    INSERT INTO instagram_configs (store_id, ig_username, ig_password, caption_template, enabled, post_time, post_days)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      ig_username = VALUES(ig_username),
      ig_password = VALUES(ig_password),
      caption_template = VALUES(caption_template),
      enabled = VALUES(enabled),
      post_time = VALUES(post_time),
      post_days = VALUES(post_days)
  `, [storeId, ig_username || '', ig_password || '', caption_template || '', enabled ? 1 : 0, post_time || '10:00', post_days || '0']);
}

export async function getActiveInstagramConfigs() {
  const [rows] = await pool.execute(`
    SELECT ic.*, s.name AS store_name, s.primary_color, s.accent_color,
           s.secondary_color, s.logo_url, s.code AS store_code, s.currency_symbol
    FROM instagram_configs ic
    JOIN stores s ON s.id = ic.store_id
    WHERE ic.enabled = TRUE
      AND ic.ig_connected = 1
      AND ic.ig_username != ''
      AND ic.ig_password != ''
  `);
  return rows;
}

export async function updateInstagramPosted(storeId, errorMsg = null) {
  await pool.execute(`
    UPDATE instagram_configs
    SET last_posted_at = NOW(),
        template_counter = template_counter + 1,
        last_error = ?
    WHERE store_id = ?
  `, [errorMsg, storeId]);
}

export async function saveInstagramSession(storeId, sessionJson) {
  await pool.execute(
    `UPDATE instagram_configs SET ig_session = ?, ig_temp_state = NULL, ig_connected = 1 WHERE store_id = ?`,
    [sessionJson, storeId]
  );
}

export async function saveInstagramTempState(storeId, tempStateJson) {
  await pool.execute(
    `UPDATE instagram_configs SET ig_temp_state = ? WHERE store_id = ?`,
    [tempStateJson, storeId]
  );
}

export async function clearInstagramSession(storeId) {
  await pool.execute(
    `UPDATE instagram_configs SET ig_session = NULL, ig_temp_state = NULL, ig_connected = 0 WHERE store_id = ?`,
    [storeId]
  );
}

// ─── TikTok Auto-Post ─────────────────────────────────────────────────────────

export async function getTikTokConfig(storeId) {
  const [rows] = await pool.execute('SELECT * FROM tiktok_configs WHERE store_id = ?', [storeId]);
  return rows[0] || null;
}

export async function saveTikTokConfig(storeId, { caption_template, enabled, post_time, post_days }) {
  await pool.execute(`
    INSERT INTO tiktok_configs (store_id, caption_template, enabled, post_time, post_days)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      caption_template = VALUES(caption_template),
      enabled          = VALUES(enabled),
      post_time        = VALUES(post_time),
      post_days        = VALUES(post_days)
  `, [storeId, caption_template || '', enabled ? 1 : 0, post_time || '10:00', post_days || '0']);
}

export async function saveTikTokSession(storeId, sessionCookie) {
  await pool.execute(`
    INSERT INTO tiktok_configs (store_id, session_cookie, tk_connected)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE
      session_cookie = VALUES(session_cookie),
      tk_connected   = 1
  `, [storeId, sessionCookie]);
}

export async function saveTikTokTokens(storeId, { access_token, refresh_token, open_id }) {
  await pool.execute(`
    INSERT INTO tiktok_configs (store_id, access_token, refresh_token, open_id, tk_connected)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      access_token  = VALUES(access_token),
      refresh_token = VALUES(refresh_token),
      open_id       = VALUES(open_id),
      tk_connected  = 1
  `, [storeId, access_token, refresh_token, open_id]);
}

export async function clearTikTokTokens(storeId) {
  await pool.execute(
    `UPDATE tiktok_configs SET session_cookie = NULL, access_token = NULL, refresh_token = NULL, open_id = NULL, tk_connected = 0 WHERE store_id = ?`,
    [storeId]
  );
}

export async function getActiveTikTokConfigs() {
  const [rows] = await pool.execute(`
    SELECT tc.*, s.name AS store_name, s.primary_color, s.accent_color,
           s.secondary_color, s.logo_url, s.code AS store_code, s.currency_symbol
    FROM tiktok_configs tc
    JOIN stores s ON s.id = tc.store_id
    WHERE tc.enabled = 1 AND tc.tk_connected = 1
  `);
  return rows;
}

export async function updateTikTokPosted(storeId, errorMsg = null) {
  await pool.execute(`
    UPDATE tiktok_configs
    SET last_posted_at = NOW(),
        template_counter = template_counter + 1,
        last_error = ?
    WHERE store_id = ?
  `, [errorMsg, storeId]);
}

export async function getChatGptKey(userId) {
  const [rows] = await pool.execute('SELECT chatgpt_api_key FROM users WHERE id = ?', [userId]);
  return rows[0]?.chatgpt_api_key || null;
}

export async function saveChatGptKey(userId, apiKey) {
  await pool.execute('UPDATE users SET chatgpt_api_key = ? WHERE id = ?', [apiKey || null, userId]);
}

// ============================================================
// CAJA (CASH REGISTER)
// ============================================================

export async function openCashRegister(storeId, workerId, workerName, openingAmount = 0) {
  const [open] = await pool.execute(
    'SELECT id FROM cash_registers WHERE store_id = ? AND closed_at IS NULL',
    [storeId]
  );
  if (open.length > 0) throw new Error('Ya hay una caja abierta para esta tienda');
  const [result] = await pool.execute(
    'INSERT INTO cash_registers (store_id, worker_id, worker_name, opening_amount) VALUES (?, ?, ?, ?)',
    [storeId, workerId, workerName, parseFloat(openingAmount) || 0]
  );
  const [rows] = await pool.execute('SELECT * FROM cash_registers WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function closeCashRegister(storeId, closedBy = 'manual') {
  await pool.execute(
    'UPDATE cash_registers SET closed_at = NOW(), closed_by = ? WHERE store_id = ? AND closed_at IS NULL',
    [closedBy, storeId]
  );
  return { success: true };
}

export async function getOpenCashRegister(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM cash_registers WHERE store_id = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1',
    [storeId]
  );
  return rows[0] || null;
}

export async function getAllOpenCashRegisters() {
  const [rows] = await pool.execute(`
    SELECT cr.*, s.user_id, s.name as store_name, u.email as owner_email
    FROM cash_registers cr
    JOIN stores s ON cr.store_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE cr.closed_at IS NULL
  `);
  return rows;
}

export async function getTodayOrdersForStore(storeId) {
  const [rows] = await pool.execute(`
    SELECT o.*,
      GROUP_CONCAT(
        CONCAT(oi.quantity, 'x ', COALESCE(p.name,'Producto'),
          IF(oi.selected_ingredients IS NOT NULL AND oi.selected_ingredients != '[]',
            CONCAT(' [', oi.selected_ingredients, ']'), ''),
          IF(oi.selected_extras IS NOT NULL AND oi.selected_extras != '[]',
            CONCAT(' +', oi.selected_extras), '')
        ) SEPARATOR ' | '
      ) AS items_text
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.store_id = ? AND DATE(o.created_at) = CURDATE()
    GROUP BY o.id
    ORDER BY o.created_at ASC
  `, [storeId]);
  return rows;
}

export async function getCashRegisterHistory(storeId, dateFrom, dateTo) {
  const [rows] = await pool.execute(`
    SELECT cr.*,
      COALESCE(SUM(o.total), 0) AS total_vendido,
      COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END), 0) AS total_efectivo,
      COUNT(o.id) AS total_pedidos
    FROM cash_registers cr
    LEFT JOIN orders o ON o.store_id = cr.store_id
      AND o.created_at >= cr.opened_at
      AND (cr.closed_at IS NULL OR o.created_at <= cr.closed_at)
    WHERE cr.store_id = ?
      AND DATE(cr.opened_at) >= ?
      AND DATE(cr.opened_at) <= ?
    GROUP BY cr.id
    ORDER BY cr.opened_at DESC
  `, [storeId, dateFrom, dateTo]);
  return rows;
}

// ─── SRBrain ─────────────────────────────────────────────────────────────────

export async function getAiConfig(storeId) {
  const [rows] = await pool.execute('SELECT * FROM ai_config WHERE store_id = ? LIMIT 1', [storeId]);
  return rows[0] || null;
}

export async function saveAiConfig(storeId, data) {
  const { enabled, auto_promotions, worker_reminders, morale_messages, promotion_threshold, sender_name, send_hour, send_days } = data;
  await pool.execute(`
    INSERT INTO ai_config (store_id, enabled, auto_promotions, worker_reminders, morale_messages, promotion_threshold, sender_name, send_hour, send_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      auto_promotions = VALUES(auto_promotions),
      worker_reminders = VALUES(worker_reminders),
      morale_messages = VALUES(morale_messages),
      promotion_threshold = VALUES(promotion_threshold),
      sender_name = VALUES(sender_name),
      send_hour = VALUES(send_hour),
      send_days = VALUES(send_days),
      updated_at = CURRENT_TIMESTAMP
  `, [storeId, enabled ?? false, auto_promotions ?? true, worker_reminders ?? true, morale_messages ?? true, promotion_threshold ?? 20, sender_name || 'El Administrador', send_hour ?? 8, send_days || '1,2,3,4,5,6,7']);
  return getAiConfig(storeId);
}

export async function updateAiConfigLastRun(storeId) {
  await pool.execute('UPDATE ai_config SET last_run_at = CURRENT_TIMESTAMP WHERE store_id = ?', [storeId]);
}

export async function getAllEnabledAiConfigs() {
  const [rows] = await pool.execute(`
    SELECT ai.*, s.name AS store_name
    FROM ai_config ai
    JOIN stores s ON s.id = ai.store_id
    WHERE ai.enabled = TRUE
  `);
  return rows;
}

export async function logAiActivity(storeId, actionType, description, metadata = null) {
  await pool.execute(
    'INSERT INTO ai_activity_log (store_id, action_type, description, metadata) VALUES (?, ?, ?, ?)',
    [storeId, actionType, description, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function getAiActivityLog(storeId, limit = 50) {
  const [rows] = await pool.execute(
    'SELECT * FROM ai_activity_log WHERE store_id = ? ORDER BY created_at DESC LIMIT ?',
    [storeId, limit]
  );
  return rows;
}

export async function getMonthlySalesHistory(storeId, months = 6) {
  const [rows] = await pool.execute(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') AS month,
      COUNT(*) AS order_count,
      COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE store_id = ? AND status = 'completed'
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month ASC
  `, [storeId, months]);
  return rows;
}

export async function getYesterdayTaskStatus(storeId) {
  const [rows] = await pool.execute(`
    SELECT
      t.id, t.name, t.worker_id, t.day_of_week, t.due_time,
      w.name AS worker_name, w.phone AS worker_phone,
      tc.completed_at
    FROM tasks t
    JOIN workers w ON w.id = t.worker_id
    LEFT JOIN task_completions tc
      ON tc.task_id = t.id
      AND tc.week_start = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
    WHERE t.store_id = ?
      AND t.day_of_week = WEEKDAY(DATE_SUB(CURDATE(), INTERVAL 1 DAY))
  `, [storeId]);
  return rows;
}

export async function updateWorkerPhone(workerId, phone) {
  await pool.execute('UPDATE workers SET phone = ? WHERE id = ?', [phone, workerId]);
}

// Worker Procedures
export async function getProcedures(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM worker_procedures WHERE store_id = ? ORDER BY created_at DESC',
    [storeId]
  );
  return rows.map(r => ({ ...r, steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps }));
}

export async function getProcedureById(id) {
  const [rows] = await pool.execute('SELECT * FROM worker_procedures WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...r, steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps };
}

export async function createProcedure(storeId, data) {
  const { product_id, title, steps } = data;
  const [result] = await pool.execute(
    'INSERT INTO worker_procedures (store_id, product_id, title, steps) VALUES (?, ?, ?, ?)',
    [storeId, product_id || null, title, JSON.stringify(steps || [])]
  );
  return getProcedureById(result.insertId);
}

export async function updateProcedure(id, storeId, data) {
  const { title, steps, product_id } = data;
  await pool.execute(
    'UPDATE worker_procedures SET title = ?, steps = ?, product_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_id = ?',
    [title, JSON.stringify(steps || []), product_id || null, id, storeId]
  );
  return getProcedureById(id);
}

export async function deleteProcedure(id, storeId) {
  await pool.execute('DELETE FROM worker_procedures WHERE id = ? AND store_id = ?', [id, storeId]);
}

async function ensurePrepTablesTable() {
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS store_prep_tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Preparación',
      template_json MEDIUMTEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_spt_store (store_id)
    )`);
  } catch {}
}

export async function getPrepTables(storeId) {
  await ensurePrepTablesTable();
  const [rows] = await pool.execute(
    'SELECT * FROM store_prep_tables WHERE store_id = ? ORDER BY sort_order ASC, id ASC',
    [storeId]
  );
  return rows.map(r => {
    const parsed = typeof r.template_json === 'string' ? JSON.parse(r.template_json || '{}') : (r.template_json || {});
    return { id: r.id, store_id: r.store_id, title: r.title, sort_order: r.sort_order, ...parsed };
  });
}

export async function createPrepTable(storeId, data) {
  await ensurePrepTablesTable();
  const { title, columns, rows, cells } = data;
  const [result] = await pool.execute(
    'INSERT INTO store_prep_tables (store_id, title, template_json) VALUES (?, ?, ?)',
    [storeId, title || 'Nueva tabla', JSON.stringify({ columns: columns || [], rows: rows || 8, cells: cells || {} })]
  );
  return result.insertId;
}

export async function updatePrepTable(id, storeId, data) {
  await ensurePrepTablesTable();
  const { title, columns, rows, cells } = data;
  await pool.execute(
    'UPDATE store_prep_tables SET title = ?, template_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_id = ?',
    [title || 'Nueva tabla', JSON.stringify({ columns: columns || [], rows: rows || 8, cells: cells || {} }), id, storeId]
  );
}

export async function deletePrepTable(id, storeId) {
  await pool.execute('DELETE FROM store_prep_tables WHERE id = ? AND store_id = ?', [id, storeId]);
}

// Scheduled WhatsApp messages
export async function createScheduledMessage({ userId, storeId, message, recipients, scheduledAt, recurrence = 'none' }) {
  const [result] = await pool.execute(
    'INSERT INTO scheduled_whatsapp_messages (user_id, store_id, message, recipients, scheduled_at, recurrence) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, storeId, message, JSON.stringify(recipients), scheduledAt, recurrence]
  );
  return result.insertId;
}

export async function getScheduledMessages(userId) {
  const [rows] = await pool.execute(
    `SELECT id, store_id, message, recipients, scheduled_at, recurrence, status, sent_at, created_at
     FROM scheduled_whatsapp_messages WHERE user_id = ? ORDER BY scheduled_at DESC LIMIT 100`,
    [userId]
  );
  return rows;
}

export async function cancelScheduledMessage(id, userId) {
  const [result] = await pool.execute(
    `UPDATE scheduled_whatsapp_messages SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'`,
    [id, userId]
  );
  return result.affectedRows > 0;
}

export async function getPendingScheduledMessages() {
  const [rows] = await pool.execute(
    `SELECT id, user_id, store_id, message, recipients, recurrence FROM scheduled_whatsapp_messages
     WHERE status = 'pending' AND scheduled_at <= NOW()`
  );
  return rows;
}

export async function markScheduledMessageSent(id) {
  // Solo marca si aún está pending — retorna true si lo reclamó (evita doble envío)
  const [result] = await pool.execute(
    `UPDATE scheduled_whatsapp_messages SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'pending'`,
    [id]
  );
  return result.affectedRows > 0;
}

export async function markScheduledMessageFailed(id) {
  await pool.execute(
    `UPDATE scheduled_whatsapp_messages SET status = 'failed' WHERE id = ?`,
    [id]
  );
}

export async function getWorkersWithPhone(storeId) {
  const [rows] = await pool.execute(
    `SELECT id, name, phone FROM workers WHERE store_id = ? AND phone IS NOT NULL AND phone != '' ORDER BY name`,
    [storeId]
  );
  return rows;
}

export { pool };