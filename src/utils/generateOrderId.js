// backend/src/utils/generateOrderId.js - Auto-generate Order IDs
const pool = require('../config/db');

const generateOrderId = async () => {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM orders');
  const count = rows[0].count + 1;
  const paddedCount = String(count).padStart(5, '0');
  return `ORD-${paddedCount}`;
};

module.exports = generateOrderId;
