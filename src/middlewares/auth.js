// backend/src/middlewares/auth.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtConfig.secret);
    const [users] = await pool.query(
      'SELECT u.id, u.email, u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND u.is_active = 1',
      [decoded.userId]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', expired: true });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = authenticate;
