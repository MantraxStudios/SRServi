import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let pool = null;

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '@Fam#+234',
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
  const createCombosTable = `
    CREATE TABLE IF NOT EXISTS combos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      image TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`;

  const createComboItemsTable = `
    CREATE TABLE IF NOT EXISTS combo_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      combo_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`;

  await pool.execute(createOrdersTable);
  await pool.execute(createOrderItemsTable);
  await pool.execute(createWorkersTable);
  await pool.execute(createCombosTable);
  await pool.execute(createComboItemsTable);

  // ── Promociones de tienda (banners bajo el nav, añadibles al carrito) ──
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS store_promos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      title VARCHAR(120) NOT NULL,
      description VARCHAR(255),
      image TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // ── Secciones personalizadas (grupos dinámicos de complementos) ──
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS complement_groups (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      min_select INT NOT NULL DEFAULT 0,
      max_select INT NOT NULL DEFAULT 0,
      required BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS complement_options (
      id INT PRIMARY KEY AUTO_INCREMENT,
      group_id INT NOT NULL,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      image TEXT DEFAULT NULL,
      stock INT NOT NULL DEFAULT 0,
      unlimited_stock BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES complement_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS product_complement_groups (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      group_id INT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES complement_groups(id) ON DELETE CASCADE
    )
  `);
  // Nueva columna para guardar las selecciones de secciones dinámicas en cada item del pedido
  try {
    const [oiCols] = await pool.execute('SHOW COLUMNS FROM order_items');
    const oiColNames = oiCols.map(c => c.Field);
    if (!oiColNames.includes('selected_complements')) {
      await pool.execute('ALTER TABLE order_items ADD COLUMN selected_complements TEXT');
      console.log('✅ Columna selected_complements agregada a order_items');
    }
    if (!oiColNames.includes('combo_id')) {
      await pool.execute('ALTER TABLE order_items ADD COLUMN combo_id INT NULL');
      console.log('✅ Columna combo_id agregada a order_items');
    }
    if (!oiColNames.includes('combo_label')) {
      await pool.execute('ALTER TABLE order_items ADD COLUMN combo_label VARCHAR(255) NULL');
      console.log('✅ Columna combo_label agregada a order_items');
    }
    if (!oiColNames.includes('promo_title')) {
      await pool.execute('ALTER TABLE order_items ADD COLUMN promo_title VARCHAR(120) NULL');
      // Permite items de promoción sin producto asociado (FK acepta NULL)
      await pool.execute('ALTER TABLE order_items MODIFY product_id INT NULL');
      console.log('✅ Columna promo_title agregada a order_items (product_id ahora acepta NULL)');
    }
  } catch (e) { console.warn('Migration order_items columns:', e.message); }

  // Columnas de descuento/precio en combos
  try {
    const [comboCols] = await pool.execute('SHOW COLUMNS FROM combos');
    const comboColNames = comboCols.map(c => c.Field);
    if (!comboColNames.includes('discount_type')) {
      await pool.execute("ALTER TABLE combos ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'auto'");
      console.log('✅ Columna discount_type agregada a combos');
    }
    if (!comboColNames.includes('discount_value')) {
      await pool.execute('ALTER TABLE combos ADD COLUMN discount_value DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Columna discount_value agregada a combos');
    }
    if (!comboColNames.includes('fixed_price')) {
      await pool.execute('ALTER TABLE combos ADD COLUMN fixed_price DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('✅ Columna fixed_price agregada a combos');
    }
  } catch (e) { console.warn('Migration combos discount fields:', e.message); }

  // Initialize delivery tables early so columns exist before createOrder is called
  try { await ensureDeliveryTables(); } catch (e) { console.warn('Delivery tables init:', e.message); }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      label VARCHAR(50) NOT NULL DEFAULT 'Mesa',
      capacity INT DEFAULT 4,
      x INT DEFAULT 50,
      y INT DEFAULT 50,
      w INT DEFAULT 120,
      h INT DEFAULT 80,
      shape ENUM('rect','circle') DEFAULT 'rect',
      sort_order INT DEFAULT 0,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // Migration: add section column to restaurant_tables
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM restaurant_tables');
    if (!cols.find(c => c.Field === 'section')) {
      await pool.execute("ALTER TABLE restaurant_tables ADD COLUMN section VARCHAR(100) DEFAULT 'Primer Piso'");
    }
  } catch {}

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

  // Integración Fudo (POS de terceros) — requiere que la tienda tenga el
  // Plan Pro de Fudo contratado con ellos, ya que su API de propósito
  // general (necesaria para sincronizar productos) está limitada a ese plan.
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS fudo_configs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL UNIQUE,
      api_secret VARCHAR(500) DEFAULT '',
      enabled BOOLEAN DEFAULT FALSE,
      last_sync_at TIMESTAMP NULL DEFAULT NULL,
      last_sync_status VARCHAR(20) NULL DEFAULT NULL,
      last_error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

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

  // Egresos / movimientos de caja (gastos, retiros) — para el estado de resultados
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INT PRIMARY KEY AUTO_INCREMENT,
      cash_register_id INT NOT NULL,
      store_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      category VARCHAR(80) DEFAULT 'gasto',
      worker_name VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // Gastos generales (egresos) para el estado de resultados — independientes de las cajas
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS store_expenses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      category VARCHAR(80) DEFAULT 'Otros',
      expense_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);

  // ── Leads del asistente de ventas IA (chat público tipo Vambe) ──
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sales_leads (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(150) DEFAULT NULL,
      phone VARCHAR(40) DEFAULT NULL,
      email VARCHAR(190) DEFAULT NULL,
      business_type VARCHAR(150) DEFAULT NULL,
      country VARCHAR(80) DEFAULT NULL,
      interest VARCHAR(255) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      conversation JSON DEFAULT NULL,
      status ENUM('new','contacted','qualified','won','lost') NOT NULL DEFAULT 'new',
      source VARCHAR(60) DEFAULT 'landing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sales_leads_status (status),
      INDEX idx_sales_leads_created (created_at)
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
    const wf = cols.map(c => c.Field);
    if (!wf.includes('phone')) {
      await pool.execute(`ALTER TABLE workers ADD COLUMN phone VARCHAR(20) DEFAULT NULL`);
      console.log('✅ Columna phone agregada a workers');
    }
    // Fecha de cumpleaños (para felicitaciones + cupón automático)
    if (!wf.includes('birth_date')) {
      await pool.execute(`ALTER TABLE workers ADD COLUMN birth_date DATE DEFAULT NULL`);
      console.log('✅ Columna birth_date agregada a workers');
    }
  } catch (e) { console.warn('migrateSrBrain workers.phone/birth_date:', e.message); }

  // Columnas de felicitación de cumpleaños en ai_config
  try {
    const [cols] = await pool.execute(`SHOW COLUMNS FROM ai_config`);
    const fields = cols.map(c => c.Field);
    if (!fields.includes('birthday_greetings')) {
      await pool.execute(`ALTER TABLE ai_config ADD COLUMN birthday_greetings BOOLEAN DEFAULT TRUE`);
      console.log('✅ Columna birthday_greetings agregada a ai_config');
    }
    if (!fields.includes('birthday_coupon_percent')) {
      await pool.execute(`ALTER TABLE ai_config ADD COLUMN birthday_coupon_percent INT DEFAULT 15`);
      console.log('✅ Columna birthday_coupon_percent agregada a ai_config');
    }
  } catch (e) { console.warn('migrateSrBrain ai_config birthday:', e.message); }

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
      birthday_greetings BOOLEAN DEFAULT TRUE,
      birthday_coupon_percent INT DEFAULT 15,
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
      if (!orderColumnNames.includes('persons')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN persons INT DEFAULT NULL');
        console.log('✅ Columna persons agregada a orders');
      }
      if (!orderColumnNames.includes('event_name')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN event_name VARCHAR(255) DEFAULT NULL');
        console.log('✅ Columna event_name agregada a orders');
      }
      if (!orderColumnNames.includes('show_time')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN show_time DATETIME DEFAULT NULL');
        console.log('✅ Columna show_time agregada a orders');
      }
      if (!orderColumnNames.includes('customer_comment')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN customer_comment TEXT DEFAULT NULL');
        console.log('✅ Columna customer_comment agregada a orders');
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

    // is_active: activar/desactivar ingredientes y extras (visibilidad en store/worker)
    try {
      const [ingCols4] = await pool.execute('SHOW COLUMNS FROM ingredients');
      if (!ingCols4.map(c => c.Field).includes('is_active')) {
        await pool.execute('ALTER TABLE ingredients ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna is_active agregada a ingredients');
      }
      const [extCols4] = await pool.execute('SHOW COLUMNS FROM extras');
      if (!extCols4.map(c => c.Field).includes('is_active')) {
        await pool.execute('ALTER TABLE extras ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna is_active agregada a extras');
      }
    } catch (err) {
      console.error('❌ Error migrando is_active:', err.message);
    }

    // included_by_default: ingrediente base del producto (viene incluido, se puede quitar → "Sin X")
    try {
      const [piCols] = await pool.execute('SHOW COLUMNS FROM product_ingredients');
      if (!piCols.map(c => c.Field).includes('included_by_default')) {
        await pool.execute('ALTER TABLE product_ingredients ADD COLUMN included_by_default BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna included_by_default agregada a product_ingredients');
      }
    } catch (err) {
      console.error('❌ Error migrando included_by_default:', err.message);
    }

    // Lista única: complementos privados de un producto (owner_product_id) + flag en products
    try {
      const [ingCols5] = await pool.execute('SHOW COLUMNS FROM ingredients');
      if (!ingCols5.map(c => c.Field).includes('owner_product_id')) {
        await pool.execute('ALTER TABLE ingredients ADD COLUMN owner_product_id INT DEFAULT NULL');
        console.log('✅ Columna owner_product_id agregada a ingredients');
      }
      const [extCols5] = await pool.execute('SHOW COLUMNS FROM extras');
      if (!extCols5.map(c => c.Field).includes('owner_product_id')) {
        await pool.execute('ALTER TABLE extras ADD COLUMN owner_product_id INT DEFAULT NULL');
        console.log('✅ Columna owner_product_id agregada a extras');
      }
      const [prodCols] = await pool.execute('SHOW COLUMNS FROM products');
      if (!prodCols.map(c => c.Field).includes('complements_private')) {
        await pool.execute('ALTER TABLE products ADD COLUMN complements_private BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna complements_private agregada a products');
      }
      const prodColNames = prodCols.map(c => c.Field);
      if (!prodColNames.includes('show_description')) {
        await pool.execute('ALTER TABLE products ADD COLUMN show_description BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna show_description agregada a products');
      }
      if (!prodColNames.includes('show_prep_time')) {
        await pool.execute('ALTER TABLE products ADD COLUMN show_prep_time BOOLEAN NOT NULL DEFAULT TRUE');
        console.log('✅ Columna show_prep_time agregada a products');
      }
    } catch (err) {
      console.error('❌ Error migrando lista única (owner_product_id):', err.message);
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
      if (!configColNames.includes('allow_ticketeria')) {
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN allow_ticketeria BOOLEAN NOT NULL DEFAULT FALSE');
        console.log('✅ Columna allow_ticketeria agregada a store_configurations');
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
      if (!configColNames.includes('require_order_comment')) {
        await pool.execute('ALTER TABLE store_configurations ADD COLUMN require_order_comment BOOLEAN NOT NULL DEFAULT FALSE');
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
      if (!userColNames.includes('phone')) {
        await pool.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(30) DEFAULT NULL');
        console.log('✅ Columna phone agregada a users');
      }
      if (!userColNames.includes('chatgpt_api_key')) {
        await pool.execute('ALTER TABLE users ADD COLUMN chatgpt_api_key VARCHAR(255) DEFAULT NULL');
        console.log('✅ Columna chatgpt_api_key agregada a users');
      }
      if (!userColNames.includes('trial_claimed_at')) {
        await pool.execute('ALTER TABLE users ADD COLUMN trial_claimed_at TIMESTAMP NULL DEFAULT NULL');
        console.log('✅ Columna trial_claimed_at agregada a users');
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
          ('SOLO', 'Plan para negocios en crecimiento', 10, 11.00, 11.00, '["1 impresora Bluetooth en la app", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]'),
          ('Empresas', 'Plan para empresas con múltiples sucursales', 25, 25.00, 25.00, '["5 impresoras Bluetooth en la app", "25 tiendas máximo", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]'),
          ('Personalizado', 'Plan con funciones a medida y soporte dedicado', 25, 99.00, 99.00, '["10 impresoras Bluetooth en la app", "Funciones personalizadas a pedido", "Soporte prioritario dedicado", "25 tiendas máximo", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Atención directa con el equipo de desarrollo"]')
        `);
        console.log('✅ Planes por defecto insertados');
      } else {
        const [existingPlans] = await pool.execute('SELECT * FROM plans');
        for (const plan of existingPlans) {
          if (plan.name === 'Profesional' || plan.name === 'Empresarial') {
            await pool.execute('DELETE FROM plans WHERE id = ?', [plan.id]);
            console.log('⚠️ Eliminando plan obsoleto:', plan.name);
          } else if (plan.name === 'Premium') {
            await pool.execute('UPDATE plans SET name = ? WHERE id = ?', ['SOLO', plan.id]);
            console.log('ℹ️ Plan Premium renombrado a SOLO');
          } else if (plan.name === 'Gratis') {
            await pool.execute(
              'UPDATE plans SET features = ? WHERE id = ?',
              ['["2 tiendas máximo", "Gestión de productos", "Punto de venta"]', plan.id]
            );
            console.log('ℹ️ Plan Gratis actualizado');
          }
        }
        const [remainingPlans] = await pool.execute("SELECT COUNT(*) as count FROM plans WHERE name = 'SOLO'");
        if (remainingPlans[0].count === 0) {
          await pool.execute(`
            INSERT INTO plans (name, description, max_stores, price_monthly, price_yearly, features) VALUES
            ('SOLO', 'Plan para negocios en crecimiento', 10, 11.00, 11.00, '["1 impresora Bluetooth en la app", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]')
          `);
          console.log('✅ Plan SOLO insertado');
        } else {
          await pool.execute(
            'UPDATE plans SET price_monthly = 11.00, price_yearly = 11.00 WHERE name = ?',
            ['SOLO']
          );
          console.log('ℹ️ Plan SOLO actualizado a $11/$11');
        }

        const [empresasPlans] = await pool.execute("SELECT COUNT(*) as count FROM plans WHERE name = 'Empresas'");
        if (empresasPlans[0].count === 0) {
          await pool.execute(`
            INSERT INTO plans (name, description, max_stores, price_monthly, price_yearly, features) VALUES
            ('Empresas', 'Plan para empresas con múltiples sucursales', 25, 25.00, 25.00, '["5 impresoras Bluetooth en la app", "25 tiendas máximo", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Soporte prioritario"]')
          `);
          console.log('✅ Plan Empresas insertado');
        } else {
          await pool.execute(
            "UPDATE plans SET max_stores = 25, price_monthly = 25.00, price_yearly = 25.00, features = '[\"5 impresoras Bluetooth en la app\", \"25 tiendas máximo\", \"Logo superior personalizado\", \"Cambio de colores\", \"Multi tiendas\", \"Soporte prioritario\"]' WHERE name = ?",
            ['Empresas']
          );
          console.log('ℹ️ Plan Empresas actualizado');
        }

        const [personalPlans] = await pool.execute("SELECT COUNT(*) as count FROM plans WHERE name = 'Personalizado'");
        if (personalPlans[0].count === 0) {
          await pool.execute(`
            INSERT INTO plans (name, description, max_stores, price_monthly, price_yearly, features) VALUES
            ('Personalizado', 'Plan con funciones a medida y soporte dedicado', 25, 99.00, 99.00, '["10 impresoras Bluetooth en la app", "Funciones personalizadas a pedido", "Soporte prioritario dedicado", "25 tiendas máximo", "Logo superior personalizado", "Cambio de colores", "Multi tiendas", "Atención directa con el equipo de desarrollo"]')
          `);
          console.log('✅ Plan Personalizado insertado');
        } else {
          await pool.execute(
            "UPDATE plans SET max_stores = 25, price_monthly = 99.00, price_yearly = 99.00, features = '[\"10 impresoras Bluetooth en la app\", \"Funciones personalizadas a pedido\", \"Soporte prioritario dedicado\", \"25 tiendas máximo\", \"Logo superior personalizado\", \"Cambio de colores\", \"Multi tiendas\", \"Atención directa con el equipo de desarrollo\"]' WHERE name = ?",
            ['Personalizado']
          );
          console.log('ℹ️ Plan Personalizado actualizado a $99');
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
      const [apkCols] = await pool.execute('SHOW COLUMNS FROM apk_releases');
      if (!apkCols.map(c => c.Field).includes('app_name')) {
        await pool.execute("ALTER TABLE apk_releases ADD COLUMN app_name VARCHAR(50) DEFAULT 'launcher' AFTER id");
        console.log('✅ Columna app_name agregada a apk_releases');
      }
    } catch (err) {
      console.error('❌ Error migrando apk_releases app_name:', err.message);
    }

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS app_activity (
          id INT PRIMARY KEY AUTO_INCREMENT,
          app_name VARCHAR(50) NOT NULL,
          store_code VARCHAR(50),
          device_id VARCHAR(100),
          app_version VARCHAR(20),
          event VARCHAR(20) NOT NULL,
          ip VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_app_activity_app (app_name, created_at),
          INDEX idx_app_activity_store (store_code, created_at)
        )
      `);
      console.log('ℹ️ Tabla app_activity verificada/creada');
    } catch (err) {
      console.error('❌ Error creando tabla app_activity:', err.message);
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

    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS worker_comments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          store_id INT NOT NULL,
          worker_id INT NOT NULL,
          worker_name VARCHAR(255) NOT NULL,
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
          FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
        )
      `);
    } catch (err) {
      console.error('Error creando tabla worker_comments:', err.message);
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

    // Feedback campaigns
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS feedback_campaigns (
          id INT PRIMARY KEY AUTO_INCREMENT,
          type ENUM('monthly','manual') DEFAULT 'manual',
          status ENUM('sending','done') DEFAULT 'sending',
          total_sent INT DEFAULT 0,
          total_responded INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_fc_created (created_at)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS feedback_tokens (
          id INT PRIMARY KEY AUTO_INCREMENT,
          campaign_id INT NOT NULL,
          user_id INT NOT NULL,
          token VARCHAR(64) NOT NULL UNIQUE,
          sent_via VARCHAR(20) DEFAULT 'email',
          status ENUM('pending','responded') DEFAULT 'pending',
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          responded_at TIMESTAMP NULL DEFAULT NULL,
          FOREIGN KEY (campaign_id) REFERENCES feedback_campaigns(id) ON DELETE CASCADE,
          INDEX idx_ft_token (token),
          INDEX idx_ft_user (user_id)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS feedback_responses (
          id INT PRIMARY KEY AUTO_INCREMENT,
          token_id INT NOT NULL,
          user_id INT NOT NULL,
          overall_rating TINYINT NOT NULL,
          ease_of_use TINYINT DEFAULT NULL,
          support_quality TINYINT DEFAULT NULL,
          would_recommend BOOLEAN DEFAULT NULL,
          comment TEXT DEFAULT NULL,
          improvement_suggestions TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_id) REFERENCES feedback_tokens(id) ON DELETE CASCADE,
          INDEX idx_fr_user (user_id)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS admin_feedback (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL UNIQUE,
          rating TINYINT NOT NULL,
          liked_most TEXT DEFAULT NULL,
          improvement TEXT DEFAULT NULL,
          would_recommend BOOLEAN DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_af_created (created_at)
        )
      `);
      console.log('ℹ️ Tablas de feedback verificadas/creadas');
    } catch (err) {
      console.error('❌ Error creando tablas de feedback:', err.message);
    }

    // Totem rentals
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS totem_rentals (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          status ENUM('pending_payment','pending_install','active','suspended','cancelled') DEFAULT 'pending_payment',
          contact_name VARCHAR(255) NOT NULL,
          contact_phone VARCHAR(50) NOT NULL,
          address TEXT NOT NULL,
          notes TEXT DEFAULT NULL,
          installation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          currency_id VARCHAR(10) DEFAULT 'CLP',
          mp_preference_id VARCHAR(100) DEFAULT NULL,
          mp_payment_id VARCHAR(100) DEFAULT NULL,
          mp_subscription_id VARCHAR(100) DEFAULT NULL,
          mp_subscription_status VARCHAR(50) DEFAULT NULL,
          installed_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_tr_user (user_id),
          INDEX idx_tr_status (status)
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS totem_rental_payments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          rental_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          type ENUM('installation','monthly') NOT NULL,
          mp_payment_id VARCHAR(100) DEFAULT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rental_id) REFERENCES totem_rentals(id) ON DELETE CASCADE,
          INDEX idx_trp_rental (rental_id)
        )
      `);
      console.log('ℹ️ Tablas de arriendo tótem verificadas/creadas');
    } catch (err) {
      console.error('❌ Error creando tablas de arriendo tótem:', err.message);
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

export async function createUser(username, email, password, business_name, country, phone) {
  const hashedPassword = await bcrypt.hash(password, 10);
  let code = generateCode();
  
  const [existing] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
  while (existing.length > 0) {
    code = generateCode();
    const [check] = await pool.execute('SELECT id FROM users WHERE code = ?', [code]);
    if (check.length === 0) break;
  }

  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password, code, business_name, country, phone, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)',
    [username, email, hashedPassword, code, business_name || null, country || null, phone || null]
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
    email_verified: Boolean(user.email_verified),
    phone: user.phone || null
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
    const lockedIds = await getLockedStoreIds(userId);
    return rows.map(s => ({ ...s, is_locked: lockedIds.has(s.id) }));
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

  const sampleProducts = [
    { name: 'Hamburguesa Clásica', description: 'Jugosa hamburguesa con lechuga, tomate y queso', price: 108.99, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop' },
    { name: 'Pizza Margherita', description: 'Pizza con salsa de tomate, mozzarella y albahaca', price: 112.99, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop' },
    { name: 'Café Americano', description: 'Café negro intenso recién preparado', price: 102.50, image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop' },
    { name: 'Refresco', description: 'Bebida fría de tu sabor favorito', price: 101.99, image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400&h=300&fit=crop' },
    { name: 'Sándwich de Pollo', description: 'Pollo a la plancha con vegetales frescos', price: 107.50, image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&h=300&fit=crop' },
    { name: 'Hot Dog', description: 'Salchicha con mostaza, ketchup y cebolla', price: 104.99, image: 'https://images.unsplash.com/photo-1612392062126-ef0a80cfd5c4?w=400&h=300&fit=crop' },
    { name: 'Papas Fritas', description: 'Papas crujientes con sal y especias', price: 103.50, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop' },
    { name: 'Ensalada César', description: 'Lechuga romana, crutones y aderezo César', price: 106.99, image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop' },
    { name: 'Tacos (3 piezas)', description: 'Tacos con carne, cebolla y cilantro', price: 109.00, image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop' },
    { name: 'Jugo Natural', description: 'Jugo exprimido al momento de frutas frescas', price: 103.99, image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&h=300&fit=crop' },
    { name: 'Agua Mineral', description: 'Agua purificada fría', price: 101.50, image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop' },
    { name: 'Helado de Vainilla', description: 'Helado cremoso artesanal de vainilla', price: 103.00, image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9be7?w=400&h=300&fit=crop' },
    { name: 'Sopa del Día', description: 'Sopa casera preparada con ingredientes frescos', price: 105.99, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop' },
    { name: 'Pasta Alfredo', description: 'Pasta con crema, mantequilla y parmesano', price: 110.99, image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop' },
    { name: 'Pollo a la Plancha', description: 'Pechuga de pollo jugosa con guarnición', price: 111.50, image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop' },
  ];

  // ── Default ingredients (shared, active) ──
  const sampleIngredients = [
    { name: 'Lechuga', price: 0, image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=200&h=200&fit=crop' },
    { name: 'Tomate', price: 0, image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=200&h=200&fit=crop' },
    { name: 'Queso', price: 0.50, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&h=200&fit=crop' },
    { name: 'Cebolla', price: 0, image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=200&h=200&fit=crop' },
    { name: 'Salsa Especial', price: 0, image: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=200&h=200&fit=crop' },
  ];
  const ingredientIds = [];
  for (const ing of sampleIngredients) {
    const [r] = await pool.execute(
      'INSERT INTO ingredients (store_id, user_id, name, price, stock, unlimited_stock, is_active, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [storeId, userId, ing.name, ing.price, 0, true, true, ing.image || null]
    );
    ingredientIds.push(r.insertId);
  }

  // ── Default extras (shared, active) ──
  const sampleExtras = [
    { name: 'Extra Queso', price: 1.00, image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&h=200&fit=crop' },
    { name: 'Bacon', price: 1.50, image: 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=200&h=200&fit=crop' },
    { name: 'Aguacate', price: 1.25, image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&h=200&fit=crop' },
    { name: 'Huevo Frito', price: 0.75, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200&h=200&fit=crop' },
  ];
  const extraIds = [];
  for (const ext of sampleExtras) {
    const [r] = await pool.execute(
      'INSERT INTO extras (store_id, user_id, name, price, stock, unlimited_stock, is_active, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [storeId, userId, ext.name, ext.price, 0, true, true, ext.image || null]
    );
    extraIds.push(r.insertId);
  }

  // ── Default complement group with options ──
  const [grpResult] = await pool.execute(
    'INSERT INTO complement_groups (store_id, name, min_select, max_select, required, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [storeId, 'Tamaño', 0, 1, 0, 0, 1]
  );
  const grpId = grpResult.insertId;
  const complementOptions = [
    { name: 'Pequeño', price: 0, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=200&h=200&fit=crop' },
    { name: 'Mediano', price: 1.00, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop' },
    { name: 'Grande', price: 2.00, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop' },
  ];
  for (let i = 0; i < complementOptions.length; i++) {
    const opt = complementOptions[i];
    await pool.execute(
      'INSERT INTO complement_options (group_id, store_id, name, price, stock, unlimited_stock, sort_order, is_active, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [grpId, storeId, opt.name, opt.price, 0, 1, i, 1, opt.image || null]
    );
  }

  // ── Default products with ingredients, extras & complements ──
  const shuffled = sampleProducts.sort(() => Math.random() - 0.5);
  for (const product of shuffled.slice(0, 3)) {
    const [pResult] = await pool.execute(
      'INSERT INTO products (store_id, user_id, category_id, name, description, price, image, has_extras, has_ingredients, max_extras, max_ingredients) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [storeId, userId, null, product.name, product.description, product.price, product.image || null, 1, 1, 0, 0]
    );
    const productId = pResult.insertId;

    for (const ingId of ingredientIds) {
      await pool.execute(
        'INSERT INTO product_ingredients (product_id, ingredient_id, included_by_default) VALUES (?, ?, ?)',
        [productId, ingId, 1]
      );
    }

    for (const extId of extraIds) {
      await pool.execute(
        'INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)',
        [productId, extId]
      );
    }

    await pool.execute(
      'INSERT INTO product_complement_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)',
      [productId, grpId, 0]
    );
  }

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
  const { name, primary_color, secondary_color, accent_color, header_color, currency_code, currency_symbol, currency_name, logo_url, worker_accept_cash, worker_accept_card, smart_mode, inactivity_timeout, hide_decimals, show_top_selling, paid_order_status, complements_label, extras_label, worker_show_prices, worker_panel_tabs, ranking_store_ids } = data;

  // Ensure columns exist
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM stores');
    const names = cols.map(c => c.Field);
    if (!names.includes('smart_mode')) await pool.execute('ALTER TABLE stores ADD COLUMN smart_mode BOOLEAN DEFAULT TRUE');
    if (!names.includes('inactivity_timeout')) await pool.execute('ALTER TABLE stores ADD COLUMN inactivity_timeout INT DEFAULT 120');
    if (!names.includes('hide_decimals')) await pool.execute('ALTER TABLE stores ADD COLUMN hide_decimals BOOLEAN DEFAULT FALSE');
    if (!names.includes('show_top_selling')) await pool.execute('ALTER TABLE stores ADD COLUMN show_top_selling BOOLEAN DEFAULT TRUE');
    if (!names.includes('paid_order_status')) await pool.execute("ALTER TABLE stores ADD COLUMN paid_order_status VARCHAR(20) DEFAULT 'pending'");
    if (!names.includes('complements_label')) await pool.execute("ALTER TABLE stores ADD COLUMN complements_label VARCHAR(100) DEFAULT NULL");
    if (!names.includes('extras_label')) await pool.execute("ALTER TABLE stores ADD COLUMN extras_label VARCHAR(100) DEFAULT NULL");
    if (!names.includes('worker_show_prices')) await pool.execute('ALTER TABLE stores ADD COLUMN worker_show_prices BOOLEAN DEFAULT TRUE');
    if (!names.includes('worker_panel_tabs')) await pool.execute("ALTER TABLE stores ADD COLUMN worker_panel_tabs TEXT DEFAULT NULL");
    if (!names.includes('ranking_store_ids')) await pool.execute("ALTER TABLE stores ADD COLUMN ranking_store_ids TEXT DEFAULT NULL");
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

  if (paid_order_status !== undefined) {
    query += `, paid_order_status = ?`;
    params.push(['pending', 'completed'].includes(paid_order_status) ? paid_order_status : 'pending');
  }

  if (complements_label !== undefined) {
    query += `, complements_label = ?`;
    const v = (complements_label || '').toString().trim();
    params.push(v ? v.slice(0, 100) : null);
  }

  if (extras_label !== undefined) {
    query += `, extras_label = ?`;
    const v = (extras_label || '').toString().trim();
    params.push(v ? v.slice(0, 100) : null);
  }

  if (worker_show_prices !== undefined) {
    query += `, worker_show_prices = ?`;
    params.push(worker_show_prices === true || worker_show_prices === 'true' || worker_show_prices === 1 || worker_show_prices === '1' ? 1 : 0);
  }

  if (worker_panel_tabs !== undefined) {
    query += `, worker_panel_tabs = ?`;
    params.push(typeof worker_panel_tabs === 'string' ? worker_panel_tabs : JSON.stringify(worker_panel_tabs));
  }

  if (ranking_store_ids !== undefined) {
    query += `, ranking_store_ids = ?`;
    params.push(typeof ranking_store_ids === 'string' ? ranking_store_ids : JSON.stringify(ranking_store_ids));
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
     WHERE i.store_id = ? AND i.owner_product_id IS NULL ORDER BY i.sort_order, i.name`,
    [storeId]
  );
  return rows.map(ing => ({
    ...ing,
    price: parseFloat(ing.price) || 0,
    stock: parseInt(ing.stock) || 0,
    unlimited_stock: ing.unlimited_stock || false,
    stock_unit: ing.stock_unit || 'unidades',
    is_active: ing.is_active === undefined || ing.is_active === null ? true : !!ing.is_active,
  }));
}

export async function createIngredient(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id } = data;
  const store = await getStoreById(storeId);
  // Nuevos implementos quedan desactivados por defecto; salvo los privados de un producto (lista única), que nacen activos.
  const active = is_active === undefined ? (owner_product_id ? true : false) : !!is_active;
  const [result] = await pool.execute(
    'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades', active, owner_product_id || null]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function updateIngredient(ingredientId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active } = data;
  const hasActive = is_active !== undefined;
  const params = [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades'];
  if (hasActive) params.push(!!is_active);
  params.push(ingredientId, storeId);
  await pool.execute(
    `UPDATE ingredients SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ?, stock_unit = ?${hasActive ? ', is_active = ?' : ''} WHERE id = ? AND store_id = ?`,
    params
  );
  return { id: ingredientId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function setIngredientActive(ingredientId, storeId, active) {
  await pool.execute('UPDATE ingredients SET is_active = ? WHERE id = ? AND store_id = ?', [!!active, ingredientId, storeId]);
  return { id: ingredientId, is_active: !!active };
}

export async function deleteIngredient(ingredientId, storeId) {
  await pool.execute(
    'DELETE FROM ingredients WHERE id = ? AND store_id = ?',
    [ingredientId, storeId]
  );
  return true;
}

export async function deleteAllIngredients(storeId) {
  await pool.execute(
    'DELETE FROM product_ingredients WHERE ingredient_id IN (SELECT id FROM ingredients WHERE store_id = ?)',
    [storeId]
  );
  const [result] = await pool.execute('DELETE FROM ingredients WHERE store_id = ?', [storeId]);
  return result.affectedRows;
}

export async function getDuplicateComplementInfo(storeId) {
  // Compartidos duplicados (owner IS NULL, mismo nombre, más de uno)
  const [ingShared] = await pool.execute(
    `SELECT MIN(name) AS name, 'ingredient' AS type, COUNT(*) AS cnt
     FROM ingredients WHERE store_id = ? AND owner_product_id IS NULL
     GROUP BY LOWER(name) HAVING COUNT(*) > 1`,
    [storeId]
  );
  const [extShared] = await pool.execute(
    `SELECT MIN(name) AS name, 'extra' AS type, COUNT(*) AS cnt
     FROM extras WHERE store_id = ? AND owner_product_id IS NULL
     GROUP BY LOWER(name) HAVING COUNT(*) > 1`,
    [storeId]
  );
  // Privados duplicados (mismo producto + mismo nombre, más de uno)
  const [ingPrivate] = await pool.execute(
    `SELECT MIN(name) AS name, 'ingredient' AS type, COUNT(*) AS cnt
     FROM ingredients WHERE store_id = ? AND owner_product_id IS NOT NULL
     GROUP BY owner_product_id, LOWER(name) HAVING COUNT(*) > 1`,
    [storeId]
  );
  const [extPrivate] = await pool.execute(
    `SELECT MIN(name) AS name, 'extra' AS type, COUNT(*) AS cnt
     FROM extras WHERE store_id = ? AND owner_product_id IS NOT NULL
     GROUP BY owner_product_id, LOWER(name) HAVING COUNT(*) > 1`,
    [storeId]
  );
  // Combinar, sin repetir mismo nombre+tipo
  const seen = new Set();
  const result = [];
  for (const r of [...ingShared, ...extShared, ...ingPrivate, ...extPrivate]) {
    const key = `${r.type}:${r.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name: r.name, type: r.type, count: Number(r.cnt) });
    }
  }
  return result;
}

export async function deduplicateIngredients(storeId) {
  // Shared duplicates (owner_product_id IS NULL)
  await pool.execute(
    `DELETE FROM ingredients
     WHERE store_id = ? AND owner_product_id IS NULL
     AND id NOT IN (
       SELECT min_id FROM (
         SELECT MIN(id) AS min_id FROM ingredients
         WHERE store_id = ? AND owner_product_id IS NULL
         GROUP BY LOWER(name)
       ) AS t
     )`,
    [storeId, storeId]
  );
  // Private duplicates (same product + same name, keep oldest)
  const [result] = await pool.execute(
    `DELETE FROM ingredients
     WHERE store_id = ? AND owner_product_id IS NOT NULL
     AND id NOT IN (
       SELECT min_id FROM (
         SELECT MIN(id) AS min_id FROM ingredients
         WHERE store_id = ? AND owner_product_id IS NOT NULL
         GROUP BY owner_product_id, LOWER(name)
       ) AS t
     )`,
    [storeId, storeId]
  );
  return result.affectedRows;
}

export async function getExtras(storeId) {
  const [rows] = await pool.execute(
    `SELECT e.*, c.name AS category_name FROM extras e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.store_id = ? AND e.owner_product_id IS NULL ORDER BY e.sort_order, e.name`,
    [storeId]
  );
  return rows.map(ext => ({
    ...ext,
    price: parseFloat(ext.price) || 0,
    stock: parseInt(ext.stock) || 0,
    unlimited_stock: ext.unlimited_stock || false,
    stock_unit: ext.stock_unit || 'unidades',
    is_active: ext.is_active === undefined || ext.is_active === null ? true : !!ext.is_active,
  }));
}

export async function createExtra(storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id } = data;
  const store = await getStoreById(storeId);
  // Nuevos extras quedan desactivados por defecto; salvo los privados de un producto (lista única), que nacen activos.
  const active = is_active === undefined ? (owner_product_id ? true : false) : !!is_active;
  const [result] = await pool.execute(
    'INSERT INTO extras (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades', active, owner_product_id || null]
  );
  return { id: result.insertId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function updateExtra(extraId, storeId, data) {
  const { name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active } = data;
  const hasActive = is_active !== undefined;
  const params = [name, price || 0, category_id || null, image || null, stock || 0, unlimited_stock || false, stock_unit || 'unidades'];
  if (hasActive) params.push(!!is_active);
  params.push(extraId, storeId);
  await pool.execute(
    `UPDATE extras SET name = ?, price = ?, category_id = ?, image = ?, stock = ?, unlimited_stock = ?, stock_unit = ?${hasActive ? ', is_active = ?' : ''} WHERE id = ? AND store_id = ?`,
    params
  );
  return { id: extraId, store_id: storeId, name, price: price || 0, category_id: category_id || null, image: image || null, stock: stock || 0, unlimited_stock: unlimited_stock || false, stock_unit: stock_unit || 'unidades' };
}

export async function setExtraActive(extraId, storeId, active) {
  await pool.execute('UPDATE extras SET is_active = ? WHERE id = ? AND store_id = ?', [!!active, extraId, storeId]);
  return { id: extraId, is_active: !!active };
}

export async function deleteExtra(extraId, storeId) {
  await pool.execute(
    'DELETE FROM extras WHERE id = ? AND store_id = ?',
    [extraId, storeId]
  );
  return true;
}

export async function deleteAllExtras(storeId) {
  await pool.execute(
    'DELETE FROM product_extras WHERE extra_id IN (SELECT id FROM extras WHERE store_id = ?)',
    [storeId]
  );
  const [result] = await pool.execute('DELETE FROM extras WHERE store_id = ?', [storeId]);
  return result.affectedRows;
}

export async function deduplicateExtras(storeId) {
  // Shared duplicates
  await pool.execute(
    `DELETE FROM extras
     WHERE store_id = ? AND owner_product_id IS NULL
     AND id NOT IN (
       SELECT min_id FROM (
         SELECT MIN(id) AS min_id FROM extras
         WHERE store_id = ? AND owner_product_id IS NULL
         GROUP BY LOWER(name)
       ) AS t
     )`,
    [storeId, storeId]
  );
  // Private duplicates
  const [result] = await pool.execute(
    `DELETE FROM extras
     WHERE store_id = ? AND owner_product_id IS NOT NULL
     AND id NOT IN (
       SELECT min_id FROM (
         SELECT MIN(id) AS min_id FROM extras
         WHERE store_id = ? AND owner_product_id IS NOT NULL
         GROUP BY owner_product_id, LOWER(name)
       ) AS t
     )`,
    [storeId, storeId]
  );
  return result.affectedRows;
}

/**
 * Lista única: al activar, clona los complementos vinculados del producto en copias
 * privadas (owner_product_id), para que editarlos solo afecte a ese producto.
 * Al desactivar, borra las copias privadas y vuelve a la biblioteca compartida.
 */
export async function setProductComplementsPrivate(productId, storeId, isPrivate) {
  const [prodRows] = await pool.execute('SELECT id FROM products WHERE id = ? AND store_id = ?', [productId, storeId]);
  if (!prodRows.length) throw new Error('Producto no encontrado');

  if (isPrivate) {
    // Ingredientes
    const [pings] = await pool.execute(
      `SELECT pi.included_by_default, i.* FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id WHERE pi.product_id = ?`,
      [productId]
    );
    await pool.execute('DELETE FROM product_ingredients WHERE product_id = ?', [productId]);
    for (const ing of pings) {
      let id = ing.id;
      if (ing.owner_product_id === productId) {
        // Already this product's private copy — use as-is
      } else if (ing.owner_product_id === null || ing.owner_product_id === undefined) {
        // Shared ingredient — create a private copy
        const [r] = await pool.execute(
          'INSERT INTO ingredients (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [storeId, ing.user_id || null, ing.name, ing.price || 0, ing.category_id || null, ing.image || null, ing.stock || 0, ing.unlimited_stock || 0, ing.stock_unit || 'unidades', ing.is_active == null ? 1 : ing.is_active, productId]
        );
        id = r.insertId;
      } else {
        // Belongs to another product's private list — skip, don't copy
        continue;
      }
      await pool.execute('INSERT INTO product_ingredients (product_id, ingredient_id, included_by_default) VALUES (?, ?, ?)', [productId, id, ing.included_by_default ? 1 : 0]);
    }
    // Extras
    const [pexts] = await pool.execute(
      `SELECT e.* FROM product_extras pe JOIN extras e ON e.id = pe.extra_id WHERE pe.product_id = ?`,
      [productId]
    );
    await pool.execute('DELETE FROM product_extras WHERE product_id = ?', [productId]);
    for (const ext of pexts) {
      let id = ext.id;
      if (ext.owner_product_id === productId) {
        // Already this product's private copy — use as-is
      } else if (ext.owner_product_id === null || ext.owner_product_id === undefined) {
        // Shared extra — create a private copy
        const [r] = await pool.execute(
          'INSERT INTO extras (store_id, user_id, name, price, category_id, image, stock, unlimited_stock, stock_unit, is_active, owner_product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [storeId, ext.user_id || null, ext.name, ext.price || 0, ext.category_id || null, ext.image || null, ext.stock || 0, ext.unlimited_stock || 0, ext.stock_unit || 'unidades', ext.is_active == null ? 1 : ext.is_active, productId]
        );
        id = r.insertId;
      } else {
        // Belongs to another product's private list — skip, don't copy
        continue;
      }
      await pool.execute('INSERT INTO product_extras (product_id, extra_id) VALUES (?, ?)', [productId, id]);
    }
    await pool.execute('UPDATE products SET complements_private = TRUE, complements_configured = TRUE WHERE id = ?', [productId]);
  } else {
    await pool.execute('DELETE FROM product_ingredients WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM product_extras WHERE product_id = ?', [productId]);
    await pool.execute('DELETE FROM ingredients WHERE owner_product_id = ? AND store_id = ?', [productId, storeId]);
    await pool.execute('DELETE FROM extras WHERE owner_product_id = ? AND store_id = ?', [productId, storeId]);
    await pool.execute('UPDATE products SET complements_private = FALSE, complements_configured = FALSE WHERE id = ?', [productId]);
  }
  return { success: true, private: !!isPrivate };
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
    is_minimarket: Boolean(row.is_minimarket),
    allow_serve: Boolean(row.allow_serve),
    allow_takeout: Boolean(row.allow_takeout),
    allow_ticketeria: Boolean(row.allow_ticketeria),
    hide_decimals: Boolean(row.hide_decimals),
    allow_table_service: Boolean(row.allow_table_service),
    delivery_enabled: Boolean(row.delivery_enabled),
    require_order_comment: Boolean(row.require_order_comment)
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
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods, require_order_comment } = data;
  const tipPct = parseFloat(tip_percentage) || 0;
  const delivMethods = Array.isArray(delivery_payment_methods) ? delivery_payment_methods.join(',') : (delivery_payment_methods || 'tuu,mercadopago');

  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }

  const [result] = await pool.execute(
    'INSERT INTO store_configurations (store_id, name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods, require_order_comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, !!is_default, !!is_minimarket, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false, !!hide_decimals, !!allow_table_service, tipPct, !!delivery_enabled, delivMethods, !!require_order_comment]
  );
  return {
    id: result.insertId,
    store_id: storeId,
    name,
    description: description || null,
    accept_cash: accept_cash !== false,
    accept_card: accept_card !== false,
    is_active: is_active !== false,
    is_default: !!is_default,
    is_minimarket: !!is_minimarket,
    default_minimarket_terminal: default_minimarket_terminal || null,
    allow_serve: allow_serve !== false,
    allow_takeout: allow_takeout !== false,
    hide_decimals: !!hide_decimals,
    allow_table_service: !!allow_table_service,
    tip_percentage: tipPct,
    delivery_enabled: !!delivery_enabled,
    delivery_payment_methods: delivMethods,
    require_order_comment: !!require_order_comment
  };
}

export async function updateStoreConfiguration(configId, storeId, data) {
  const { name, description, accept_cash, accept_card, is_active, is_default, is_minimarket, default_minimarket_terminal, allow_serve, allow_takeout, hide_decimals, allow_table_service, tip_percentage, delivery_enabled, delivery_payment_methods, require_order_comment } = data;
  const tipPct = parseFloat(tip_percentage) || 0;
  const delivMethods = Array.isArray(delivery_payment_methods) ? delivery_payment_methods.join(',') : (delivery_payment_methods || 'tuu,mercadopago');

  if (is_default) {
    await pool.execute(
      'UPDATE store_configurations SET is_default = FALSE WHERE store_id = ?',
      [storeId]
    );
  }

  await pool.execute(
    'UPDATE store_configurations SET name = ?, description = ?, accept_cash = ?, accept_card = ?, is_active = ?, is_default = ?, is_minimarket = ?, default_minimarket_terminal = ?, allow_serve = ?, allow_takeout = ?, hide_decimals = ?, allow_table_service = ?, tip_percentage = ?, delivery_enabled = ?, delivery_payment_methods = ?, require_order_comment = ? WHERE id = ? AND store_id = ?',
    [name, description || null, accept_cash !== false, accept_card !== false, is_active !== false, !!is_default, !!is_minimarket, default_minimarket_terminal || null, allow_serve !== false, allow_takeout !== false, !!hide_decimals, !!allow_table_service, tipPct, !!delivery_enabled, delivMethods, !!require_order_comment, configId, storeId]
  );
  return {
    id: configId,
    store_id: storeId,
    name,
    description: description || null,
    accept_cash: accept_cash !== false,
    accept_card: accept_card !== false,
    is_active: is_active !== false,
    is_default: !!is_default,
    is_minimarket: !!is_minimarket,
    default_minimarket_terminal: default_minimarket_terminal || null,
    allow_serve: allow_serve !== false,
    allow_takeout: allow_takeout !== false,
    hide_decimals: !!hide_decimals,
    allow_table_service: !!allow_table_service,
    tip_percentage: tipPct,
    delivery_enabled: !!delivery_enabled,
    delivery_payment_methods: delivMethods,
    require_order_comment: !!require_order_comment
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
    is_required: false, max_selections: 1,
    included_by_default: !!row.included_by_default
  });

  // ¿El producto tiene alguna asociación explícita guardada?
  const [piCount] = await pool.execute('SELECT COUNT(*) AS c FROM product_ingredients WHERE product_id = ?', [productId]);
  const hasExplicitLinks = (piCount[0]?.c || 0) > 0;

  if (complements_configured || hasExplicitLinks) {
    const [rows] = await pool.execute(`
      SELECT i.*, COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock,
             pi.included_by_default as included_by_default
      FROM ingredients i
      INNER JOIN product_ingredients pi ON pi.ingredient_id = i.id AND pi.product_id = ?
      WHERE COALESCE(i.is_active, 1) = 1
      ORDER BY i.sort_order, i.name
    `, [productId]);
    // Configuración explícita por producto: respetar exactamente la selección
    // (aunque quede vacía). El admin decide qué complementos usa cada producto.
    return rows.map(mapRow);
  }

  const [rows] = await pool.execute(`
    SELECT i.*, COALESCE(i.stock, 0) as stock, COALESCE(i.unlimited_stock, FALSE) as unlimited_stock
    FROM ingredients i
    WHERE i.store_id = ? AND COALESCE(i.is_active, 1) = 1
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

  // ¿El producto tiene alguna asociación explícita guardada?
  const [peCount] = await pool.execute('SELECT COUNT(*) AS c FROM product_extras WHERE product_id = ?', [productId]);
  const hasExplicitLinks = (peCount[0]?.c || 0) > 0;

  if (complements_configured || hasExplicitLinks) {
    const [rows] = await pool.execute(`
      SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
      FROM extras e
      INNER JOIN product_extras pe ON pe.extra_id = e.id AND pe.product_id = ?
      WHERE COALESCE(e.is_active, 1) = 1
      ORDER BY e.sort_order, e.name
    `, [productId]);
    // Configuración explícita por producto: respetar exactamente la selección
    // (aunque quede vacía). El admin decide qué extras usa cada producto.
    return rows.map(mapRow);
  }

  const [rows] = await pool.execute(`
    SELECT e.*, COALESCE(e.stock, 0) as stock, COALESCE(e.unlimited_stock, FALSE) as unlimited_stock
    FROM extras e
    WHERE e.store_id = ? AND COALESCE(e.is_active, 1) = 1
    ORDER BY e.sort_order, e.name
  `, [store_id]);
  return rows.map(mapRow);
}

// Secciones dinámicas (grupos personalizados) asignadas a un producto, con sus opciones
async function getProductComplementGroups(productId) {
  let links;
  try {
    [links] = await pool.execute(
      `SELECT g.* FROM product_complement_groups pg
       JOIN complement_groups g ON g.id = pg.group_id
       WHERE pg.product_id = ? AND COALESCE(g.is_active, 1) = 1
       ORDER BY pg.sort_order, g.sort_order, g.id`,
      [productId]
    );
  } catch { return []; }
  if (!links || links.length === 0) return [];

  const groups = [];
  for (const g of links) {
    const [opts] = await pool.execute(
      `SELECT * FROM complement_options
       WHERE group_id = ? AND COALESCE(is_active, 1) = 1
       ORDER BY sort_order, id`,
      [g.id]
    );
    groups.push({
      id: g.id,
      name: g.name,
      min_select: parseInt(g.min_select) || 0,
      max_select: parseInt(g.max_select) || 0,
      required: !!g.required,
      sort_order: parseInt(g.sort_order) || 0,
      options: opts.map(o => ({
        id: o.id,
        name: o.name,
        price: parseFloat(o.price) || 0,
        image: o.image,
        stock: parseInt(o.stock) || 0,
        unlimited_stock: o.unlimited_stock === null ? true : !!o.unlimited_stock
      }))
    });
  }
  return groups;
}

// ===== CRUD de secciones dinámicas (grupos y opciones) =====
export async function getComplementGroups(storeId) {
  const [groups] = await pool.execute(
    'SELECT * FROM complement_groups WHERE store_id = ? ORDER BY sort_order, id',
    [storeId]
  );
  const out = [];
  for (const g of groups) {
    const [opts] = await pool.execute(
      'SELECT * FROM complement_options WHERE group_id = ? ORDER BY sort_order, id',
      [g.id]
    );
    out.push({
      id: g.id,
      store_id: g.store_id,
      name: g.name,
      min_select: parseInt(g.min_select) || 0,
      max_select: parseInt(g.max_select) || 0,
      required: !!g.required,
      sort_order: parseInt(g.sort_order) || 0,
      is_active: g.is_active === null ? true : !!g.is_active,
      options: opts.map(o => ({
        id: o.id, group_id: o.group_id, name: o.name,
        price: parseFloat(o.price) || 0, image: o.image,
        stock: parseInt(o.stock) || 0,
        unlimited_stock: o.unlimited_stock === null ? true : !!o.unlimited_stock,
        sort_order: parseInt(o.sort_order) || 0,
        is_active: o.is_active === null ? true : !!o.is_active
      }))
    });
  }
  return out;
}

export async function createComplementGroup(storeId, data) {
  const { name, min_select, max_select, required, is_active } = data;
  const [[{ maxOrder }]] = await pool.execute(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxOrder FROM complement_groups WHERE store_id = ?',
    [storeId]
  );
  const [result] = await pool.execute(
    'INSERT INTO complement_groups (store_id, name, min_select, max_select, required, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [storeId, name, parseInt(min_select) || 0, parseInt(max_select) || 0, required ? 1 : 0, maxOrder, is_active === false ? 0 : 1]
  );
  return { id: result.insertId };
}

export async function updateComplementGroup(id, storeId, data) {
  const { name, min_select, max_select, required, is_active } = data;
  await pool.execute(
    'UPDATE complement_groups SET name = ?, min_select = ?, max_select = ?, required = ?, is_active = ? WHERE id = ? AND store_id = ?',
    [name, parseInt(min_select) || 0, parseInt(max_select) || 0, required ? 1 : 0, is_active === false ? 0 : 1, id, storeId]
  );
  return { id };
}

export async function deleteComplementGroup(id, storeId) {
  await pool.execute('DELETE FROM complement_groups WHERE id = ? AND store_id = ?', [id, storeId]);
  return { id };
}

export async function reorderComplementGroups(storeId, ids) {
  for (let i = 0; i < ids.length; i++) {
    await pool.execute('UPDATE complement_groups SET sort_order = ? WHERE id = ? AND store_id = ?', [i, ids[i], storeId]);
  }
  return true;
}

export async function createComplementOption(storeId, groupId, data) {
  // Verificar que el grupo pertenece a la tienda
  const [g] = await pool.execute('SELECT id FROM complement_groups WHERE id = ? AND store_id = ?', [groupId, storeId]);
  if (!g.length) throw new Error('Grupo no encontrado');
  const { name, price, image, stock, unlimited_stock, is_active } = data;
  const [[{ maxOrder }]] = await pool.execute(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxOrder FROM complement_options WHERE group_id = ?',
    [groupId]
  );
  const [result] = await pool.execute(
    'INSERT INTO complement_options (group_id, store_id, name, price, image, stock, unlimited_stock, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [groupId, storeId, name, parseFloat(price) || 0, image || null, parseInt(stock) || 0, unlimited_stock === false ? 0 : 1, maxOrder, is_active === false ? 0 : 1]
  );
  return { id: result.insertId };
}

export async function updateComplementOption(id, storeId, data) {
  const { name, price, image, stock, unlimited_stock, is_active } = data;
  if (image === undefined) {
    await pool.execute(
      'UPDATE complement_options SET name = ?, price = ?, stock = ?, unlimited_stock = ?, is_active = ? WHERE id = ? AND store_id = ?',
      [name, parseFloat(price) || 0, parseInt(stock) || 0, unlimited_stock === false ? 0 : 1, is_active === false ? 0 : 1, id, storeId]
    );
  } else {
    await pool.execute(
      'UPDATE complement_options SET name = ?, price = ?, image = ?, stock = ?, unlimited_stock = ?, is_active = ? WHERE id = ? AND store_id = ?',
      [name, parseFloat(price) || 0, image || null, parseInt(stock) || 0, unlimited_stock === false ? 0 : 1, is_active === false ? 0 : 1, id, storeId]
    );
  }
  return { id };
}

export async function deleteComplementOption(id, storeId) {
  await pool.execute('DELETE FROM complement_options WHERE id = ? AND store_id = ?', [id, storeId]);
  return { id };
}

export async function reorderComplementOptions(storeId, ids) {
  for (let i = 0; i < ids.length; i++) {
    await pool.execute('UPDATE complement_options SET sort_order = ? WHERE id = ? AND store_id = ?', [i, ids[i], storeId]);
  }
  return true;
}

// Reemplaza las secciones asignadas a un producto
export async function setProductComplementGroups(productId, groupIds) {
  await pool.execute('DELETE FROM product_complement_groups WHERE product_id = ?', [productId]);
  const ids = Array.isArray(groupIds) ? groupIds : [];
  for (let i = 0; i < ids.length; i++) {
    const gid = parseInt(ids[i]);
    if (!gid) continue;
    await pool.execute(
      'INSERT INTO product_complement_groups (product_id, group_id, sort_order) VALUES (?, ?, ?)',
      [productId, gid, i]
    );
  }
  return true;
}

export async function getProductComplementGroupIds(productId) {
  const [rows] = await pool.execute(
    'SELECT group_id FROM product_complement_groups WHERE product_id = ? ORDER BY sort_order',
    [productId]
  );
  return rows.map(r => r.group_id);
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
      extras: await getProductExtras(product.id, product.category_id),
      complement_groups: await getProductComplementGroups(product.id)
    };
    products.push(prod);
  }
  return products;
}

export async function createProduct(storeId, data) {
  const { name, barcode, description, price, category_id, image, has_extras, has_ingredients, max_extras, max_ingredients, show_description, show_prep_time } = data;
  const showDescription = show_description !== false;
  const showPrepTime = show_prep_time !== false;

  const store = await getStoreById(storeId);
  const [result] = await pool.execute(
    'INSERT INTO products (store_id, user_id, category_id, name, barcode, description, price, image, has_extras, has_ingredients, max_extras, max_ingredients, show_description, show_prep_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, category_id || null, name, barcode || null, description || null, price, image || null, has_extras ? 1 : 0, has_ingredients ? 1 : 0, parseInt(max_extras) || 0, parseInt(max_ingredients) || 0, showDescription ? 1 : 0, showPrepTime ? 1 : 0]
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
    show_description: showDescription,
    show_prep_time: showPrepTime,
    stock: 0,
    unlimited_stock: true,
    ingredients: await getProductIngredients(productId, category_id),
    extras: await getProductExtras(productId, category_id),
    complement_groups: await getProductComplementGroups(productId)
  };
}

export async function updateProduct(productId, storeId, data) {
  const { name, barcode, description, price, category_id, image, has_extras, has_ingredients, max_extras, max_ingredients, show_description, show_prep_time } = data;
  const showDescription = show_description !== false;
  const showPrepTime = show_prep_time !== false;

  await pool.execute(
    'UPDATE products SET name = ?, barcode = ?, description = ?, price = ?, category_id = ?, image = ?, has_extras = ?, has_ingredients = ?, max_extras = ?, max_ingredients = ?, show_description = ?, show_prep_time = ? WHERE id = ? AND store_id = ?',
    [name, barcode || null, description || null, price, category_id || null, image || null, has_extras ? 1 : 0, has_ingredients ? 1 : 0, parseInt(max_extras) || 0, parseInt(max_ingredients) || 0, showDescription ? 1 : 0, showPrepTime ? 1 : 0, productId, storeId]
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
    show_description: showDescription,
    show_prep_time: showPrepTime,
    stock: parseInt(stock) || 0,
    unlimited_stock: !!unlimited_stock,
    ingredients: await getProductIngredients(productId, category_id),
    extras: await getProductExtras(productId, category_id),
    complement_groups: await getProductComplementGroups(productId)
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
    extras: await getProductExtras(productId, rows[0].category_id),
    complement_groups: await getProductComplementGroups(productId)
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
      show_description: product.show_description !== 0 && product.show_description !== false,
      show_prep_time: product.show_prep_time !== 0 && product.show_prep_time !== false,
      ingredients: await getProductIngredients(product.id, product.category_id),
      extras: await getProductExtras(product.id, product.category_id),
      complement_groups: await getProductComplementGroups(product.id)
    };
    products.push(prod);
  }
  return products;
}

// ============ COMBOS ============

// Fetch combos for a store with their items. Each item carries the linked
// product's basic data (name/price/image) so the combo price can be summed.
// Combo price is always the automatic sum of product price * quantity.
async function getCombosForStore(storeId, { activeOnly = false } = {}) {
  let sql = 'SELECT * FROM combos WHERE store_id = ?';
  const params = [storeId];
  if (activeOnly) sql += ' AND is_active = TRUE';
  sql += ' ORDER BY sort_order ASC, id ASC';
  const [combos] = await pool.execute(sql, params);

  const result = [];
  for (const combo of combos) {
    const [items] = await pool.execute(`
      SELECT ci.id, ci.product_id, ci.quantity,
             p.name AS product_name, p.price AS product_price, p.image AS product_image,
             p.has_ingredients, p.has_extras
      FROM combo_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.combo_id = ?
      ORDER BY ci.id ASC
    `, [combo.id]);

    const mappedItems = [];
    for (const it of items) {
      const ingredients = it.has_ingredients ? await getProductIngredients(it.product_id) : [];
      const extras = it.has_extras ? await getProductExtras(it.product_id) : [];
      const complement_groups = await getProductComplementGroups(it.product_id);
      mappedItems.push({
        id: it.id,
        product_id: it.product_id,
        quantity: parseInt(it.quantity) || 1,
        product_name: it.product_name,
        product_price: parseFloat(it.product_price) || 0,
        product_image: it.product_image,
        has_ingredients: !!it.has_ingredients,
        has_extras: !!it.has_extras,
        ingredients,
        extras,
        complement_groups
      });
    }

    const autoPrice = mappedItems.reduce((sum, it) => sum + it.product_price * it.quantity, 0);
    const discountType = combo.discount_type || 'auto';
    const discountValue = parseFloat(combo.discount_value) || 0;
    const fixedPrice = parseFloat(combo.fixed_price) || 0;
    let price = autoPrice;
    if (discountType === 'fixed') price = fixedPrice;
    else if (discountType === 'percent') price = autoPrice * (1 - discountValue / 100);

    result.push({
      id: combo.id,
      store_id: combo.store_id,
      name: combo.name,
      description: combo.description,
      image: combo.image,
      is_active: !!combo.is_active,
      sort_order: parseInt(combo.sort_order) || 0,
      discount_type: discountType,
      discount_value: discountValue,
      fixed_price: fixedPrice,
      auto_price: autoPrice,
      price: Math.max(0, price),
      items: mappedItems
    });
  }
  return result;
}

export async function getCombos(storeId) {
  return getCombosForStore(storeId, { activeOnly: false });
}

export async function getPublicCombos(storeId) {
  // Only active combos that still have at least one item
  const combos = await getCombosForStore(storeId, { activeOnly: true });
  return combos.filter(c => c.items.length > 0);
}

async function replaceComboItems(comboId, items) {
  await pool.execute('DELETE FROM combo_items WHERE combo_id = ?', [comboId]);
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const productId = parseInt(item.product_id);
    const quantity = parseInt(item.quantity) || 1;
    if (!productId || quantity < 1) continue;
    await pool.execute(
      'INSERT INTO combo_items (combo_id, product_id, quantity) VALUES (?, ?, ?)',
      [comboId, productId, quantity]
    );
  }
}

export async function createCombo(storeId, data) {
  const { name, description, image, is_active, items, discount_type, discount_value, fixed_price } = data;
  const [result] = await pool.execute(
    'INSERT INTO combos (store_id, name, description, image, is_active, discount_type, discount_value, fixed_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, name, description || null, image || null, is_active === false ? 0 : 1,
     discount_type || 'auto', parseFloat(discount_value) || 0, parseFloat(fixed_price) || 0]
  );
  const comboId = result.insertId;
  await replaceComboItems(comboId, items);
  const combos = await getCombosForStore(storeId);
  return combos.find(c => c.id === comboId);
}

export async function updateCombo(comboId, storeId, data) {
  const { name, description, image, is_active, items, discount_type, discount_value, fixed_price } = data;
  await pool.execute(
    'UPDATE combos SET name = ?, description = ?, image = ?, is_active = ?, discount_type = ?, discount_value = ?, fixed_price = ? WHERE id = ? AND store_id = ?',
    [name, description || null, image || null, is_active === false ? 0 : 1,
     discount_type || 'auto', parseFloat(discount_value) || 0, parseFloat(fixed_price) || 0,
     comboId, storeId]
  );
  if (items !== undefined) await replaceComboItems(comboId, items);
  const combos = await getCombosForStore(storeId);
  return combos.find(c => c.id === comboId);
}

export async function deleteCombo(comboId, storeId) {
  await pool.execute('DELETE FROM combos WHERE id = ? AND store_id = ?', [comboId, storeId]);
  return true;
}

// ── Promociones de tienda ──────────────────────────────────────────
export async function getStorePromos(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM store_promos WHERE store_id = ? ORDER BY sort_order ASC, id ASC',
    [storeId]
  );
  return rows.map(r => ({ ...r, price: parseFloat(r.price) || 0, is_active: !!r.is_active }));
}

export async function getPublicStorePromos(storeId) {
  const [rows] = await pool.execute(
    'SELECT id, title, description, image, price FROM store_promos WHERE store_id = ? AND is_active = TRUE ORDER BY sort_order ASC, id ASC',
    [storeId]
  );
  return rows.map(r => ({ ...r, price: parseFloat(r.price) || 0 }));
}

export async function createStorePromo(storeId, data) {
  const { title, description, image, price, is_active } = data;
  const [result] = await pool.execute(
    'INSERT INTO store_promos (store_id, title, description, image, price, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [storeId, title, description || null, image || null, parseFloat(price) || 0, is_active === false ? 0 : 1]
  );
  const [rows] = await pool.execute('SELECT * FROM store_promos WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function updateStorePromo(promoId, storeId, data) {
  const { title, description, image, price, is_active } = data;
  await pool.execute(
    'UPDATE store_promos SET title = ?, description = ?, image = ?, price = ?, is_active = ? WHERE id = ? AND store_id = ?',
    [title, description || null, image || null, parseFloat(price) || 0, is_active === false ? 0 : 1, promoId, storeId]
  );
  const [rows] = await pool.execute('SELECT * FROM store_promos WHERE id = ?', [promoId]);
  return rows[0];
}

export async function deleteStorePromo(promoId, storeId) {
  await pool.execute('DELETE FROM store_promos WHERE id = ? AND store_id = ?', [promoId, storeId]);
  return true;
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
  const { order_type, items, payment_method, coupon_code, table_number, delivery_address, delivery_customer_id, customer_email, customer_name, persons, event_name, show_time, customer_comment } = orderData;
  
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
  const paidStatus = ['pending', 'completed'].includes(store?.paid_order_status) ? store.paid_order_status : 'pending';
  const initialStatus = paymentProcess === 1 ? paidStatus : 'pending';

  // Resolve pos_pin from terminal_id if not provided directly
  let posPin = orderData.pos_pin || null;
  if (!posPin && orderData.terminal_id) {
    const [pinRows] = await pool.execute('SELECT pos_pin FROM pos_terminals WHERE id = ? LIMIT 1', [orderData.terminal_id]).catch(() => [[]]);
    posPin = pinRows[0]?.pos_pin || null;
  }

  const isDeliveryApp = orderData.source === 'delivery_app';
  const isRestaurantPending = payment_method === 'pending';
  const deliveryStatus = isDeliveryApp ? 'waiting' : null;
  const finalStatus = isDeliveryApp ? paidStatus : isRestaurantPending ? paidStatus : initialStatus;
  const finalCashApproved = isDeliveryApp ? true : isRestaurantPending ? true : cashApproved;
  const finalPaymentProcess = isDeliveryApp ? 1 : isRestaurantPending ? 1 : paymentProcess;

  const [result] = await pool.execute(
    'INSERT INTO orders (store_id, user_id, order_type, subtotal, discount_total, coupon_code, total, payment_method, cash_approved, mp_order_id, external_reference, terminal_id, pos_pin, payment_process, status, table_number, persons, source, customer_phone, customer_name, delivery_address, delivery_status, delivery_customer_id, customer_email, event_name, show_time, customer_comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, store.user_id, order_type || 'serve', couponData.subtotal, couponData.discount_total, couponData.coupon_code, total, payment_method || 'card', finalCashApproved, orderData.mp_order_id || null, orderData.external_reference || null, orderData.terminal_id || null, posPin, finalPaymentProcess, finalStatus, table_number || null, persons || null, orderData.source || null, orderData.customer_phone || null, customer_name || null, delivery_address || null, deliveryStatus, delivery_customer_id || null, customer_email || null, event_name || null, show_time || null, customer_comment || null]
  );
  const orderId = result.insertId;

  if (couponData.coupon_id) {
    await pool.execute(
      'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?',
      [couponData.coupon_id]
    );
  }
  
  // Genera número de orden para todos los flujos EXCEPTO la app de delivery
  // (el tótem en modo delivery sí necesita su número para mostrarlo/recibo).
  let orderNumber = null;
  if (orderData.source !== 'delivery_app') {
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
    customer_comment: customer_comment || null,
    items
  };

  for (const item of items) {
    let selectedComplementsCol = null;
    try {
      selectedComplementsCol = JSON.stringify(item.selected_complements || []);
    } catch { selectedComplementsCol = '[]'; }
    try {
      await pool.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, selected_ingredients, selected_extras, selected_complements, combo_id, combo_label, promo_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          orderId,
          item.product_id ?? null,
          item.quantity,
          item.unit_price,
          JSON.stringify(item.selected_ingredients || []),
          JSON.stringify(item.selected_extras || []),
          selectedComplementsCol,
          item.combo_id || null,
          item.combo_label || null,
          item.promo_title || null
        ]
      );
    } catch (e) {
      // Compatibilidad si las columnas aún no existen
      await pool.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, selected_ingredients, selected_extras) VALUES (?, ?, ?, ?, ?, ?)',
        [
          orderId,
          item.product_id ?? null,
          item.quantity,
          item.unit_price,
          JSON.stringify(item.selected_ingredients || []),
          JSON.stringify(item.selected_extras || [])
        ]
      );
    }

    // Deduct product stock (los items de promoción no tienen producto)
    if (!item.product_id) continue;
    const [invRows] = await pool.execute(
      'SELECT stock, unlimited_stock FROM inventory WHERE product_id = ?',
      [item.product_id]
    );
    if (invRows.length > 0 && !invRows[0].unlimited_stock) {
      const prevStock = invRows[0].stock;
      const newStock = Math.max(0, prevStock - item.quantity);
      await pool.execute(
        'UPDATE inventory SET stock = GREATEST(0, stock - ?) WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
      logInventoryMovement({ storeId, itemType: 'product', itemId: item.product_id, itemName: item.name || '', previousQty: prevStock, newQty: newStock, reason: 'order', referenceId: finalOrder.id }).catch(() => {});
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

    // Deduct stock of dynamic complement options (secciones personalizadas)
    for (const sel of (item.selected_complements || [])) {
      const optId = sel?.option_id ?? sel?.id;
      if (!optId) continue;
      try {
        const [optRows] = await pool.execute(
          'SELECT id, unlimited_stock FROM complement_options WHERE id = ? AND store_id = ? LIMIT 1',
          [optId, storeId]
        );
        if (optRows.length > 0 && !optRows[0].unlimited_stock) {
          await pool.execute(
            'UPDATE complement_options SET stock = GREATEST(0, stock - ?) WHERE id = ?',
            [item.quantity, optRows[0].id]
          );
        }
      } catch { /* ignore */ }
    }

    // Deduct raw materials for product (recipe) — multiplied by order quantity
    const [prodRecipe] = await pool.execute(
      'SELECT pr.raw_material_id, pr.quantity_used, rm.name as rm_name, rm.quantity as rm_qty FROM product_recipes pr JOIN raw_materials rm ON pr.raw_material_id = rm.id WHERE pr.item_type = ? AND pr.item_id = ?',
      ['product', item.product_id]
    );
    for (const r of prodRecipe) {
      const deduct = r.quantity_used * item.quantity;
      const prevQ = parseFloat(r.rm_qty);
      const newQ = Math.max(0, prevQ - deduct);
      await pool.execute(
        'UPDATE raw_materials SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
        [deduct, r.raw_material_id]
      );
      logInventoryMovement({ storeId, itemType: 'raw_material', itemId: r.raw_material_id, itemName: r.rm_name, previousQty: prevQ, newQty: newQ, reason: 'recipe', referenceId: finalOrder.id }).catch(() => {});
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

export async function getDailySales(storeId, date) {
  const [orderRows] = await pool.execute(
    `SELECT o.*, w.name as completed_by_name
     FROM orders o
     LEFT JOIN workers w ON o.completed_by = w.id
     WHERE o.store_id = ? AND DATE(o.created_at) = ?
     AND (o.payment_process = 1 OR (o.payment_method = 'cash' AND o.cash_approved = 0))
     ORDER BY o.created_at DESC`,
    [storeId, date]
  );

  const orders = [];
  for (const order of orderRows) {
    let items = await getOrderItems(order.id);
    if (!items.length && order.external_items) {
      try {
        const ext = typeof order.external_items === 'string' ? JSON.parse(order.external_items) : order.external_items;
        items = ext.map(i => ({ ...i, product_name: i.name, selected_ingredients: [], selected_extras: [] }));
      } catch {}
    }
    orders.push({ ...order, total: parseFloat(order.total) || 0, items });
  }

  const completed = orders.filter(o => ['completed', 'paid', 'processed', 'approved'].includes(o.status));
  const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);

  const byPaymentMethod = {};
  completed.forEach(o => {
    const pm = o.payment_method || 'other';
    if (!byPaymentMethod[pm]) byPaymentMethod[pm] = { count: 0, total: 0 };
    byPaymentMethod[pm].count++;
    byPaymentMethod[pm].total += o.total;
  });

  const byOrderType = {};
  completed.forEach(o => {
    const ot = o.order_type || 'other';
    if (!byOrderType[ot]) byOrderType[ot] = { count: 0, total: 0 };
    byOrderType[ot].count++;
    byOrderType[ot].total += o.total;
  });

  const productMap = {};
  completed.forEach(o => {
    o.items.forEach(item => {
      const name = item.product_name || 'Desconocido';
      if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0 };
      productMap[name].quantity += item.quantity || 0;
      productMap[name].revenue += (item.unit_price || 0) * (item.quantity || 0);
    });
  });
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  return {
    date,
    orders,
    summary: {
      totalOrders: orders.length,
      completedOrders: completed.length,
      pendingOrders: orders.filter(o => ['pending', 'waiting'].includes(o.status)).length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue,
      avgOrder: completed.length ? totalRevenue / completed.length : 0,
      byPaymentMethod,
      byOrderType,
    },
    topProducts,
  };
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

export async function getOrderItems(orderId) {
  const [rows] = await pool.execute(`
    SELECT oi.*, COALESCE(oi.promo_title, p.name, 'Producto eliminado') as product_name
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `, [orderId]);
  
  return rows.map(row => ({
    ...row,
    unit_price: parseFloat(row.unit_price),
    selected_ingredients: JSON.parse(row.selected_ingredients || '[]'),
    selected_extras: JSON.parse(row.selected_extras || '[]'),
    selected_complements: JSON.parse(row.selected_complements || '[]')
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
    'SELECT id, store_id, username, name, phone, birth_date, created_at FROM workers WHERE store_id = ? ORDER BY name',
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

// ============================================================
// SUMUP
// ============================================================

export async function processSumUpPayment(storeId, orderData) {
  const { items, order_type, selected_terminal_id, coupon_code, total: frontendTotal } = orderData;

  const terminal = await getPosTerminalForStore(storeId, selected_terminal_id);
  if (!terminal) throw new Error('La máquina SumUp seleccionada no está disponible para esta tienda');

  const apiKey = terminal.api_key;
  const merchantCode = terminal.device_id;

  if (!apiKey || !merchantCode) throw new Error('Configuración de SumUp incompleta: falta API Key o Merchant Code');

  let subtotal = 0;
  items.forEach(item => { subtotal += item.unit_price * item.quantity; });
  const couponData = await resolveCouponForOrder(storeId, coupon_code, subtotal);
  const total = frontendTotal ? parseFloat(frontendTotal) : couponData.total;

  const storeInfo = await getStoreById(storeId);
  const checkoutRef = `SRSERVI-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const payload = {
    checkout_reference: checkoutRef,
    amount: parseFloat(total.toFixed(2)),
    currency: storeInfo?.currency_code || 'USD',
    merchant_code: merchantCode,
    description: `Pedido ${order_type === 'takeout' ? 'para llevar' : 'para consumir aqui'}`
  };

  console.log('Enviando checkout a SumUp:', payload);

  const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error de SumUp:', errorText);
    throw new Error(`Error al crear checkout SumUp: ${errorText}`);
  }

  const sumupResponse = await response.json();
  console.log('Respuesta de SumUp:', sumupResponse);

  return {
    mp_order_id: sumupResponse.id,
    status: sumupResponse.status,
    external_reference: checkoutRef,
    amount: total,
    subtotal: couponData.subtotal,
    discount_total: couponData.discount_total,
    coupon_code: couponData.coupon_code
  };
}

export async function getSumUpCheckoutStatus(checkoutId, apiKey) {
  const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al consultar estado SumUp: ${errorText}`);
  }

  return response.json();
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
    SELECT u.id, u.username, u.email, u.business_name, u.code, u.is_banned, u.created_at, u.last_active, u.country, u.phone,
           COUNT(s.id) as store_count
    FROM users u
    LEFT JOIN stores s ON u.id = s.user_id
    GROUP BY u.id
    ORDER BY u.last_active DESC
  `);
  return rows;
}

export async function getUserApps() {
  const [rows] = await pool.execute(`
    SELECT
      u.id AS user_id,
      u.username,
      u.email,
      u.business_name,
      u.last_active,
      COUNT(DISTINCT s.id) AS store_count,
      MAX(CASE WHEN w.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_workers,
      MAX(CASE WHEN rt.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_tables,
      MAX(CASE WHEN ap.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_attendance,
      MAX(CASE WHEN ds.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_delivery,
      MAX(CASE WHEN cr.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_cash_register,
      MAX(CASE WHEN c.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_coupons,
      MAX(CASE WHEN ig.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_instagram,
      MAX(CASE WHEN ra.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_rappi,
      MAX(CASE WHEN py.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_pedidosya,
      MAX(CASE WHEN ue.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_ubereats,
      MAX(CASE WHEN ai.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_leon_ia,
      MAX(CASE WHEN pcc.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_aforo,
      MAX(CASE WHEN wp.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_procedures,
      MAX(CASE WHEN t.store_id IS NOT NULL THEN 1 ELSE 0 END) AS has_tasks
    FROM users u
    LEFT JOIN stores s ON u.id = s.user_id
    LEFT JOIN workers w ON s.id = w.store_id
    LEFT JOIN restaurant_tables rt ON s.id = rt.store_id
    LEFT JOIN attendance_persons ap ON s.id = ap.store_id
    LEFT JOIN delivery_settings ds ON s.id = ds.store_id
    LEFT JOIN cash_registers cr ON s.id = cr.store_id
    LEFT JOIN coupons c ON s.id = c.store_id
    LEFT JOIN instagram_configs ig ON s.id = ig.store_id
    LEFT JOIN rappi_config ra ON s.id = ra.store_id
    LEFT JOIN pedidosya_config py ON s.id = py.store_id
    LEFT JOIN ubereats_config ue ON s.id = ue.store_id
    LEFT JOIN ai_config ai ON s.id = ai.store_id
    LEFT JOIN people_counter_config pcc ON s.id = pcc.store_id
    LEFT JOIN worker_procedures wp ON s.id = wp.store_id
    LEFT JOIN tasks t ON s.id = t.store_id
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

// ─── Trial gratis (3 meses de SOLO, self-service, sin tarjeta) ───────────────

export async function hasClaimedTrial(userId) {
  const [rows] = await pool.execute('SELECT trial_claimed_at FROM users WHERE id = ?', [userId]);
  return !!rows[0]?.trial_claimed_at;
}

export async function claimFreeTrial(userId) {
  const alreadyClaimed = await hasClaimedTrial(userId);
  if (alreadyClaimed) {
    throw new Error('Ya reclamaste tu prueba gratis anteriormente');
  }

  const [soloPlanRows] = await pool.execute("SELECT id FROM plans WHERE name = 'SOLO' LIMIT 1");
  if (soloPlanRows.length === 0) {
    throw new Error('Plan SOLO no configurado');
  }

  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + 3);

  const result = await assignPremiumByAdmin(userId, soloPlanRows[0].id, false, endsAt);
  await pool.execute('UPDATE users SET trial_claimed_at = NOW() WHERE id = ?', [userId]);

  return result;
}

// Vuelve al usuario a Gratis de inmediato (cancelación self-service).
export async function cancelUserPlan(userId) {
  const [gratisPlanRows] = await pool.execute("SELECT id FROM plans WHERE name = 'Gratis' LIMIT 1");
  if (gratisPlanRows.length === 0) {
    throw new Error('Plan Gratis no configurado');
  }

  await pool.execute('UPDATE user_plans SET is_active = FALSE WHERE user_id = ?', [userId]);
  await pool.execute(
    'INSERT INTO user_plans (user_id, plan_id, billing_cycle, ends_at) VALUES (?, ?, ?, ?)',
    [userId, gratisPlanRows[0].id, 'forever', new Date('2037-12-31T23:59:59')]
  );

  return { success: true };
}

// ─── Bloqueo de tiendas por límite de plan ───────────────────────────────────
// Si el usuario tiene más tiendas que max_stores de su plan activo (ej. al
// vencer un trial), las MÁS NUEVAS por encima del límite quedan bloqueadas —
// las primeras que creó (bajo el plan original) siguen usables.

export async function getLockedStoreIds(userId) {
  const plan = await getUserPlan(userId);
  const maxStores = plan?.max_stores ?? 2;

  const [stores] = await pool.execute(
    'SELECT id FROM stores WHERE user_id = ? ORDER BY created_at ASC',
    [userId]
  );

  return new Set(stores.slice(maxStores).map(s => s.id));
}

export async function isStoreLocked(storeId) {
  const [rows] = await pool.execute('SELECT user_id FROM stores WHERE id = ?', [storeId]);
  if (rows.length === 0) return false;
  const locked = await getLockedStoreIds(rows[0].user_id);
  return locked.has(storeId);
}

export async function getAnalytics(storeId, dateRange = 'week', startDate = null, endDate = null) {
  let dateFilterO = '';
  let dateFilterPlain = '';
  const dateParams = [];

  if (dateRange === 'custom' && startDate && endDate) {
    dateFilterO = `AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    dateFilterPlain = `AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    dateParams.push(startDate, endDate);
  } else {
    switch (dateRange) {
      case 'today':
        dateFilterO = `AND DATE(o.created_at) = CURDATE()`;
        dateFilterPlain = `AND DATE(created_at) = CURDATE()`;
        break;
      case 'week':
        dateFilterO = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        dateFilterPlain = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        break;
      case 'month':
        dateFilterO = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        dateFilterPlain = `AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        break;
      case 'year':
        dateFilterO = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        dateFilterPlain = `AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)`;
        break;
      default:
        dateFilterO = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        dateFilterPlain = `AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    }
  }

  const totalOrdersQuery = `
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status IN ('pending', 'waiting') THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status IN ('cancelled') THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN total ELSE 0 END) as revenue
    FROM orders o
    WHERE store_id = ? ${dateFilterO}
  `;

  const [totals] = await pool.execute(totalOrdersQuery, [storeId, ...dateParams]);

  const avgOrderQuery = `
    SELECT AVG(total) as avg_order
    FROM orders
    WHERE store_id = ? AND status IN ('paid', 'processed', 'completed', 'approved') ${dateFilterPlain}
  `;

  const [avgResult] = await pool.execute(avgOrderQuery, [storeId, ...dateParams]);

  return {
    totalOrders: totals[0].total || 0,
    completedOrders: totals[0].completed || 0,
    pendingOrders: totals[0].pending || 0,
    cancelledOrders: totals[0].cancelled || 0,
    revenue: parseFloat(totals[0].revenue || 0),
    avgOrder: parseFloat(avgResult[0].avg_order || 0)
  };
}

export async function getSalesByDay(storeId, dateRange = 'week', startDate = null, endDate = null) {
  const params = [storeId];
  let condition;
  if (dateRange === 'custom' && startDate && endDate) {
    condition = `AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(startDate, endDate);
  } else {
    let interval = '7 DAY';
    switch (dateRange) {
      case 'today': interval = '1 DAY'; break;
      case 'week': interval = '7 DAY'; break;
      case 'month': interval = '30 DAY'; break;
      case 'year': interval = '365 DAY'; break;
    }
    condition = `AND created_at >= DATE_SUB(NOW(), INTERVAL ${interval})`;
  }

  const query = `
    SELECT DATE(created_at) as date,
           COUNT(*) as orders,
           SUM(CASE WHEN status IN ('paid', 'processed', 'completed', 'approved') THEN total ELSE 0 END) as revenue
    FROM orders
    WHERE store_id = ? ${condition}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const [rows] = await pool.execute(query, params);
  return rows;
}

export async function getTopProducts(storeId, limit = 10, dateRange = 'week', { sortBy = 'quantity', categoryId = null, startDate = null, endDate = null } = {}) {
  const params = [storeId];
  let dateCondition;
  if (dateRange === 'custom' && startDate && endDate) {
    dateCondition = `AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(startDate, endDate);
  } else {
    let interval = '7 DAY';
    switch (dateRange) {
      case 'today': interval = '1 DAY'; break;
      case 'week': interval = '7 DAY'; break;
      case 'month': interval = '30 DAY'; break;
      case 'year': interval = '365 DAY'; break;
    }
    dateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})`;
  }

  let categoryFilter = '';
  if (categoryId) {
    categoryFilter = 'AND p.category_id = ?';
    params.push(categoryId);
  }

  const orderColumn = sortBy === 'revenue' ? 'revenue' : 'total_sold';

  const query = `
    SELECT
      p.id,
      p.name,
      p.image,
      p.category_id,
      c.name as category_name,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.store_id = ?
      AND o.status IN ('paid', 'processed', 'completed', 'approved')
      ${dateCondition}
      ${categoryFilter}
    GROUP BY p.id, p.name, p.image, p.category_id, c.name
    ORDER BY ${orderColumn} DESC
    LIMIT ${parseInt(limit)}
  `;

  const [rows] = await pool.execute(query, params);
  return rows;
}

export async function getBottomProducts(storeId, limit = 10, dateRange = 'week', { sortBy = 'quantity', categoryId = null, startDate = null, endDate = null } = {}) {
  const params = [storeId];
  let dateCondition;
  if (dateRange === 'custom' && startDate && endDate) {
    dateCondition = `AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
    params.push(startDate, endDate);
  } else {
    let interval = '7 DAY';
    switch (dateRange) {
      case 'today': interval = '1 DAY'; break;
      case 'week': interval = '7 DAY'; break;
      case 'month': interval = '30 DAY'; break;
      case 'year': interval = '365 DAY'; break;
    }
    dateCondition = `AND o.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})`;
  }

  let categoryFilter = '';
  if (categoryId) {
    categoryFilter = 'AND p.category_id = ?';
    params.push(categoryId);
  }

  const orderColumn = sortBy === 'revenue' ? 'revenue' : 'total_sold';

  const query = `
    SELECT
      p.id,
      p.name,
      p.image,
      p.category_id,
      c.name as category_name,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.store_id = ?
      AND o.status IN ('paid', 'processed', 'completed', 'approved')
      ${dateCondition}
      ${categoryFilter}
    GROUP BY p.id, p.name, p.image, p.category_id, c.name
    HAVING total_sold > 0
    ORDER BY ${orderColumn} ASC
    LIMIT ${parseInt(limit)}
  `;

  const [rows] = await pool.execute(query, params);
  return rows;
}

export async function getProductSalesReport(storeId, range = 'yesterday') {
  const dateFilter = range === 'yesterday'
    ? 'AND DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    : 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';

  const query = `
    SELECT
      p.id,
      p.name,
      c.name as category_name,
      SUM(oi.quantity) as total_sold,
      SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.store_id = ?
      AND o.status IN ('paid', 'processed', 'completed', 'approved')
      ${dateFilter}
    GROUP BY p.id, p.name, c.name
    ORDER BY total_sold DESC
  `;
  const [rows] = await pool.execute(query, [storeId]);

  const unsoldQuery = `
    SELECT p.id, p.name, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ?
      AND p.id NOT IN (
        SELECT DISTINCT oi.product_id FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.store_id = ? AND o.status IN ('paid', 'processed', 'completed', 'approved')
          ${dateFilter}
      )
    ORDER BY p.name ASC
    LIMIT 20
  `;
  const [unsold] = await pool.execute(unsoldQuery, [storeId, storeId]);

  const top = rows.slice(0, 10);
  const bottom = rows.length > 1 ? rows.slice(-10).reverse() : [];

  return { top, bottom, unsold };
}

export async function getAllStoresWithOwnerEmail() {
  const [rows] = await pool.execute(`
    SELECT s.id, s.name, s.code, s.currency_code, u.email as owner_email
    FROM stores s
    JOIN users u ON s.user_id = u.id
    WHERE u.is_banned = FALSE
    ORDER BY s.name ASC
  `);
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

export async function getFudoConfig(storeId) {
  const [rows] = await pool.execute('SELECT * FROM fudo_configs WHERE store_id = ?', [storeId]);
  return rows[0] || null;
}

export async function saveFudoConfig(storeId, { api_secret, enabled }) {
  await pool.execute(`
    INSERT INTO fudo_configs (store_id, api_secret, enabled)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      api_secret = VALUES(api_secret),
      enabled = VALUES(enabled)
  `, [storeId, api_secret || '', enabled ? 1 : 0]);
}

export async function updateFudoSyncStatus(storeId, status, errorMsg = null) {
  await pool.execute(
    'UPDATE fudo_configs SET last_sync_at = NOW(), last_sync_status = ?, last_error = ? WHERE store_id = ?',
    [status, errorMsg, storeId]
  );
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
        CONCAT(oi.quantity, 'x ', COALESCE(oi.promo_title, p.name, 'Producto'),
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
      AND o.status = 'completed'
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

// ─── Egresos de caja ─────────────────────────────────────────────────────────

export async function addCashMovement(cashRegisterId, storeId, amount, description, category, workerName) {
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) throw new Error('Monto inválido');
  const [result] = await pool.execute(
    `INSERT INTO cash_movements (cash_register_id, store_id, amount, description, category, worker_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cashRegisterId, storeId, amt, description || null, category || 'gasto', workerName || null]
  );
  const [rows] = await pool.execute('SELECT * FROM cash_movements WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function getCashMovements(cashRegisterId) {
  const [rows] = await pool.execute(
    'SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at ASC',
    [cashRegisterId]
  );
  return rows;
}

export async function deleteCashMovement(id, storeId) {
  await pool.execute('DELETE FROM cash_movements WHERE id = ? AND store_id = ?', [id, storeId]);
  return { success: true };
}

/**
 * Estado de resultados de una caja: ingresos (efectivo/tarjeta), egresos y efectivo esperado.
 * Considera los pedidos creados dentro de la ventana de la caja (apertura → cierre/now).
 */
export async function getCashRegisterFinancials(storeId, register) {
  if (!register) return null;
  const closedClause = register.closed_at ? 'AND o.created_at <= ?' : '';
  const params = register.closed_at
    ? [storeId, register.opened_at, register.closed_at]
    : [storeId, register.opened_at];

  const [salesRows] = await pool.execute(`
    SELECT
      COALESCE(SUM(o.total), 0) AS total_ventas,
      COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END), 0) AS ventas_efectivo,
      COALESCE(SUM(CASE WHEN o.payment_method <> 'cash' OR o.payment_method IS NULL THEN o.total ELSE 0 END), 0) AS ventas_tarjeta,
      COUNT(o.id) AS total_pedidos
    FROM orders o
    WHERE o.store_id = ? AND o.created_at >= ? ${closedClause}
  `, params);

  const sales = salesRows[0] || {};
  const movements = await getCashMovements(register.id);
  const totalEgresos = movements.reduce((s, m) => s + Number(m.amount || 0), 0);

  const opening = Number(register.opening_amount || 0);
  const ventasEfectivo = Number(sales.ventas_efectivo || 0);
  const ventasTarjeta = Number(sales.ventas_tarjeta || 0);
  const totalVentas = Number(sales.total_ventas || 0);

  return {
    opening,
    ventas_efectivo: ventasEfectivo,
    ventas_tarjeta: ventasTarjeta,
    total_ventas: totalVentas,
    total_pedidos: Number(sales.total_pedidos || 0),
    total_egresos: totalEgresos,
    // Resultado neto del turno (ventas - egresos)
    resultado_neto: totalVentas - totalEgresos,
    // Efectivo que debería haber físicamente en caja
    efectivo_esperado: opening + ventasEfectivo - totalEgresos,
    movements
  };
}

// ─── Gastos generales y Estado de resultados ────────────────────────────────

export async function getStoreExpenses(storeId, from, to) {
  let sql = 'SELECT * FROM store_expenses WHERE store_id = ?';
  const params = [storeId];
  if (from) { sql += ' AND expense_date >= ?'; params.push(from); }
  if (to) { sql += ' AND expense_date <= ?'; params.push(to); }
  sql += ' ORDER BY expense_date DESC, id DESC';
  const [rows] = await pool.execute(sql, params);
  return rows.map(r => ({ ...r, amount: Number(r.amount) }));
}

export async function addStoreExpense(storeId, { amount, description, category, expense_date }) {
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) throw new Error('Monto inválido');
  const date = expense_date || new Date().toISOString().slice(0, 10);
  const [result] = await pool.execute(
    'INSERT INTO store_expenses (store_id, amount, description, category, expense_date) VALUES (?, ?, ?, ?, ?)',
    [storeId, amt, description || null, category || 'Otros', date]
  );
  const [rows] = await pool.execute('SELECT * FROM store_expenses WHERE id = ?', [result.insertId]);
  return { ...rows[0], amount: Number(rows[0].amount) };
}

export async function deleteStoreExpense(id, storeId) {
  await pool.execute('DELETE FROM store_expenses WHERE id = ? AND store_id = ?', [id, storeId]);
  return { success: true };
}

/**
 * Estado de resultados de la tienda en un rango de fechas:
 * ingresos (ventas por método de pago) − egresos (gastos por categoría).
 */
export async function getIncomeStatement(storeId, from, to) {
  // Ingresos desde pedidos. Rango sobre created_at (incluye todo el día "to").
  let salesSql = `
    SELECT
      COALESCE(SUM(o.total), 0) AS total_ingresos,
      COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END), 0) AS ingresos_efectivo,
      COALESCE(SUM(CASE WHEN o.payment_method <> 'cash' OR o.payment_method IS NULL THEN o.total ELSE 0 END), 0) AS ingresos_tarjeta,
      COUNT(o.id) AS total_pedidos
    FROM orders o
    WHERE o.store_id = ?`;
  const salesParams = [storeId];
  if (from) { salesSql += ' AND o.created_at >= ?'; salesParams.push(from + ' 00:00:00'); }
  if (to) { salesSql += ' AND o.created_at <= ?'; salesParams.push(to + ' 23:59:59'); }
  const [salesRows] = await pool.execute(salesSql, salesParams);
  const s = salesRows[0] || {};

  // Egresos por categoría
  const expenses = await getStoreExpenses(storeId, from, to);
  const byCategory = {};
  let totalEgresos = 0;
  for (const e of expenses) {
    const cat = e.category || 'Otros';
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    totalEgresos += Number(e.amount);
  }

  const totalIngresos = Number(s.total_ingresos || 0);
  return {
    total_ingresos: totalIngresos,
    ingresos_efectivo: Number(s.ingresos_efectivo || 0),
    ingresos_tarjeta: Number(s.ingresos_tarjeta || 0),
    total_pedidos: Number(s.total_pedidos || 0),
    total_egresos: totalEgresos,
    egresos_por_categoria: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
    resultado_neto: totalIngresos - totalEgresos,
    expenses
  };
}

// ─── SRBrain ─────────────────────────────────────────────────────────────────

export async function getAiConfig(storeId) {
  const [rows] = await pool.execute('SELECT * FROM ai_config WHERE store_id = ? LIMIT 1', [storeId]);
  return rows[0] || null;
}

export async function saveAiConfig(storeId, data) {
  const { enabled, auto_promotions, worker_reminders, morale_messages, birthday_greetings, birthday_coupon_percent, promotion_threshold, sender_name, send_hour, send_days } = data;
  await pool.execute(`
    INSERT INTO ai_config (store_id, enabled, auto_promotions, worker_reminders, morale_messages, birthday_greetings, birthday_coupon_percent, promotion_threshold, sender_name, send_hour, send_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      auto_promotions = VALUES(auto_promotions),
      worker_reminders = VALUES(worker_reminders),
      morale_messages = VALUES(morale_messages),
      birthday_greetings = VALUES(birthday_greetings),
      birthday_coupon_percent = VALUES(birthday_coupon_percent),
      promotion_threshold = VALUES(promotion_threshold),
      sender_name = VALUES(sender_name),
      send_hour = VALUES(send_hour),
      send_days = VALUES(send_days),
      updated_at = CURRENT_TIMESTAMP
  `, [storeId, enabled ?? false, auto_promotions ?? true, worker_reminders ?? true, morale_messages ?? true, birthday_greetings ?? true, birthday_coupon_percent ?? 15, promotion_threshold ?? 20, sender_name || 'El Administrador', send_hour ?? 8, send_days || '1,2,3,4,5,6,7']);
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

export async function updateWorkerBirthday(workerId, birthDate) {
  await pool.execute('UPDATE workers SET birth_date = ? WHERE id = ?', [birthDate || null, workerId]);
}

// Trabajadores con teléfono que cumplen años HOY (compara mes y día)
export async function getWorkersWithBirthdayToday(storeId) {
  const [rows] = await pool.execute(
    `SELECT id, name, phone, birth_date FROM workers
     WHERE store_id = ?
       AND phone IS NOT NULL AND phone != ''
       AND birth_date IS NOT NULL
       AND MONTH(birth_date) = MONTH(CURDATE())
       AND DAY(birth_date) = DAY(CURDATE())`,
    [storeId]
  );
  return rows;
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

// ─── Attendance system ───────────────────────────────────────────────────────

let _attendanceReady = false;
async function ensureAttendanceTables() {
  if (_attendanceReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_persons (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      rut VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      surname VARCHAR(255) NOT NULL,
      face_descriptor JSON NOT NULL,
      face_photo MEDIUMTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_rut_per_store (store_id, rut),
      INDEX idx_ap_store (store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      person_id INT NOT NULL,
      type ENUM('ENTRADA','SALIDA','INICIO_ALMUERZO','FIN_ALMUERZO','INICIO_PAUSA','FIN_PAUSA') NOT NULL,
      recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ar_store (store_id),
      INDEX idx_ar_person (person_id),
      INDEX idx_ar_date (recorded_at),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES attendance_persons(id) ON DELETE CASCADE
    )
  `);
  _attendanceReady = true;
}

export async function getAttendancePersons(storeId) {
  await ensureAttendanceTables();
  const [rows] = await pool.execute(
    'SELECT id, rut, name, surname, face_descriptor, face_photo FROM attendance_persons WHERE store_id = ? ORDER BY name ASC',
    [storeId]
  );
  return rows.map(r => ({
    ...r,
    face_descriptor: typeof r.face_descriptor === 'string' ? JSON.parse(r.face_descriptor) : r.face_descriptor
  }));
}

export async function getAttendancePersonByRut(storeId, rut) {
  await ensureAttendanceTables();
  const [rows] = await pool.execute(
    'SELECT id, rut, name, surname FROM attendance_persons WHERE store_id = ? AND rut = ?',
    [storeId, rut]
  );
  return rows[0] || null;
}

export async function createAttendancePerson(storeId, rut, name, surname, faceDescriptor, facePhoto) {
  await ensureAttendanceTables();
  const [result] = await pool.execute(
    'INSERT INTO attendance_persons (store_id, rut, name, surname, face_descriptor, face_photo) VALUES (?, ?, ?, ?, ?, ?)',
    [storeId, rut, name, surname, JSON.stringify(faceDescriptor), facePhoto || null]
  );
  return result.insertId;
}

export async function deleteAttendancePerson(id, storeId) {
  await ensureAttendanceTables();
  await pool.execute('DELETE FROM attendance_persons WHERE id = ? AND store_id = ?', [id, storeId]);
}

export async function createAttendanceRecord(storeId, personId, type) {
  await ensureAttendanceTables();
  const [result] = await pool.execute(
    'INSERT INTO attendance_records (store_id, person_id, type) VALUES (?, ?, ?)',
    [storeId, personId, type]
  );
  return result.insertId;
}

export async function getAttendanceRecords(storeId, date) {
  await ensureAttendanceTables();
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.type, ar.recorded_at,
            ap.rut, ap.name, ap.surname
     FROM attendance_records ar
     JOIN attendance_persons ap ON ar.person_id = ap.id
     WHERE ar.store_id = ? AND DATE(ar.recorded_at) = ?
     ORDER BY ar.recorded_at DESC`,
    [storeId, date]
  );
  return rows;
}

export async function getAttendanceRecordsRange(storeId, startDate, endDate) {
  await ensureAttendanceTables();
  const [rows] = await pool.execute(
    `SELECT ar.id, ar.type, ar.recorded_at,
            ap.id as person_id, ap.rut, ap.name, ap.surname
     FROM attendance_records ar
     JOIN attendance_persons ap ON ar.person_id = ap.id
     WHERE ar.store_id = ? AND DATE(ar.recorded_at) BETWEEN ? AND ?
     ORDER BY ar.recorded_at DESC`,
    [storeId, startDate, endDate]
  );
  return rows;
}

export async function getLastAttendanceRecord(storeId, personId) {
  await ensureAttendanceTables();
  const [rows] = await pool.execute(
    `SELECT type, recorded_at FROM attendance_records
     WHERE store_id = ? AND person_id = ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [storeId, personId]
  );
  return rows[0] || null;
}

// ─── Attendance Sales & Commissions ─────────────────────────────────────────

let _salesReady = false;
async function ensureSalesTables() {
  if (_salesReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_sales (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      date DATE NOT NULL,
      shift ENUM('AM','PM','PART_TIME') NOT NULL,
      gross_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
      net_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
      transactions INT NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_store_date_shift (store_id, date, shift),
      INDEX idx_as_store (store_id),
      INDEX idx_as_date (date),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS attendance_sales_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL UNIQUE,
      commission_rate DECIMAL(5,2) NOT NULL DEFAULT 1.00,
      daily_bonus DECIMAL(10,2) NOT NULL DEFAULT 10.00,
      success_bonus DECIMAL(10,2) NOT NULL DEFAULT 10.00,
      commission_threshold DECIMAL(12,2) NOT NULL DEFAULT 0,
      am_start TIME NOT NULL DEFAULT '08:00:00',
      am_end TIME NOT NULL DEFAULT '14:00:00',
      pm_start TIME NOT NULL DEFAULT '14:00:00',
      pm_end TIME NOT NULL DEFAULT '22:00:00',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  _salesReady = true;
}

export async function getSalesConfig(storeId) {
  await ensureSalesTables();
  const [rows] = await pool.execute(
    'SELECT * FROM attendance_sales_config WHERE store_id = ?', [storeId]
  );
  if (rows[0]) return rows[0];
  return {
    commission_rate: 1.00,
    daily_bonus: 10.00,
    success_bonus: 10.00,
    commission_threshold: 0,
    am_start: '08:00:00',
    am_end: '14:00:00',
    pm_start: '14:00:00',
    pm_end: '22:00:00',
  };
}

export async function upsertSalesConfig(storeId, config) {
  await ensureSalesTables();
  const { commission_rate, daily_bonus, success_bonus, commission_threshold, am_start, am_end, pm_start, pm_end } = config;
  await pool.execute(`
    INSERT INTO attendance_sales_config
      (store_id, commission_rate, daily_bonus, success_bonus, commission_threshold, am_start, am_end, pm_start, pm_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      commission_rate = VALUES(commission_rate),
      daily_bonus = VALUES(daily_bonus),
      success_bonus = VALUES(success_bonus),
      commission_threshold = VALUES(commission_threshold),
      am_start = VALUES(am_start),
      am_end = VALUES(am_end),
      pm_start = VALUES(pm_start),
      pm_end = VALUES(pm_end),
      updated_at = CURRENT_TIMESTAMP
  `, [storeId, commission_rate, daily_bonus, success_bonus, commission_threshold, am_start, am_end, pm_start, pm_end]);
}

export async function getSalesForMonth(storeId, year, month) {
  await ensureSalesTables();
  const [rows] = await pool.execute(
    `SELECT * FROM attendance_sales
     WHERE store_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
     ORDER BY date ASC, shift ASC`,
    [storeId, year, month]
  );
  return rows;
}

export async function upsertSaleRecord(storeId, date, shift, grossSales, netSales, transactions, notes) {
  await ensureSalesTables();
  await pool.execute(`
    INSERT INTO attendance_sales (store_id, date, shift, gross_sales, net_sales, transactions, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      gross_sales = VALUES(gross_sales),
      net_sales = VALUES(net_sales),
      transactions = VALUES(transactions),
      notes = VALUES(notes),
      updated_at = CURRENT_TIMESTAMP
  `, [storeId, date, shift, grossSales, netSales, transactions, notes || null]);
}

export async function deleteSaleRecord(storeId, date, shift) {
  await ensureSalesTables();
  await pool.execute(
    'DELETE FROM attendance_sales WHERE store_id = ? AND date = ? AND shift = ?',
    [storeId, date, shift]
  );
}

export async function getSalesFromOrders(storeId, year, month, amStart, amEnd, pmStart, pmEnd) {
  const [rows] = await pool.execute(
    `SELECT
       DATE(created_at) as date,
       CASE
         WHEN TIME(created_at) >= ? AND TIME(created_at) < ? THEN 'AM'
         WHEN TIME(created_at) >= ? AND TIME(created_at) < ? THEN 'PM'
         ELSE 'PART_TIME'
       END as shift,
       SUM(CASE WHEN subtotal > 0 THEN subtotal ELSE total END) as gross_sales,
       SUM(total) as net_sales,
       COUNT(*) as transactions
     FROM orders
     WHERE store_id = ?
       AND YEAR(created_at) = ?
       AND MONTH(created_at) = ?
       AND status NOT IN ('cancelled','rejected','pending')
     GROUP BY DATE(created_at), shift
     ORDER BY date ASC, shift ASC`,
    [amStart, amEnd, pmStart, pmEnd, storeId, year, month]
  );
  return rows;
}

// ─── Delivery System ──────────────────────────────────────────────────────────

async function ensureDeliveryTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS delivery_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL UNIQUE,
      address TEXT,
      lat DECIMAL(10,7),
      lng DECIMAL(10,7),
      radius_km DECIMAL(5,2) DEFAULT 5,
      fee DECIMAL(10,2) DEFAULT 0,
      min_order DECIMAL(10,2) DEFAULT 0,
      hours_source ENUM('cash_register','custom') DEFAULT 'cash_register',
      open_time VARCHAR(5) DEFAULT '09:00',
      close_time VARCHAR(5) DEFAULT '22:00',
      estimated_minutes INT DEFAULT 45,
      payment_cash BOOLEAN NOT NULL DEFAULT TRUE,
      payment_card BOOLEAN NOT NULL DEFAULT FALSE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS delivery_customers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100),
      email VARCHAR(100) NOT NULL UNIQUE,
      phone VARCHAR(20),
      email_verified BOOLEAN DEFAULT FALSE,
      verification_code VARCHAR(6),
      verification_expires DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS delivery_sessions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      customer_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES delivery_customers(id) ON DELETE CASCADE
    )
  `);
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM orders');
    const names = cols.map(c => c.Field);
    if (!names.includes('delivery_address')) await pool.execute("ALTER TABLE orders ADD COLUMN delivery_address TEXT DEFAULT NULL");
    if (!names.includes('delivery_status')) await pool.execute("ALTER TABLE orders ADD COLUMN delivery_status VARCHAR(20) DEFAULT NULL");
    if (!names.includes('delivery_customer_id')) await pool.execute("ALTER TABLE orders ADD COLUMN delivery_customer_id INT DEFAULT NULL");
    if (!names.includes('customer_email')) await pool.execute("ALTER TABLE orders ADD COLUMN customer_email VARCHAR(100) DEFAULT NULL");
    if (!names.includes('customer_name')) await pool.execute("ALTER TABLE orders ADD COLUMN customer_name VARCHAR(150) DEFAULT NULL");
  } catch {}
  try {
    const [dsCols] = await pool.execute('SHOW COLUMNS FROM delivery_settings');
    const dsNames = dsCols.map(c => c.Field);
    if (!dsNames.includes('payment_cash')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN payment_cash BOOLEAN NOT NULL DEFAULT TRUE");
    if (!dsNames.includes('payment_card')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN payment_card BOOLEAN NOT NULL DEFAULT FALSE");
    if (!dsNames.includes('payment_mp')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN payment_mp BOOLEAN NOT NULL DEFAULT FALSE");
    if (!dsNames.includes('fee_type')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN fee_type VARCHAR(10) DEFAULT 'fixed'");
    if (!dsNames.includes('fee_per_km')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN fee_per_km DECIMAL(10,2) DEFAULT 0");
    if (!dsNames.includes('free_km')) await pool.execute("ALTER TABLE delivery_settings ADD COLUMN free_km DECIMAL(5,2) DEFAULT 0");
  } catch {}
  try {
    const [dcCols] = await pool.execute('SHOW COLUMNS FROM delivery_customers');
    const dcNames = dcCols.map(c => c.Field);
    if (!dcNames.includes('password_hash')) await pool.execute("ALTER TABLE delivery_customers ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL");
  } catch {}
  try {
    const [oCols] = await pool.execute('SHOW COLUMNS FROM orders');
    const oNames = oCols.map(c => c.Field);
    if (!oNames.includes('delivery_fee')) await pool.execute("ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0");
    if (!oNames.includes('customer_phone')) await pool.execute("ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(30) DEFAULT NULL");
  } catch {}
}

export async function getDeliverySettings(storeId) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute('SELECT * FROM delivery_settings WHERE store_id = ? LIMIT 1', [storeId]);
  return rows[0] || null;
}

export async function upsertDeliverySettings(storeId, data) {
  await ensureDeliveryTables();
  const { address, lat, lng, radius_km, fee, min_order, hours_source, open_time, close_time, estimated_minutes, payment_cash, payment_card, payment_mp, fee_type, fee_per_km, free_km } = data;
  const pCash = payment_cash === false ? 0 : 1;
  const pCard = payment_card === true ? 1 : 0;
  const pMp = payment_mp === true ? 1 : 0;
  await pool.execute(`
    INSERT INTO delivery_settings (store_id, address, lat, lng, radius_km, fee, min_order, hours_source, open_time, close_time, estimated_minutes, payment_cash, payment_card, payment_mp, fee_type, fee_per_km, free_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      address = VALUES(address), lat = VALUES(lat), lng = VALUES(lng),
      radius_km = VALUES(radius_km), fee = VALUES(fee), min_order = VALUES(min_order),
      hours_source = VALUES(hours_source), open_time = VALUES(open_time),
      close_time = VALUES(close_time), estimated_minutes = VALUES(estimated_minutes),
      payment_cash = VALUES(payment_cash), payment_card = VALUES(payment_card),
      payment_mp = VALUES(payment_mp),
      fee_type = VALUES(fee_type), fee_per_km = VALUES(fee_per_km), free_km = VALUES(free_km)
  `, [storeId, address || null, lat || null, lng || null, radius_km || 5, fee || 0, min_order || 0, hours_source || 'cash_register', open_time || '09:00', close_time || '22:00', estimated_minutes || 45, pCash, pCard, pMp, fee_type || 'fixed', fee_per_km || 0, free_km || 0]);
  return getDeliverySettings(storeId);
}

export async function getNearbyDeliveryStores(lat, lng, radiusKm = 30) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(`
    SELECT s.id, s.code, s.name, s.logo_url AS logo,
      ds.address, ds.lat, ds.lng, ds.radius_km, ds.fee, ds.min_order,
      ds.hours_source, ds.open_time, ds.close_time, ds.estimated_minutes,
      sc.delivery_enabled,
      (SELECT COUNT(*) FROM cash_registers cr WHERE cr.store_id = s.id AND cr.closed_at IS NULL) as has_open_register,
      (6371 * ACOS(
        COS(RADIANS(?)) * COS(RADIANS(ds.lat)) *
        COS(RADIANS(ds.lng) - RADIANS(?)) +
        SIN(RADIANS(?)) * SIN(RADIANS(ds.lat))
      )) AS distance_km
    FROM delivery_settings ds
    JOIN stores s ON s.id = ds.store_id
    LEFT JOIN store_configurations sc ON sc.store_id = s.id AND sc.is_default = TRUE
    WHERE ds.lat IS NOT NULL AND ds.lng IS NOT NULL
      AND sc.delivery_enabled = TRUE
    HAVING distance_km <= LEAST(ds.radius_km, ?)
    ORDER BY distance_km ASC
    LIMIT 50
  `, [lat, lng, lat, radiusKm]);
  return rows;
}

export async function findOrCreateDeliveryCustomer(email) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute('SELECT * FROM delivery_customers WHERE email = ? LIMIT 1', [email]);
  if (rows[0]) return { customer: rows[0], isNew: false };
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  const [res] = await pool.execute(
    'INSERT INTO delivery_customers (email, verification_code, verification_expires) VALUES (?, ?, ?)',
    [email, code, expires]
  );
  const [newRows] = await pool.execute('SELECT * FROM delivery_customers WHERE id = ? LIMIT 1', [res.insertId]);
  return { customer: newRows[0], isNew: true };
}

export async function registerDeliveryCustomer(email, password, name, phone) {
  await ensureDeliveryTables();
  const [exists] = await pool.execute('SELECT id FROM delivery_customers WHERE email = ? LIMIT 1', [email]);
  if (exists[0]) throw new Error('Este email ya tiene una cuenta. Inicia sesión.');
  const hash = await bcrypt.hash(password, 10);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  const [res] = await pool.execute(
    'INSERT INTO delivery_customers (email, password_hash, name, phone, verification_code, verification_expires, email_verified) VALUES (?, ?, ?, ?, ?, ?, FALSE)',
    [email, hash, name || null, phone || null, code, expires]
  );
  const [rows] = await pool.execute('SELECT * FROM delivery_customers WHERE id = ? LIMIT 1', [res.insertId]);
  return { customer: rows[0], code };
}

export async function loginDeliveryCustomer(email, password) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute('SELECT * FROM delivery_customers WHERE email = ? LIMIT 1', [email]);
  if (!rows[0]) return null;
  if (!rows[0].password_hash) return null; // email-code-only account
  const valid = await bcrypt.compare(password, rows[0].password_hash);
  return valid ? rows[0] : null;
}

export async function getCustomerOrders(customerId) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(
    `SELECT o.id, o.total, o.delivery_address, o.delivery_status, o.status, o.payment_method,
            o.created_at, o.store_id, o.delivery_fee, s.name AS store_name, s.logo_url AS store_logo
     FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE o.delivery_customer_id = ? AND o.source = 'delivery_app'
     ORDER BY o.created_at DESC LIMIT 30`,
    [customerId]
  );
  const orders = [];
  for (const row of rows) {
    const items = await getOrderItems(row.id);
    orders.push({ ...row, items });
  }
  return orders;
}

export async function updateDeliveryCustomerProfile(customerId, name, phone) {
  await pool.execute(
    'UPDATE delivery_customers SET name = ?, phone = ? WHERE id = ?',
    [name, phone || null, customerId]
  );
  const [rows] = await pool.execute('SELECT id, name, phone, email FROM delivery_customers WHERE id = ? LIMIT 1', [customerId]);
  return rows[0] || null;
}

export async function getDeliveryOrderForTracking(orderId, customerId) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(
    `SELECT o.id, o.total, o.delivery_address, o.delivery_status, o.status, o.payment_method,
            o.created_at, o.delivery_fee, s.name AS store_name, s.logo_url AS store_logo
     FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE o.id = ? AND o.delivery_customer_id = ?`,
    [orderId, customerId]
  );
  return rows[0] || null;
}

export async function setDeliveryCustomerCode(email) {
  await ensureDeliveryTables();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await pool.execute(
    'UPDATE delivery_customers SET verification_code = ?, verification_expires = ? WHERE email = ?',
    [code, expires, email]
  );
  return code;
}

export async function verifyDeliveryCustomerCode(email, code) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(
    'SELECT * FROM delivery_customers WHERE email = ? AND verification_code = ? AND verification_expires > NOW() LIMIT 1',
    [email, code]
  );
  return rows[0] || null;
}

export async function completeDeliveryCustomerProfile(customerId, name, phone) {
  await pool.execute(
    'UPDATE delivery_customers SET name = ?, phone = ?, email_verified = TRUE, verification_code = NULL WHERE id = ?',
    [name, phone, customerId]
  );
  const [rows] = await pool.execute('SELECT * FROM delivery_customers WHERE id = ? LIMIT 1', [customerId]);
  return rows[0];
}

export async function createDeliverySession(customerId) {
  await ensureDeliveryTables();
  const { randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  await pool.execute('INSERT INTO delivery_sessions (customer_id, token) VALUES (?, ?)', [customerId, token]);
  return token;
}

export async function getDeliveryCustomerByToken(token) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(`
    SELECT dc.* FROM delivery_customers dc
    JOIN delivery_sessions ds ON ds.customer_id = dc.id
    WHERE ds.token = ? LIMIT 1
  `, [token]);
  return rows[0] || null;
}

export async function getPendingDeliveryOrders(storeId) {
  await ensureDeliveryTables();
  const [rows] = await pool.execute(`
    SELECT o.*, dc.name as dc_name, dc.phone as dc_phone, dc.email as dc_email
    FROM orders o
    LEFT JOIN delivery_customers dc ON dc.id = o.delivery_customer_id
    WHERE o.store_id = ? AND o.source = 'delivery_app' AND (o.delivery_status = 'waiting' OR o.delivery_status IS NULL AND o.source = 'delivery_app')
    ORDER BY o.created_at ASC
  `, [storeId]);
  const result = [];
  for (const order of rows) {
    const [items] = await pool.execute(`
      SELECT oi.*, p.name as product_name FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [order.id]);
    result.push({ ...order, items });
  }
  return result;
}

export async function updateDeliveryOrderStatus(orderId, storeId, status) {
  await pool.execute(
    'UPDATE orders SET delivery_status = ? WHERE id = ? AND store_id = ?',
    [status, orderId, storeId]
  );
  if (status === 'accepted' || status === 'preparing') {
    await pool.execute('UPDATE orders SET status = ? WHERE id = ? AND store_id = ?', ['pending', orderId, storeId]);
  }
  if (status === 'delivered') {
    await pool.execute('UPDATE orders SET status = ? WHERE id = ? AND store_id = ?', ['completed', orderId, storeId]);
  }
  // Return order with customer email and store name for notifications
  const [rows] = await pool.execute(
    `SELECT o.*, dc.email AS dc_email, dc.name AS dc_name,
            s.name AS store_name
     FROM orders o
     LEFT JOIN delivery_customers dc ON dc.id = o.delivery_customer_id
     LEFT JOIN stores s ON s.id = o.store_id
     WHERE o.id = ? LIMIT 1`,
    [orderId]
  );
  return rows[0] || null;
}

// Restaurant Tables
export async function getRestaurantTables(storeId) {
  const [rows] = await pool.execute(
    'SELECT * FROM restaurant_tables WHERE store_id = ? ORDER BY sort_order ASC, id ASC',
    [storeId]
  );
  return rows;
}

export async function getRestaurantTablesWithStatus(storeId) {
  const [rows] = await pool.execute(`
    SELECT t.*,
      (SELECT COUNT(*) FROM orders o
       WHERE o.store_id = ? AND o.table_number = t.id AND o.status NOT IN ('completed', 'cancelled')) > 0 AS occupied
    FROM restaurant_tables t
    WHERE t.store_id = ?
    ORDER BY t.sort_order ASC, t.id ASC
  `, [storeId, storeId]);
  return rows;
}

export async function createRestaurantTable(storeId, data) {
  const { label, capacity, x, y, w, h, shape, sort_order, section } = data;
  const [result] = await pool.execute(
    'INSERT INTO restaurant_tables (store_id, label, capacity, x, y, w, h, shape, sort_order, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [storeId, label || 'Mesa', capacity || 4, x || 50, y || 50, w || 120, h || 80, shape || 'rect', sort_order || 0, section || 'Primer Piso']
  );
  const [rows] = await pool.execute('SELECT * FROM restaurant_tables WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function updateRestaurantTable(id, storeId, data) {
  const { label, capacity, x, y, w, h, shape, sort_order, section } = data;
  await pool.execute(
    'UPDATE restaurant_tables SET label = ?, capacity = ?, x = ?, y = ?, w = ?, h = ?, shape = ?, sort_order = ?, section = ? WHERE id = ? AND store_id = ?',
    [label, capacity, x, y, w, h, shape, sort_order ?? 0, section || 'Primer Piso', id, storeId]
  );
  const [rows] = await pool.execute('SELECT * FROM restaurant_tables WHERE id = ? AND store_id = ?', [id, storeId]);
  return rows[0] || null;
}

export async function deleteRestaurantTable(id, storeId) {
  await pool.execute('DELETE FROM restaurant_tables WHERE id = ? AND store_id = ?', [id, storeId]);
}

// ─── Store Subdomain ──────────────────────────────────────────────────────────

async function ensureSubdomainColumn() {
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM stores');
    if (!cols.map(c => c.Field).includes('subdomain')) {
      await pool.execute('ALTER TABLE stores ADD COLUMN subdomain VARCHAR(100) UNIQUE DEFAULT NULL');
      console.log('✅ Columna subdomain agregada a stores');
    }
  } catch (e) { console.warn('[subdomain migration]', e.message); }
}

export async function getStoreBySubdomain(subdomain) {
  await ensureSubdomainColumn();
  const [rows] = await pool.execute(
    'SELECT id, code, name, logo_url FROM stores WHERE subdomain = ? LIMIT 1',
    [subdomain.toLowerCase()]
  );
  return rows[0] || null;
}

export async function setStoreSubdomain(storeId, subdomain) {
  await ensureSubdomainColumn();
  const clean = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const [conflict] = await pool.execute(
    'SELECT id FROM stores WHERE subdomain = ? AND id != ?',
    [clean, storeId]
  );
  if (conflict[0]) throw new Error('Ese subdominio ya está en uso por otra tienda');
  await pool.execute('UPDATE stores SET subdomain = ? WHERE id = ?', [clean, storeId]);
  return clean;
}

export async function clearStoreSubdomain(storeId) {
  await ensureSubdomainColumn();
  await pool.execute('UPDATE stores SET subdomain = NULL WHERE id = ?', [storeId]);
}

export async function getStoreSubdomain(storeId) {
  await ensureSubdomainColumn();
  const [rows] = await pool.execute('SELECT subdomain FROM stores WHERE id = ? LIMIT 1', [storeId]);
  return rows[0]?.subdomain || null;
}

// ─── Admin Roles & Sub-accounts ──────────────────────────────────────────────

async function ensureRolesTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      owner_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      permissions JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_sub_accounts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      owner_id INT NOT NULL,
      role_id INT DEFAULT NULL,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      plain_password VARCHAR(255) DEFAULT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE SET NULL
    )
  `);
  try {
    await pool.execute('ALTER TABLE admin_sub_accounts ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL');
  } catch (_) {}
}

const DEFAULT_FULL_PERMS = {
  dashboard: { view: true }, orders: { view: true, edit: true, delete: true },
  tables: { view: true, edit: true }, delivery: { view: true, edit: true },
  products: { view: true, edit: true, delete: true }, categories: { view: true, edit: true, delete: true },
  analytics: { view: true }, cash_registers: { view: true, edit: true }, ratings: { view: true },
  people_counter: { view: true, edit: true }, ventas_mes: { view: true, edit: true },
  workers: { view: true, edit: true, delete: true }, tasks: { view: true, edit: true, delete: true },
  inventory: { view: true, edit: true }, procedures: { view: true, edit: true, delete: true },
  attendance: { view: true }, coupons: { view: true, edit: true, delete: true },
  whatsapp: { view: true, edit: true }, canales: { view: true, edit: true },
  configurations: { view: true, edit: true }, settings: { view: true, edit: true },
};
const DEFAULT_CAJERO_PERMS = {
  dashboard: { view: true }, orders: { view: true, edit: true, delete: false },
  tables: { view: true, edit: true }, delivery: { view: true, edit: true },
  products: { view: true, edit: false, delete: false }, categories: { view: true, edit: false, delete: false },
  analytics: { view: true }, cash_registers: { view: true, edit: true }, ratings: { view: true },
  people_counter: { view: true, edit: false }, ventas_mes: { view: true, edit: false },
  workers: { view: false, edit: false, delete: false }, tasks: { view: true, edit: true, delete: false },
  inventory: { view: true, edit: true }, procedures: { view: true, edit: false, delete: false },
  attendance: { view: true }, coupons: { view: true, edit: false, delete: false },
  whatsapp: { view: true, edit: true }, canales: { view: false, edit: false },
  configurations: { view: false, edit: false }, settings: { view: false, edit: false },
};
const DEFAULT_VENDEDOR_PERMS = {
  dashboard: { view: true }, orders: { view: true, edit: true, delete: false },
  tables: { view: true, edit: true }, delivery: { view: true, edit: false },
  products: { view: true, edit: false, delete: false }, categories: { view: true, edit: false, delete: false },
  analytics: { view: false }, cash_registers: { view: true, edit: true }, ratings: { view: false },
  people_counter: { view: false, edit: false }, ventas_mes: { view: false, edit: false },
  workers: { view: false, edit: false, delete: false }, tasks: { view: true, edit: false, delete: false },
  inventory: { view: false, edit: false }, procedures: { view: true, edit: false, delete: false },
  attendance: { view: false }, coupons: { view: false, edit: false, delete: false },
  whatsapp: { view: false, edit: false }, canales: { view: false, edit: false },
  configurations: { view: false, edit: false }, settings: { view: false, edit: false },
};

export async function ensureDefaultRolesAndAccounts(ownerId) {
  await ensureRolesTables();
  const [existing] = await pool.execute('SELECT id FROM admin_roles WHERE owner_id = ?', [ownerId]);
  if (existing.length > 0) return;

  const roleData = [
    { name: 'Administrador', description: 'Acceso completo a todas las secciones', permissions: DEFAULT_FULL_PERMS },
    { name: 'Cajero', description: 'Gestión de pedidos, caja y atención', permissions: DEFAULT_CAJERO_PERMS },
    { name: 'Vendedor', description: 'Acceso básico a pedidos y mesas', permissions: DEFAULT_VENDEDOR_PERMS },
  ];
  const roleIds = {};
  for (const r of roleData) {
    const [res] = await pool.execute(
      'INSERT INTO admin_roles (owner_id, name, description, permissions) VALUES (?, ?, ?, ?)',
      [ownerId, r.name, r.description, JSON.stringify(r.permissions)]
    );
    roleIds[r.name] = res.insertId;
  }

  const defaultAccounts = [
    { name: 'Admin', email: `admin.${ownerId}@srservi.local`, pass: 'Admin123', role: 'Administrador' },
    { name: 'Cajero', email: `cajero.${ownerId}@srservi.local`, pass: 'Cajero123', role: 'Cajero' },
  ];
  for (const a of defaultAccounts) {
    const [exists] = await pool.execute('SELECT id FROM admin_sub_accounts WHERE email = ?', [a.email]);
    if (exists[0]) continue;
    const hash = await bcrypt.hash(a.pass, 10);
    await pool.execute(
      'INSERT INTO admin_sub_accounts (owner_id, role_id, name, email, password_hash, plain_password, is_active) VALUES (?, ?, ?, ?, ?, ?, true)',
      [ownerId, roleIds[a.role], a.name, a.email, hash, a.pass]
    );
  }
}

export async function getRoles(ownerId) {
  await ensureRolesTables();
  const [rows] = await pool.execute(
    `SELECT r.*, (SELECT COUNT(*) FROM admin_sub_accounts a WHERE a.role_id = r.id) AS accounts_count
     FROM admin_roles r WHERE r.owner_id = ? ORDER BY r.created_at ASC`,
    [ownerId]
  );
  return rows.map(r => ({ ...r, permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions }));
}

export async function getRoleById(id, ownerId) {
  await ensureRolesTables();
  const [rows] = await pool.execute('SELECT * FROM admin_roles WHERE id = ? AND owner_id = ?', [id, ownerId]);
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...r, permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions };
}

export async function createRole(ownerId, { name, description, permissions }) {
  await ensureRolesTables();
  const perms = JSON.stringify(permissions || {});
  const [res] = await pool.execute(
    'INSERT INTO admin_roles (owner_id, name, description, permissions) VALUES (?, ?, ?, ?)',
    [ownerId, name.trim(), (description || '').trim(), perms]
  );
  return getRoleById(res.insertId, ownerId);
}

export async function updateRole(id, ownerId, { name, description, permissions }) {
  await ensureRolesTables();
  const perms = JSON.stringify(permissions || {});
  await pool.execute(
    'UPDATE admin_roles SET name = ?, description = ?, permissions = ? WHERE id = ? AND owner_id = ?',
    [name.trim(), (description || '').trim(), perms, id, ownerId]
  );
  return getRoleById(id, ownerId);
}

export async function deleteRole(id, ownerId) {
  await ensureRolesTables();
  // Check if any accounts use this role
  const [accounts] = await pool.execute('SELECT COUNT(*) AS cnt FROM admin_sub_accounts WHERE role_id = ?', [id]);
  if (accounts[0].cnt > 0) throw new Error('No se puede eliminar: hay cuentas usando este rol');
  await pool.execute('DELETE FROM admin_roles WHERE id = ? AND owner_id = ?', [id, ownerId]);
}

export async function getSubAccounts(ownerId) {
  await ensureRolesTables();
  const [rows] = await pool.execute(
    `SELECT a.id, a.owner_id, a.role_id, a.name, a.email, a.plain_password, a.is_active, a.created_at,
            r.name AS role_name, r.permissions AS role_permissions
     FROM admin_sub_accounts a
     LEFT JOIN admin_roles r ON r.id = a.role_id
     WHERE a.owner_id = ? ORDER BY a.created_at ASC`,
    [ownerId]
  );
  return rows.map(r => ({
    ...r,
    role_permissions: r.role_permissions
      ? (typeof r.role_permissions === 'string' ? JSON.parse(r.role_permissions) : r.role_permissions)
      : {}
  }));
}

export async function createSubAccount(ownerId, { name, email, password, role_id }) {
  await ensureRolesTables();
  const [conflict] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (conflict[0]) throw new Error('Ese email ya está registrado como cuenta principal');
  const [conflict2] = await pool.execute('SELECT id FROM admin_sub_accounts WHERE email = ?', [email.toLowerCase()]);
  if (conflict2[0]) throw new Error('Ese email ya está en uso');
  const hash = await bcrypt.hash(password, 10);
  const [res] = await pool.execute(
    'INSERT INTO admin_sub_accounts (owner_id, role_id, name, email, password_hash, plain_password) VALUES (?, ?, ?, ?, ?, ?)',
    [ownerId, role_id || null, name.trim(), email.toLowerCase().trim(), hash, password]
  );
  const [rows] = await pool.execute('SELECT id, owner_id, role_id, name, email, plain_password, is_active, created_at FROM admin_sub_accounts WHERE id = ?', [res.insertId]);
  return rows[0];
}

export async function updateSubAccount(id, ownerId, { name, email, role_id, is_active, password }) {
  await ensureRolesTables();
  if (email) {
    const [conflict] = await pool.execute('SELECT id FROM admin_sub_accounts WHERE email = ? AND id != ?', [email.toLowerCase(), id]);
    if (conflict[0]) throw new Error('Ese email ya está en uso');
  }
  let query = 'UPDATE admin_sub_accounts SET name = ?, role_id = ?, is_active = ?';
  const params = [name.trim(), role_id || null, is_active ? 1 : 0];
  if (email) { query += ', email = ?'; params.push(email.toLowerCase().trim()); }
  if (password) { query += ', password_hash = ?, plain_password = ?'; params.push(await bcrypt.hash(password, 10), password); }
  query += ' WHERE id = ? AND owner_id = ?';
  params.push(id, ownerId);
  await pool.execute(query, params);
  const [rows] = await pool.execute('SELECT id, owner_id, role_id, name, email, plain_password, is_active, created_at FROM admin_sub_accounts WHERE id = ?', [id]);
  return rows[0];
}

export async function deleteSubAccount(id, ownerId) {
  await ensureRolesTables();
  await pool.execute('DELETE FROM admin_sub_accounts WHERE id = ? AND owner_id = ?', [id, ownerId]);
}

export async function authenticateSubAccount(email, password) {
  await ensureRolesTables();
  const [rows] = await pool.execute(
    `SELECT a.*, r.permissions AS role_permissions
     FROM admin_sub_accounts a
     LEFT JOIN admin_roles r ON r.id = a.role_id
     WHERE a.email = ? LIMIT 1`,
    [email.toLowerCase()]
  );
  if (!rows[0]) return null;
  const account = rows[0];
  if (!account.is_active) throw new Error('Cuenta desactivada');
  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) return null;
  return {
    ...account,
    role_permissions: account.role_permissions
      ? (typeof account.role_permissions === 'string' ? JSON.parse(account.role_permissions) : account.role_permissions)
      : {}
  };
}

// ─── People Counter ──────────────────────────────────────────────────────────

let _peopleCounterReady = false;

async function addColumnIfMissing(table, column, definition) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows[0].cnt) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[DB] Columna añadida: ${table}.${column}`);
  }
}

async function ensurePeopleCounterTables() {
  if (_peopleCounterReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS people_counter_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      direction ENUM('in','out') NOT NULL DEFAULT 'in',
      crossed_at DATETIME NOT NULL,
      INDEX idx_store_date (store_id, crossed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS people_counter_config (
      store_id INT PRIMARY KEY,
      line_config JSON NOT NULL,
      flip_direction TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migración compatible con MySQL 5.x: verificar en information_schema
  await addColumnIfMissing('people_counter_config', 'rtsp_url',         'VARCHAR(500) DEFAULT NULL');
  await addColumnIfMissing('people_counter_config', 'rtsp_enabled',     'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('people_counter_config', 'rtsp_sensitivity', 'INT NOT NULL DEFAULT 30');
  _peopleCounterReady = true;
}

export async function getPeopleCounterConfig(storeId) {
  await ensurePeopleCounterTables();
  const [rows] = await pool.execute('SELECT * FROM people_counter_config WHERE store_id = ?', [storeId]);
  if (!rows[0]) return null;
  const line = typeof rows[0].line_config === 'string' ? JSON.parse(rows[0].line_config) : rows[0].line_config;
  return { line, flip: !!rows[0].flip_direction };
}

export async function savePeopleCounterConfig(storeId, line, flip) {
  await ensurePeopleCounterTables();
  await pool.execute(
    `INSERT INTO people_counter_config (store_id, line_config, flip_direction)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE line_config = VALUES(line_config), flip_direction = VALUES(flip_direction)`,
    [storeId, JSON.stringify(line), flip ? 1 : 0]
  );
}

export async function savePeopleCounterRTSP(storeId, rtspUrl, enabled, sensitivity) {
  await ensurePeopleCounterTables();
  await pool.execute(
    `INSERT INTO people_counter_config (store_id, line_config, flip_direction, rtsp_url, rtsp_enabled, rtsp_sensitivity)
     VALUES (?, '{}', 0, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rtsp_url = VALUES(rtsp_url), rtsp_enabled = VALUES(rtsp_enabled), rtsp_sensitivity = VALUES(rtsp_sensitivity)`,
    [storeId, rtspUrl || null, enabled ? 1 : 0, sensitivity || 30]
  );
}

export async function getPeopleCounterRTSP(storeId) {
  await ensurePeopleCounterTables();
  const [rows] = await pool.execute(
    'SELECT rtsp_url, rtsp_enabled, rtsp_sensitivity FROM people_counter_config WHERE store_id = ?',
    [storeId]
  );
  if (!rows[0]) return { rtsp_url: null, rtsp_enabled: false, rtsp_sensitivity: 30 };
  return { rtsp_url: rows[0].rtsp_url || null, rtsp_enabled: !!rows[0].rtsp_enabled, rtsp_sensitivity: rows[0].rtsp_sensitivity || 30 };
}

export async function getStoresWithRTSP() {
  await ensurePeopleCounterTables();
  const [rows] = await pool.execute(
    `SELECT store_id, rtsp_url, rtsp_enabled, rtsp_sensitivity, line_config, flip_direction
     FROM people_counter_config WHERE rtsp_enabled = 1 AND rtsp_url IS NOT NULL`
  );
  return rows;
}

export async function savePeopleCounterEvent(storeId, direction, crossedAt) {
  await ensurePeopleCounterTables();
  await pool.execute(
    'INSERT INTO people_counter_events (store_id, direction, crossed_at) VALUES (?, ?, ?)',
    [storeId, direction, new Date(crossedAt)]
  );
}

// Offset horario usado para convertir la fecha "local" del usuario (la que
// ve en el navegador, ej. "2026-06-13") al rango de `crossed_at` que hay que
// consultar. Chile continental: UTC-4 (invierno) / UTC-3 (verano).
// `crossed_at` se guarda con `new Date(crossedAt)` (mysql2 lo convierte usando
// la zona horaria de la conexión, por defecto la del SISTEMA donde corre node,
// no necesariamente UTC). Antes se comparaba con `DATE(crossed_at) = ?`
// (la fecha LOCAL del usuario), lo cual rompe el conteo si el servidor está
// en UTC: un evento a las 22:00 en Chile se guarda como ~02:00 del día
// siguiente en UTC, y `DATE(crossed_at)` da el día siguiente → 0 resultados
// para "hoy". Para corregirlo sin asumir la TZ del servidor, calculamos en
// tiempo de ejecución la diferencia entre el reloj del servidor (NOW()) y
// UTC (UTC_TIMESTAMP()), y la usamos junto con el offset de Chile para
// construir el rango correcto de `crossed_at` que corresponde al día local
// solicitado.
const CHILE_TZ_OFFSET_HOURS = parseInt(process.env.PEOPLE_COUNTER_TZ_OFFSET || '-4', 10);

let _serverUtcOffsetMsCache = null;
async function getServerUtcOffsetMs() {
  if (_serverUtcOffsetMsCache !== null) return _serverUtcOffsetMsCache;
  const [[row]] = await pool.execute('SELECT NOW() AS srv, UTC_TIMESTAMP() AS utc');
  // Diferencia entre el reloj del servidor (lo que mysql2 guarda en `crossed_at`)
  // y UTC, en milisegundos. Si el servidor ya está en UTC esto será ~0.
  _serverUtcOffsetMsCache = new Date(row.srv).getTime() - new Date(row.utc).getTime();
  return _serverUtcOffsetMsCache;
}

export async function getPeopleCounterStats(storeId, date) {
  await ensurePeopleCounterTables();
  const chileOffsetMs = CHILE_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const serverOffsetMs = await getServerUtcOffsetMs();

  // Inicio/fin del día local (Chile) solicitado, expresados en UTC.
  const startUTC = new Date(new Date(`${date}T00:00:00Z`).getTime() - chileOffsetMs);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  // Convertir ese rango UTC al "reloj del servidor" para comparar contra
  // `crossed_at` (que está almacenado en hora del servidor).
  const startServer = new Date(startUTC.getTime() + serverOffsetMs);
  const endServer = new Date(endUTC.getTime() + serverOffsetMs);

  // Para agrupar por hora local (Chile), convertimos crossed_at de vuelta a UTC
  // y luego le sumamos el offset de Chile.
  const hourShiftMs = chileOffsetMs - serverOffsetMs;
  const hourShiftSeconds = Math.round(hourShiftMs / 1000);

  const [rows] = await pool.execute(
    `SELECT HOUR(DATE_ADD(crossed_at, INTERVAL ? SECOND)) AS hour, direction, COUNT(*) AS cnt
     FROM people_counter_events
     WHERE store_id = ? AND crossed_at >= ? AND crossed_at < ?
     GROUP BY hour, direction ORDER BY hour`,
    [hourShiftSeconds, storeId, startServer, endServer]
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.hour]) map[r.hour] = { hour: r.hour, in: 0, out: 0 };
    map[r.hour][r.direction] = Number(r.cnt);
  }
  const hourly = Object.values(map).sort((a, b) => a.hour - b.hour);
  const total = hourly.reduce((acc, h) => ({ in: acc.in + h.in, out: acc.out + h.out }), { in: 0, out: 0 });
  return { date, total, hourly };
}

// ─── Loyalty System ───────────────────────────────────────────────────────────

let _loyaltyReady = false;
async function ensureLoyaltyTables() {
  if (_loyaltyReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS loyalty_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL UNIQUE,
      enabled BOOLEAN DEFAULT FALSE,
      discount_percentage DECIMAL(5,2) DEFAULT 10.00,
      required_purchases INT DEFAULT 5,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_loyconf_store (store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS loyal_customers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      face_descriptor JSON NOT NULL,
      face_photo MEDIUMTEXT,
      purchase_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_loyal_store (store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )
  `);
  _loyaltyReady = true;
}

export async function getLoyaltyConfig(storeId) {
  await ensureLoyaltyTables();
  const [rows] = await pool.execute(
    'SELECT * FROM loyalty_config WHERE store_id = ?',
    [storeId]
  );
  if (rows[0]) return rows[0];
  return { store_id: storeId, enabled: false, discount_percentage: 10.00, required_purchases: 5 };
}

export async function saveLoyaltyConfig(storeId, enabled, discountPercentage, requiredPurchases) {
  await ensureLoyaltyTables();
  await pool.execute(`
    INSERT INTO loyalty_config (store_id, enabled, discount_percentage, required_purchases)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled),
      discount_percentage = VALUES(discount_percentage),
      required_purchases = VALUES(required_purchases)
  `, [storeId, enabled ? 1 : 0, discountPercentage, requiredPurchases]);
}

export async function getLoyalCustomers(storeId) {
  await ensureLoyaltyTables();
  const [rows] = await pool.execute(
    'SELECT id, name, phone, face_descriptor, face_photo, purchase_count, created_at FROM loyal_customers WHERE store_id = ? ORDER BY name ASC',
    [storeId]
  );
  return rows.map(r => ({
    ...r,
    face_descriptor: typeof r.face_descriptor === 'string' ? JSON.parse(r.face_descriptor) : r.face_descriptor
  }));
}

export async function createLoyalCustomer(storeId, name, phone, faceDescriptor, facePhoto) {
  await ensureLoyaltyTables();
  const [result] = await pool.execute(
    'INSERT INTO loyal_customers (store_id, name, phone, face_descriptor, face_photo) VALUES (?, ?, ?, ?, ?)',
    [storeId, name, phone || null, JSON.stringify(faceDescriptor), facePhoto || null]
  );
  return result.insertId;
}

export async function incrementLoyalCustomerPurchases(customerId) {
  await pool.execute(
    'UPDATE loyal_customers SET purchase_count = purchase_count + 1 WHERE id = ?',
    [customerId]
  );
}

export async function deleteLoyalCustomer(id, storeId) {
  await pool.execute(
    'DELETE FROM loyal_customers WHERE id = ? AND store_id = ?',
    [id, storeId]
  );
}

// ─── INVENTORY MOVEMENTS & ALERTS ─────────────────────────────────────────────

let _inventoryTablesReady = false;
async function ensureInventoryTables() {
  if (_inventoryTablesReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      item_type ENUM('product','ingredient','extra','raw_material') NOT NULL,
      item_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      previous_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
      new_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
      change_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
      reason ENUM('order','manual','restock','recipe','adjustment') NOT NULL DEFAULT 'manual',
      reference_id INT,
      user_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_im_store_date (store_id, created_at),
      INDEX idx_im_item (item_type, item_id)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS stock_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      item_type ENUM('product','ingredient','extra','raw_material') NOT NULL,
      item_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
      threshold DECIMAL(10,3) NOT NULL DEFAULT 0,
      alert_type ENUM('low_stock','out_of_stock') NOT NULL,
      status ENUM('active','acknowledged') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sa_store_status (store_id, status)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(7) DEFAULT '#D4AF37',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_is_store (store_id)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_section_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section_id INT NOT NULL,
      item_type ENUM('product','ingredient','extra','raw_material') NOT NULL,
      item_id INT NOT NULL,
      UNIQUE KEY uq_section_item (section_id, item_type, item_id),
      INDEX idx_isi_section (section_id)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_store_id INT NOT NULL,
      to_store_id INT NOT NULL,
      user_id INT NOT NULL,
      status ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      INDEX idx_it_stores (from_store_id, to_store_id)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS inventory_transfer_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transfer_id INT NOT NULL,
      item_type ENUM('product','ingredient','extra','raw_material') NOT NULL,
      item_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,3) NOT NULL,
      INDEX idx_iti_transfer (transfer_id)
    )
  `);
  try {
    await pool.execute(`ALTER TABLE inventory_movements MODIFY COLUMN reason ENUM('order','manual','restock','recipe','adjustment','purchase','entry','exit','transfer') NOT NULL DEFAULT 'manual'`);
  } catch (e) { /* already altered */ }
  _inventoryTablesReady = true;
}

export async function logInventoryMovement({ storeId, itemType, itemId, itemName, previousQty, newQty, reason, referenceId, userName }) {
  await ensureInventoryTables();
  const change = parseFloat(newQty) - parseFloat(previousQty);
  await pool.execute(
    `INSERT INTO inventory_movements (store_id, item_type, item_id, item_name, previous_qty, new_qty, change_qty, reason, reference_id, user_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeId, itemType, itemId, itemName, previousQty, newQty, change, reason, referenceId || null, userName || null]
  );
}

export async function getInventoryMovements(storeId, { from, to, itemType, reason, page = 1, limit = 50 } = {}) {
  await ensureInventoryTables();
  let where = 'WHERE store_id = ?';
  const params = [storeId];
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }
  if (itemType) { where += ' AND item_type = ?'; params.push(itemType); }
  if (reason) { where += ' AND reason = ?'; params.push(reason); }

  const offset = (page - 1) * limit;
  const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM inventory_movements ${where}`, params);
  const total = countRows[0].total;

  const [rows] = await pool.execute(
    `SELECT * FROM inventory_movements ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    params
  );
  return { movements: rows, total, page, totalPages: Math.ceil(total / limit) };
}

export async function checkAndCreateStockAlerts(storeId) {
  await ensureInventoryTables();
  await pool.execute('DELETE FROM stock_alerts WHERE store_id = ? AND status = ?', [storeId, 'active']);

  // Raw materials
  const [rms] = await pool.execute(
    'SELECT id, name, quantity, min_quantity FROM raw_materials WHERE store_id = ?', [storeId]
  );
  for (const rm of rms) {
    const qty = parseFloat(rm.quantity) || 0;
    const min = parseFloat(rm.min_quantity) || 0;
    if (qty <= 0) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'raw_material', rm.id, rm.name, qty, min, 'out_of_stock']
      );
    } else if (min > 0 && qty <= min) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'raw_material', rm.id, rm.name, qty, min, 'low_stock']
      );
    }
  }

  // Products
  const [prods] = await pool.execute(
    `SELECT p.id, p.name, COALESCE(i.stock, 0) as stock, COALESCE(i.min_stock, 0) as min_stock, COALESCE(i.unlimited_stock, 0) as unlimited_stock
     FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.store_id = ?`, [storeId]
  );
  for (const p of prods) {
    if (p.unlimited_stock) continue;
    if (p.stock <= 0) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'product', p.id, p.name, p.stock, p.min_stock, 'out_of_stock']
      );
    } else if (p.min_stock > 0 && p.stock <= p.min_stock) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'product', p.id, p.name, p.stock, p.min_stock, 'low_stock']
      );
    }
  }

  // Ingredients
  const [ings] = await pool.execute(
    'SELECT id, name, stock, unlimited_stock FROM ingredients WHERE store_id = ?', [storeId]
  );
  for (const ing of ings) {
    if (ing.unlimited_stock) continue;
    const s = parseInt(ing.stock) || 0;
    if (s <= 0) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'ingredient', ing.id, ing.name, s, 0, 'out_of_stock']
      );
    } else if (s <= 5) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'ingredient', ing.id, ing.name, s, 5, 'low_stock']
      );
    }
  }

  // Extras
  const [exts] = await pool.execute(
    'SELECT id, name, stock, unlimited_stock FROM extras WHERE store_id = ?', [storeId]
  );
  for (const ext of exts) {
    if (ext.unlimited_stock) continue;
    const s = parseInt(ext.stock) || 0;
    if (s <= 0) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'extra', ext.id, ext.name, s, 0, 'out_of_stock']
      );
    } else if (s <= 5) {
      await pool.execute(
        'INSERT INTO stock_alerts (store_id, item_type, item_id, item_name, current_stock, threshold, alert_type) VALUES (?,?,?,?,?,?,?)',
        [storeId, 'extra', ext.id, ext.name, s, 5, 'low_stock']
      );
    }
  }
}

export async function getStockAlerts(storeId, status = 'active') {
  await ensureInventoryTables();
  const [rows] = await pool.execute(
    'SELECT * FROM stock_alerts WHERE store_id = ? AND status = ? ORDER BY alert_type ASC, created_at DESC',
    [storeId, status]
  );
  return rows;
}

export async function acknowledgeStockAlert(alertId) {
  await ensureInventoryTables();
  await pool.execute('UPDATE stock_alerts SET status = ? WHERE id = ?', ['acknowledged', alertId]);
}

export async function getInventoryStats(storeId) {
  await ensureInventoryTables();

  const [rmRows] = await pool.execute(
    'SELECT COUNT(*) as total, SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock, SUM(CASE WHEN min_quantity > 0 AND quantity > 0 AND quantity <= min_quantity THEN 1 ELSE 0 END) as low_stock, SUM(quantity * cost_per_unit) as total_value FROM raw_materials WHERE store_id = ?',
    [storeId]
  );

  const [prodRows] = await pool.execute(
    `SELECT COUNT(*) as total,
       SUM(CASE WHEN i.unlimited_stock = 0 AND COALESCE(i.stock, 0) <= 0 THEN 1 ELSE 0 END) as out_of_stock,
       SUM(CASE WHEN i.unlimited_stock = 0 AND i.min_stock > 0 AND i.stock > 0 AND i.stock <= i.min_stock THEN 1 ELSE 0 END) as low_stock
     FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.store_id = ?`,
    [storeId]
  );

  return {
    raw_materials: { ...rmRows[0], total_value: parseFloat(rmRows[0].total_value) || 0 },
    products: prodRows[0]
  };
}

export async function getConsumptionReport(storeId, from, to) {
  await ensureInventoryTables();
  let dateFilter = '';
  const params = [storeId];
  if (from) { dateFilter += ' AND created_at >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND created_at <= ?'; params.push(to + ' 23:59:59'); }

  const [rows] = await pool.execute(
    `SELECT item_name, item_type, SUM(ABS(change_qty)) as total_consumed, COUNT(*) as movement_count
     FROM inventory_movements
     WHERE store_id = ? AND change_qty < 0 ${dateFilter}
     GROUP BY item_id, item_type, item_name
     ORDER BY total_consumed DESC
     LIMIT 20`,
    params
  );
  return rows;
}

// ── Inventory Sections ──────────────────────────────────────────────────────

export async function getInventorySections(storeId) {
  await ensureInventoryTables();
  const [sections] = await pool.execute(
    'SELECT * FROM inventory_sections WHERE store_id = ? ORDER BY sort_order ASC, id ASC', [storeId]
  );
  if (sections.length === 0) return [];
  const sectionIds = sections.map(s => s.id);
  const ph = sectionIds.map(() => '?').join(',');
  const [items] = await pool.execute(
    `SELECT isi.*,
       CASE isi.item_type
         WHEN 'product' THEN (SELECT name FROM products WHERE id = isi.item_id)
         WHEN 'ingredient' THEN (SELECT name FROM ingredients WHERE id = isi.item_id)
         WHEN 'extra' THEN (SELECT name FROM extras WHERE id = isi.item_id)
         WHEN 'raw_material' THEN (SELECT name FROM raw_materials WHERE id = isi.item_id)
       END as item_name,
       CASE isi.item_type
         WHEN 'product' THEN (SELECT COALESCE(i.stock,0) FROM inventory i WHERE i.product_id = isi.item_id)
         WHEN 'ingredient' THEN (SELECT stock FROM ingredients WHERE id = isi.item_id)
         WHEN 'extra' THEN (SELECT stock FROM extras WHERE id = isi.item_id)
         WHEN 'raw_material' THEN (SELECT quantity FROM raw_materials WHERE id = isi.item_id)
       END as current_stock
     FROM inventory_section_items isi WHERE isi.section_id IN (${ph})`,
    sectionIds
  );
  return sections.map(s => ({
    ...s,
    items: items.filter(i => i.section_id === s.id).filter(i => i.item_name != null)
  }));
}

export async function createInventorySection(storeId, name, color) {
  await ensureInventoryTables();
  const [maxOrder] = await pool.execute('SELECT COALESCE(MAX(sort_order),0)+1 as next FROM inventory_sections WHERE store_id = ?', [storeId]);
  const [result] = await pool.execute(
    'INSERT INTO inventory_sections (store_id, name, color, sort_order) VALUES (?, ?, ?, ?)',
    [storeId, name, color || '#D4AF37', maxOrder[0].next]
  );
  return result.insertId;
}

export async function updateInventorySection(id, storeId, name, color) {
  await ensureInventoryTables();
  await pool.execute('UPDATE inventory_sections SET name = ?, color = ? WHERE id = ? AND store_id = ?', [name, color, id, storeId]);
}

export async function deleteInventorySection(id, storeId) {
  await ensureInventoryTables();
  await pool.execute('DELETE FROM inventory_section_items WHERE section_id = ?', [id]);
  await pool.execute('DELETE FROM inventory_sections WHERE id = ? AND store_id = ?', [id, storeId]);
}

export async function reorderInventorySections(storeId, ids) {
  await ensureInventoryTables();
  for (let i = 0; i < ids.length; i++) {
    await pool.execute('UPDATE inventory_sections SET sort_order = ? WHERE id = ? AND store_id = ?', [i, ids[i], storeId]);
  }
}

export async function addItemToSection(sectionId, itemType, itemId) {
  await ensureInventoryTables();
  await pool.execute(
    'INSERT IGNORE INTO inventory_section_items (section_id, item_type, item_id) VALUES (?, ?, ?)',
    [sectionId, itemType, itemId]
  );
}

export async function removeItemFromSection(sectionId, itemType, itemId) {
  await ensureInventoryTables();
  await pool.execute(
    'DELETE FROM inventory_section_items WHERE section_id = ? AND item_type = ? AND item_id = ?',
    [sectionId, itemType, itemId]
  );
}

// ── Inventory Transfers ─────────────────────────────────────────────────────

export async function createInventoryTransfer(fromStoreId, toStoreId, userId, items, notes) {
  await ensureInventoryTables();
  const [result] = await pool.execute(
    'INSERT INTO inventory_transfers (from_store_id, to_store_id, user_id, notes) VALUES (?, ?, ?, ?)',
    [fromStoreId, toStoreId, userId, notes || null]
  );
  const transferId = result.insertId;
  for (const item of items) {
    await pool.execute(
      'INSERT INTO inventory_transfer_items (transfer_id, item_type, item_id, item_name, quantity) VALUES (?, ?, ?, ?, ?)',
      [transferId, item.item_type, item.item_id, item.item_name, item.quantity]
    );
  }
  return transferId;
}

export async function getInventoryTransfers(storeId) {
  await ensureInventoryTables();
  const [transfers] = await pool.execute(
    `SELECT t.*,
       fs.name as from_store_name, ts.name as to_store_name
     FROM inventory_transfers t
     JOIN stores fs ON t.from_store_id = fs.id
     JOIN stores ts ON t.to_store_id = ts.id
     WHERE t.from_store_id = ? OR t.to_store_id = ?
     ORDER BY t.created_at DESC LIMIT 50`,
    [storeId, storeId]
  );
  if (transfers.length === 0) return [];
  const tIds = transfers.map(t => t.id);
  const ph = tIds.map(() => '?').join(',');
  const [items] = await pool.execute(
    `SELECT * FROM inventory_transfer_items WHERE transfer_id IN (${ph})`, tIds
  );
  return transfers.map(t => ({ ...t, items: items.filter(i => i.transfer_id === t.id) }));
}

export async function acceptInventoryTransfer(transferId, storeId) {
  await ensureInventoryTables();
  const [rows] = await pool.execute('SELECT * FROM inventory_transfers WHERE id = ? AND to_store_id = ? AND status = ?', [transferId, storeId, 'pending']);
  if (rows.length === 0) throw new Error('Transferencia no encontrada o ya procesada');
  const transfer = rows[0];
  const [items] = await pool.execute('SELECT * FROM inventory_transfer_items WHERE transfer_id = ?', [transferId]);

  for (const item of items) {
    if (item.item_type === 'raw_material') {
      const [src] = await pool.execute('SELECT quantity FROM raw_materials WHERE id = ? AND store_id = ?', [item.item_id, transfer.from_store_id]);
      if (src.length) {
        const prevQty = parseFloat(src[0].quantity);
        const newQty = Math.max(0, prevQty - item.quantity);
        await pool.execute('UPDATE raw_materials SET quantity = ? WHERE id = ? AND store_id = ?', [newQty, item.item_id, transfer.from_store_id]);
        await logInventoryMovement({ storeId: transfer.from_store_id, itemType: 'raw_material', itemId: item.item_id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
      const [dst] = await pool.execute('SELECT id, quantity FROM raw_materials WHERE name = ? AND store_id = ?', [item.item_name, storeId]);
      if (dst.length) {
        const prevQty = parseFloat(dst[0].quantity);
        const newQty = prevQty + parseFloat(item.quantity);
        await pool.execute('UPDATE raw_materials SET quantity = ? WHERE id = ?', [newQty, dst[0].id]);
        await logInventoryMovement({ storeId, itemType: 'raw_material', itemId: dst[0].id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
    } else if (item.item_type === 'product') {
      const [srcInv] = await pool.execute('SELECT stock FROM inventory WHERE product_id = ?', [item.item_id]);
      if (srcInv.length) {
        const prevQty = parseFloat(srcInv[0].stock);
        const newQty = Math.max(0, prevQty - item.quantity);
        await pool.execute('UPDATE inventory SET stock = ? WHERE product_id = ?', [newQty, item.item_id]);
        await logInventoryMovement({ storeId: transfer.from_store_id, itemType: 'product', itemId: item.item_id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
      const [dstProd] = await pool.execute('SELECT p.id, COALESCE(i.stock,0) as stock FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.name = ? AND p.store_id = ?', [item.item_name, storeId]);
      if (dstProd.length) {
        const prevQty = parseFloat(dstProd[0].stock);
        const newQty = prevQty + parseFloat(item.quantity);
        const [tUpd] = await pool.execute('UPDATE inventory SET stock = ? WHERE product_id = ?', [newQty, dstProd[0].id]);
        if (tUpd.affectedRows === 0) {
          await pool.execute('INSERT INTO inventory (product_id, stock) VALUES (?, ?)', [dstProd[0].id, newQty]);
        }
        await logInventoryMovement({ storeId, itemType: 'product', itemId: dstProd[0].id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
    } else if (item.item_type === 'ingredient') {
      const [src] = await pool.execute('SELECT stock FROM ingredients WHERE id = ? AND store_id = ?', [item.item_id, transfer.from_store_id]);
      if (src.length) {
        const prevQty = parseInt(src[0].stock) || 0;
        const newQty = Math.max(0, prevQty - parseInt(item.quantity));
        await pool.execute('UPDATE ingredients SET stock = ? WHERE id = ?', [newQty, item.item_id]);
        await logInventoryMovement({ storeId: transfer.from_store_id, itemType: 'ingredient', itemId: item.item_id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
      const [dst] = await pool.execute('SELECT id, stock FROM ingredients WHERE name = ? AND store_id = ?', [item.item_name, storeId]);
      if (dst.length) {
        const prevQty = parseInt(dst[0].stock) || 0;
        const newQty = prevQty + parseInt(item.quantity);
        await pool.execute('UPDATE ingredients SET stock = ? WHERE id = ?', [newQty, dst[0].id]);
        await logInventoryMovement({ storeId, itemType: 'ingredient', itemId: dst[0].id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
    } else if (item.item_type === 'extra') {
      const [src] = await pool.execute('SELECT stock FROM extras WHERE id = ? AND store_id = ?', [item.item_id, transfer.from_store_id]);
      if (src.length) {
        const prevQty = parseInt(src[0].stock) || 0;
        const newQty = Math.max(0, prevQty - parseInt(item.quantity));
        await pool.execute('UPDATE extras SET stock = ? WHERE id = ?', [newQty, item.item_id]);
        await logInventoryMovement({ storeId: transfer.from_store_id, itemType: 'extra', itemId: item.item_id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
      const [dst] = await pool.execute('SELECT id, stock FROM extras WHERE name = ? AND store_id = ?', [item.item_name, storeId]);
      if (dst.length) {
        const prevQty = parseInt(dst[0].stock) || 0;
        const newQty = prevQty + parseInt(item.quantity);
        await pool.execute('UPDATE extras SET stock = ? WHERE id = ?', [newQty, dst[0].id]);
        await logInventoryMovement({ storeId, itemType: 'extra', itemId: dst[0].id, itemName: item.item_name, previousQty: prevQty, newQty, reason: 'transfer', referenceId: transferId });
      }
    }
  }
  await pool.execute('UPDATE inventory_transfers SET status = ?, resolved_at = NOW() WHERE id = ?', ['accepted', transferId]);
}

export async function rejectInventoryTransfer(transferId, storeId) {
  await ensureInventoryTables();
  await pool.execute('UPDATE inventory_transfers SET status = ?, resolved_at = NOW() WHERE id = ? AND to_store_id = ? AND status = ?', ['rejected', transferId, storeId, 'pending']);
}

export async function cancelInventoryTransfer(transferId, userId) {
  await ensureInventoryTables();
  await pool.execute('UPDATE inventory_transfers SET status = ?, resolved_at = NOW() WHERE id = ? AND user_id = ? AND status = ?', ['cancelled', transferId, userId, 'pending']);
}

export async function getInventoryAlertReport(storeId) {
  await checkAndCreateStockAlerts(storeId);
  const [alerts] = await pool.execute(
    'SELECT * FROM stock_alerts WHERE store_id = ? AND status = ? ORDER BY alert_type ASC, item_name ASC',
    [storeId, 'active']
  );
  const outOfStock = alerts.filter(a => a.alert_type === 'out_of_stock');
  const lowStock = alerts.filter(a => a.alert_type === 'low_stock');
  return { outOfStock, lowStock, total: alerts.length };
}

// Worker Comments
export async function getWorkerComments(storeId, limit = 50) {
  const [rows] = await pool.execute(
    'SELECT * FROM worker_comments WHERE store_id = ? ORDER BY created_at DESC LIMIT ?',
    [storeId, limit]
  );
  return rows;
}

export async function createWorkerComment(storeId, workerId, workerName, comment) {
  const [result] = await pool.execute(
    'INSERT INTO worker_comments (store_id, worker_id, worker_name, comment) VALUES (?, ?, ?, ?)',
    [storeId, workerId, workerName, comment]
  );
  return { id: result.insertId, store_id: storeId, worker_id: workerId, worker_name: workerName, comment, created_at: new Date() };
}

export async function deleteWorkerComment(commentId, storeId) {
  await pool.execute('DELETE FROM worker_comments WHERE id = ? AND store_id = ?', [commentId, storeId]);
}

// Rankings
export async function getStoreRankings(storeIds, period = 'today') {
  if (!storeIds || storeIds.length === 0) return { stores: [], workers: [] };
  const placeholders = storeIds.map(() => '?').join(',');
  let dateFilter = '';
  if (period === 'today') dateFilter = 'AND DATE(o.created_at) = CURDATE()';
  else if (period === 'week') dateFilter = 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
  else if (period === 'month') dateFilter = 'AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

  const [storeRows] = await pool.execute(`
    SELECT s.id, s.name, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_sales
    FROM stores s
    LEFT JOIN orders o ON o.store_id = s.id AND o.status != 'canceled' ${dateFilter}
    WHERE s.id IN (${placeholders})
    GROUP BY s.id
    ORDER BY total_sales DESC
  `, storeIds);

  const [workerRows] = await pool.execute(`
    SELECT w.id, w.name, s.name AS store_name, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_sales
    FROM workers w
    JOIN stores s ON s.id = w.store_id
    LEFT JOIN orders o ON o.worker_name = w.name AND o.store_id = w.store_id AND o.status != 'canceled' ${dateFilter}
    WHERE w.store_id IN (${placeholders})
    GROUP BY w.id
    ORDER BY total_sales DESC
  `, storeIds);

  return {
    stores: storeRows.map(r => ({ ...r, total_sales: Number(r.total_sales) })),
    workers: workerRows.map(r => ({ ...r, total_sales: Number(r.total_sales) }))
  };
}

export { pool };

// ── Feedback ──────────────────────────────────────────────────────────
export async function createFeedbackCampaign(type = 'manual') {
  const [r] = await pool.execute('INSERT INTO feedback_campaigns (type, status) VALUES (?, "sending")', [type]);
  return r.insertId;
}

export async function createFeedbackToken(campaignId, userId, token, sentVia) {
  await pool.execute(
    'INSERT INTO feedback_tokens (campaign_id, user_id, token, sent_via) VALUES (?, ?, ?, ?)',
    [campaignId, userId, token, sentVia]
  );
}

export async function getFeedbackToken(token) {
  const [rows] = await pool.execute(`
    SELECT ft.*, u.username, u.email, u.business_name
    FROM feedback_tokens ft
    JOIN users u ON u.id = ft.user_id
    WHERE ft.token = ?
  `, [token]);
  return rows[0] || null;
}

export async function submitFeedbackResponse(tokenId, userId, data) {
  const [existing] = await pool.execute('SELECT id FROM feedback_responses WHERE token_id = ?', [tokenId]);
  if (existing[0]) throw new Error('Este enlace ya fue respondido');
  const [r] = await pool.execute(
    'INSERT INTO feedback_responses (token_id, user_id, overall_rating, ease_of_use, support_quality, would_recommend, comment, improvement_suggestions) VALUES (?,?,?,?,?,?,?,?)',
    [tokenId, userId, data.overall_rating, data.ease_of_use || null, data.support_quality || null, data.would_recommend ?? null, data.comment || null, data.improvement_suggestions || null]
  );
  await pool.execute('UPDATE feedback_tokens SET status="responded", responded_at=NOW() WHERE id=?', [tokenId]);
  await pool.execute(`
    UPDATE feedback_campaigns fc
    SET fc.total_responded = (SELECT COUNT(*) FROM feedback_tokens WHERE campaign_id = fc.id AND status = "responded")
    WHERE fc.id = (SELECT campaign_id FROM feedback_tokens WHERE id = ?)
  `, [tokenId]);
  return r.insertId;
}

export async function updateCampaignSentCount(campaignId, count) {
  await pool.execute('UPDATE feedback_campaigns SET total_sent = ?, status = "done" WHERE id = ?', [count, campaignId]);
}

export async function getFeedbackCampaigns() {
  const [rows] = await pool.execute('SELECT * FROM feedback_campaigns ORDER BY created_at DESC LIMIT 50');
  return rows;
}

export async function getFeedbackResponses(campaignId) {
  const [rows] = await pool.execute(`
    SELECT fr.*, u.username, u.business_name, u.email, ft.sent_via
    FROM feedback_responses fr
    JOIN feedback_tokens ft ON ft.id = fr.token_id
    JOIN users u ON u.id = fr.user_id
    ${campaignId ? 'WHERE ft.campaign_id = ?' : ''}
    ORDER BY fr.created_at DESC
    LIMIT 200
  `, campaignId ? [campaignId] : []);
  return rows;
}

// ── Feedback obligatorio del panel admin (una única vez por usuario) ──
export async function getAdminFeedbackByUser(userId) {
  const [rows] = await pool.execute('SELECT * FROM admin_feedback WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

export async function saveAdminFeedback(userId, { rating, liked_most, improvement, would_recommend }) {
  await pool.execute(
    `INSERT INTO admin_feedback (user_id, rating, liked_most, improvement, would_recommend)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, rating, liked_most || null, improvement || null,
     would_recommend === null || would_recommend === undefined ? null : (would_recommend ? 1 : 0)]
  );
}

export async function getAllAdminFeedback() {
  const [rows] = await pool.execute(`
    SELECT af.*, u.username, u.business_name, u.email
    FROM admin_feedback af
    JOIN users u ON u.id = af.user_id
    ORDER BY af.created_at DESC
    LIMIT 500
  `);
  return rows;
}

export async function getAllActiveUsersForFeedback() {
  const [rows] = await pool.execute(`
    SELECT id, username, email, phone, business_name
    FROM users
    WHERE is_banned = FALSE AND email_verified = TRUE
    ORDER BY id
  `);
  return rows;
}

// ── Totem Rentals ─────────────────────────────────────────────────────
export async function createTotemRental(userId, data) {
  const [r] = await pool.execute(
    'INSERT INTO totem_rentals (user_id, contact_name, contact_phone, address, notes, installation_fee, monthly_fee, currency_id) VALUES (?,?,?,?,?,?,?,?)',
    [userId, data.contact_name, data.contact_phone, data.address, data.notes || null, data.installation_fee, data.monthly_fee, data.currency_id || 'CLP']
  );
  return r.insertId;
}

export async function getTotemRentalByUser(userId) {
  const [rows] = await pool.execute('SELECT * FROM totem_rentals WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
  return rows[0] || null;
}

export async function updateTotemRentalMpPreference(rentalId, prefId) {
  await pool.execute('UPDATE totem_rentals SET mp_preference_id = ? WHERE id = ?', [prefId, rentalId]);
}

export async function updateTotemRentalPayment(rentalId, mpPaymentId) {
  await pool.execute(
    "UPDATE totem_rentals SET mp_payment_id = ?, status = 'pending_install' WHERE id = ?",
    [mpPaymentId, rentalId]
  );
}

export async function markTotemRentalInstalled(rentalId, mpSubscriptionId) {
  await pool.execute(
    "UPDATE totem_rentals SET status = 'active', mp_subscription_id = ?, installed_at = NOW() WHERE id = ?",
    [mpSubscriptionId || null, rentalId]
  );
}

export async function updateTotemRentalStatus(rentalId, status) {
  await pool.execute('UPDATE totem_rentals SET status = ? WHERE id = ?', [status, rentalId]);
}

export async function updateTotemSubscriptionStatus(subscriptionId, status) {
  await pool.execute('UPDATE totem_rentals SET mp_subscription_status = ? WHERE mp_subscription_id = ?', [status, subscriptionId]);
}

export async function getAllTotemRentals() {
  const [rows] = await pool.execute(`
    SELECT tr.*, u.username, u.email, u.business_name, u.phone AS user_phone
    FROM totem_rentals tr
    JOIN users u ON u.id = tr.user_id
    ORDER BY tr.created_at DESC
  `);
  return rows;
}

export async function logTotemPayment(rentalId, amount, type, mpPaymentId, status) {
  await pool.execute(
    'INSERT INTO totem_rental_payments (rental_id, amount, type, mp_payment_id, status) VALUES (?,?,?,?,?)',
    [rentalId, amount, type, mpPaymentId || null, status]
  );
}

// ─── Leads del asistente de ventas IA (chat público tipo Vambe) ──────────────

export async function createSalesLead(data) {
  const {
    name = null, phone = null, email = null, business_type = null,
    country = null, interest = null, notes = null, conversation = null,
    source = 'landing'
  } = data || {};
  const [res] = await pool.execute(
    `INSERT INTO sales_leads
       (name, phone, email, business_type, country, interest, notes, conversation, source)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [name, phone, email, business_type, country, interest, notes,
     conversation ? JSON.stringify(conversation) : null, source]
  );
  return res.insertId;
}

// Devuelve un lead existente con el mismo teléfono/email en las últimas 24h (evita duplicados)
export async function findRecentSalesLead(phone, email) {
  if (!phone && !email) return null;
  const [rows] = await pool.execute(
    `SELECT * FROM sales_leads
     WHERE created_at > (NOW() - INTERVAL 1 DAY)
       AND ((? IS NOT NULL AND phone = ?) OR (? IS NOT NULL AND email = ?))
     ORDER BY created_at DESC LIMIT 1`,
    [phone, phone, email, email]
  );
  return rows[0] || null;
}

export async function updateSalesLead(id, data) {
  const fields = [];
  const values = [];
  for (const key of ['name', 'phone', 'email', 'business_type', 'country', 'interest', 'notes', 'conversation']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'conversation' && data[key] ? JSON.stringify(data[key]) : data[key]);
    }
  }
  if (!fields.length) return;
  values.push(id);
  await pool.execute(`UPDATE sales_leads SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function getSalesLeads({ status = null, limit = 200 } = {}) {
  const lim = Math.min(parseInt(limit) || 200, 500);
  if (status) {
    const [rows] = await pool.execute(
      `SELECT * FROM sales_leads WHERE status = ? ORDER BY created_at DESC LIMIT ${lim}`,
      [status]
    );
    return rows;
  }
  const [rows] = await pool.execute(
    `SELECT * FROM sales_leads ORDER BY created_at DESC LIMIT ${lim}`
  );
  return rows;
}

export async function getSalesLeadStats() {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count FROM sales_leads GROUP BY status`
  );
  const stats = { total: 0, new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
  for (const r of rows) { stats[r.status] = r.count; stats.total += r.count; }
  return stats;
}

export async function updateSalesLeadStatus(id, status, notes) {
  if (notes !== undefined) {
    await pool.execute('UPDATE sales_leads SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
  } else {
    await pool.execute('UPDATE sales_leads SET status = ? WHERE id = ?', [status, id]);
  }
}

export async function deleteSalesLead(id) {
  await pool.execute('DELETE FROM sales_leads WHERE id = ?', [id]);
}