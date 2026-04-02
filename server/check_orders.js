import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'mysql',
  database: 'srservi'
};

async function checkOrders() {
  let pool;
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log('Conexion a MySQL establecida');

    const [orders] = await connection.execute('SELECT id, order_number, order_type, payment_method, cash_approved FROM orders ORDER BY id DESC LIMIT 10');
    console.log('\nUltimos 10 pedidos:');
    orders.forEach(o => {
      console.log(`ID: ${o.id}, Order#: ${o.order_number}, Type: "${o.order_type}", Payment: ${o.payment_method}, CashApproved: ${o.cash_approved}`);
    });

    connection.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    if (pool) await pool.end();
  }
}

checkOrders();
