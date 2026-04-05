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
    console.log('Conexion a MySQL establecida');

    await connection.execute(`
      ALTER TABLE stores 
      ADD COLUMN mercadopago_access_token VARCHAR(500) DEFAULT NULL,
      ADD COLUMN mercadopago_terminal_id VARCHAR(100) DEFAULT NULL
    `);
    console.log('Columnas de Mercado Pago agregadas a stores');

    connection.release();
    await pool.end();
    console.log('Migracion completada');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Las columnas ya existen, no se requiere migracion');
    } else {
      console.error('Error:', error.message);
    }
    if (pool) await pool.end();
  }
}

migrate();
