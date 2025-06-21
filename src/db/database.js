const mysql = require('mysql2/promise');
require('dotenv').config();

// ESPÍA #1: Ver las variables al crear el pool
console.log(`[DB] Creando pool de conexiones con el host: ${process.env.MYSQLHOST}`);


const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
   connectTimeout: 20000
});

console.log('✅ Pool de conexiones MySQL creado.');

module.exports = pool;