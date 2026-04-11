import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'SDVDttniogreireg@2024',
  database: 'srservi'
};

async function migrate() {
  let pool;
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida');

    const [columns] = await connection.execute('SHOW COLUMNS FROM orders');
    const columnNames = columns.map(c => c.Field);
    console.log('Columnas actuales:', columnNames);

    if (!columnNames.includes('payment_method')) {
      console.log('➕ Agregando columna payment_method...');
      await connection.execute('ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT \'card\' AFTER status');
      console.log('✅ Columna payment_method agregada');
    } else {
      console.log('ℹ️ Columna payment_method ya existe');
    }

    if (!columnNames.includes('cash_approved')) {
      console.log('➕ Agregando columna cash_approved...');
      await connection.execute('ALTER TABLE orders ADD COLUMN cash_approved BOOLEAN DEFAULT FALSE AFTER payment_method');
      console.log('✅ Columna cash_approved agregada');
    } else {
      console.log('ℹ️ Columna cash_approved ya existe');
    }

    try {
      const [tuuDeviceCols] = await connection.execute('DESCRIBE tuu_devices');
      const tuuDeviceColNames = tuuDeviceCols.map(c => c.Field);
      if (!tuuDeviceColNames.includes('device_id')) {
        console.log('➕ Agregando columna device_id a tuu_devices...');
        await connection.execute('ALTER TABLE tuu_devices ADD COLUMN device_id VARCHAR(100) DEFAULT \'\'');
        console.log('✅ Columna device_id agregada');
      } else {
        console.log('ℹ️ Columna device_id ya existe');
      }
    } catch (e) {
      console.log('ℹ️ Tabla tuu_devices no existe, se creara con la columna');
    }

    try {
      const [configCols] = await connection.execute('DESCRIBE store_configurations');
      const configColNames = configCols.map(c => c.Field);
      if (!configColNames.includes('default_terminal')) {
        console.log('➕ Agregando columna default_terminal a store_configurations...');
        await connection.execute('ALTER TABLE store_configurations ADD COLUMN default_terminal INT DEFAULT NULL');
        console.log('✅ Columna default_terminal agregada');
      } else {
        console.log('ℹ️ Columna default_terminal ya existe');
      }
    } catch (e) {
      console.log('ℹ️ Tabla store_configurations no existe, se creara con la columna');
    }

    try {
      await connection.execute('DESCRIBE mercadopago_terminal_stores');
      console.log('ℹ️ Tabla mercadopago_terminal_stores ya existe');
    } catch (e) {
      console.log('➕ Creando tabla mercadopago_terminal_stores...');
      await connection.execute(`
        CREATE TABLE mercadopago_terminal_stores (
          id INT PRIMARY KEY AUTO_INCREMENT,
          mercadopago_terminal_id INT NOT NULL,
          store_id INT NOT NULL,
          UNIQUE KEY unique_mp_store (mercadopago_terminal_id, store_id)
        )`);
      console.log('✅ Tabla mercadopago_terminal_stores creada');
    }

    try {
      const [links] = await connection.execute('SELECT COUNT(*) as c FROM mercadopago_terminal_stores');
      if (links[0].c === 0) {
        console.log('➕ Vinculando MP existentes a tiendas...');
        await connection.execute(`
          INSERT IGNORE INTO mercadopago_terminal_stores (mercadopago_terminal_id, store_id)
          SELECT m.id, s.id FROM mercado_pago_terminals m JOIN stores s ON s.user_id = m.user_id
        `);
        const [count] = await connection.execute('SELECT COUNT(*) as c FROM mercadopago_terminal_stores');
        console.log('✅ ' + count[0].c + ' vinculos MP-tienda creados');
      } else {
        console.log('ℹ️ Ya hay vinculos MP-tienda existentes');
      }
    } catch (e) {
      console.log('ℹ️ No se pudieron crear vinculos MP: ' + e.message);
    }

    console.log('\n✅ Migración completada');
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    if (pool) await pool.end();
    process.exit(1);
  }
}

migrate();
