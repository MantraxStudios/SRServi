import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'SDVDttniogreireg@2024'
};

async function createDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    await connection.query('CREATE DATABASE IF NOT EXISTS srservi');
    console.log('✅ Base de datos "srservi" creada o verificada correctamente');
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Error al crear la base de datos:', error.message);
    throw error;
  }
}

createDatabase()
  .then(() => {
    console.log('🎉 Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
