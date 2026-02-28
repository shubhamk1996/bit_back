// backend/src/controllers/authController.js - Authentication Controller
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const jwtConfig = require('../config/jwt');
const generateOrderId = require('../utils/generateOrderId');
const calculateFinancials = require('../utils/calculateFinancials');
const generateTasksForOrder = require('../utils/generateTasks');

// Generate tokens
const generateTokens = (userId, roleId) => {
  const accessToken = jwt.sign({ userId, roleId }, jwtConfig.secret, { expiresIn: jwtConfig.expiry });
  const refreshToken = jwt.sign({ userId, roleId }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiry });
  return { accessToken, refreshToken };
};

// Client Signup
exports.signup = async (req, res) => {
  try {
    const { email, password, client_name, company, plan, subplan, payment_date, marketing_person_id, operations_person_id, important_info } = req.body;
  
    // Check existing user
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
  
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
  
    // Create user with client role
    const [userResult] = await pool.query(
      'INSERT INTO users (email, password, role_id) VALUES (?, ?, 2)',
      [email, hashedPassword]
    );
    const userId = userResult.insertId;
  
    // Calculate amount based on plan (Rs. 21,250 for website/starter, Rs. 42,500 for ultimate)
    let amount = 21250; 
    if (plan === 'marketing') {
      if (subplan === 'ultimate') amount = 42500;
      else amount = 21250; // Starter
    }

    // Check for incentive threshold
    let hasIncentive = false;
    if (marketing_person_id) {
      const [salesResult] = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) as total_sales FROM orders WHERE marketing_person_id = ?',
        [marketing_person_id]
      );
      if (salesResult[0].total_sales >= 100000) {
        hasIncentive = true;
      }
    }

    const financials = calculateFinancials(amount, hasIncentive);
  
    // Calculate upcoming payment date (1 year after payment date)
    const payDateStr = payment_date || new Date().toISOString().split('T')[0];
    const payDate = new Date(payDateStr + 'T00:00:00');
    const upcomingDate = new Date(payDate);
    upcomingDate.setFullYear(upcomingDate.getFullYear() + 1);
  
    // Generate order ID
    const orderId = await generateOrderId();
  
    // Create order
    const [orderResult] = await pool.query(
      `INSERT INTO orders (order_id, user_id, client_name, company, plan, subplan, payment_date, upcoming_payment_date,
        marketing_person_id, operations_person_id, amount, tax_amount, hosting_charges, gross_margin,
        payments, incentive, office_expenses, extraordinary, net_profit,
        dividend_sumit, dividend_abhay, dividend_ttd, important_info)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, userId, client_name, company, plan, subplan || null, payDateStr, upcomingDate.toISOString().split('T')[0],
        marketing_person_id || null, operations_person_id || null,
        financials.amount, financials.tax_amount, financials.hosting_charges, financials.gross_margin,
        financials.payments, financials.incentive, financials.office_expenses,
        financials.extraordinary, financials.net_profit,
        financials.dividend_sumit, financials.dividend_abhay, financials.dividend_ttd, important_info || null]
    );
  
    // Generate tasks
    const tasks = generateTasksForOrder(orderResult.insertId, payDateStr, plan, subplan);
    for (const task of tasks) {
      await pool.query(
        'INSERT INTO tasks (order_id, task_number, card_number, title, description, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [task.order_id, task.task_number, task.card_number, task.title, task.description, task.due_date, task.status]
      );
    }

    // Generate tokens
    const tokens = generateTokens(userId, 2);
    await pool.query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, userId]);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { userId, orderId, tokens }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND u.is_active = 1',
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const tokens = generateTokens(user.id, user.role_id);
    await pool.query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, user.id]);

    // Get employee data if employee role
    let employeeData = null;
    if (user.role_name === 'employee') {
      const [emp] = await pool.query('SELECT * FROM employees WHERE user_id = ?', [user.id]);
      if (emp.length > 0) employeeData = emp[0];
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { id: user.id, email: user.email, role: user.role_name, role_id: user.role_id },
        employee: employeeData,
        tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    const [users] = await pool.query('SELECT * FROM users WHERE id = ? AND refresh_token = ?', [decoded.userId, refreshToken]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const tokens = generateTokens(decoded.userId, decoded.roleId);
    await pool.query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, decoded.userId]);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT u.id, u.email, u.role_id, r.name as role_name, u.created_at FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [req.user.id]
    );
    let employeeData = null;
    if (req.user.role_name === 'employee') {
      const [emp] = await pool.query('SELECT * FROM employees WHERE user_id = ?', [req.user.id]);
      if (emp.length > 0) employeeData = emp[0];
    }
    res.json({ success: true, data: { user: users[0], employee: employeeData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
