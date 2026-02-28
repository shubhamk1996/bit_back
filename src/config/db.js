// backend/src/config/db.js - Database Connection
// Strictly using MySQL (mysql2/promise) as per user requirement
require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'admin_client_mgmt',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('MySQL Database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL Connection Error:', err.message);
  });

module.exports = pool;
