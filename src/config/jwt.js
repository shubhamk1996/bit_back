// backend/src/config/jwt.js - JWT Configuration
require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'super_secret_jwt_key_2024',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_2024',
  expiry: process.env.JWT_EXPIRY || '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
};
