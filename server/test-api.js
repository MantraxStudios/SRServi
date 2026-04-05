import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'SDVDttniogreireg@2024',
  database: 'srservi'
};

async function testAPI() {
  try {
    console.log('🔄 Intentando registrar usuario...');
    
    const response = await fetch('http://localhost:3001/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        business_name: 'Mi Restaurante'
      })
    });
    
    const data = await response.json();
    console.log('📦 Respuesta del registro:', data);
    
    if (data.code) {
      console.log('\n🔑 Código de tienda:', data.code);
      console.log('\n✅ ¡Usuario registrado exitosamente!');
      
      console.log('\n🔄 Probando login...');
      const loginResponse = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'admin123'
        })
      });
      
      const loginData = await loginResponse.json();
      console.log('📦 Respuesta del login:', loginData);
      
      if (loginData.token) {
        console.log('\n🔑 Token obtenido:', loginData.token.substring(0, 50) + '...');
        
        console.log('\n🔄 Probando crear categoría...');
        const categoryResponse = await fetch('http://localhost:3001/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginData.token}`
          },
          body: JSON.stringify({
            name: 'Bebidas',
            description: 'Bebidas y refrescos'
          })
        });
        
        const categoryData = await categoryResponse.json();
        console.log('📦 Respuesta de categoría:', categoryData);
        
        if (categoryData.id) {
          console.log('\n✅ ¡Categoría creada exitosamente!');
        } else {
          console.log('\n❌ Error al crear categoría:', categoryData.error);
        }
      }
    } else if (data.error) {
      console.log('\n❌ Error:', data.error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
  
  process.exit(0);
}

testAPI();
