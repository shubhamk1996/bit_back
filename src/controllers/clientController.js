// backend/src/controllers/clientController.js - Client/Order Management Controller
const pool = require('../config/db');
const calculateFinancials = require('../utils/calculateFinancials');
const generateOrderId = require('../utils/generateOrderId');
const generateTasksForOrder = require('../utils/generateTasks');

// Get all clients/orders (Admin)
exports.getAllClients = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const countParams = [];

    let whereClause = '';
    if (search) {
      const s = `%${search}%`;
      whereClause = `WHERE o.order_id LIKE ? OR u.email LIKE ? OR o.company LIKE ? OR o.plan LIKE ?
        OR me.name LIKE ? OR oe.name LIKE ? OR CAST(o.amount AS CHAR) LIKE ? OR o.client_name LIKE ?`;
      params.push(s, s, s, s, s, s, s, s);
      countParams.push(s, s, s, s, s, s, s, s);
    }

    const baseJoin = `FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN employees me ON o.marketing_person_id = me.id
      LEFT JOIN employees oe ON o.operations_person_id = oe.id`;

    const [rows] = await pool.query(
      `SELECT o.*, u.email, me.name as marketing_person_name, oe.name as operations_person_name
       ${baseJoin} ${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total ${baseJoin} ${whereClause}`,
      countParams
    );
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        clients: rows,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single client/order by ID
exports.getClientById = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.*, u.email, me.name as marketing_person_name, oe.name as operations_person_name
      FROM orders o JOIN users u ON o.user_id = u.id
      LEFT JOIN employees me ON o.marketing_person_id = me.id
      LEFT JOIN employees oe ON o.operations_person_id = oe.id
      WHERE o.id = ?
    `, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new client order (Admin)
exports.createClient = async (req, res) => {
  try {
    const { email, password, client_name, company, mobile, city, plan, subplan, payment_date, marketing_person_id, operations_person_id, important_info } = req.body;
    const requirement_snapshot = req.file ? req.file.filename : null;
    const bcrypt = require('bcryptjs');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      const hashedPassword = await bcrypt.hash(password || 'Client@123', 12);
      const [userResult] = await pool.query('INSERT INTO users (email, password, role_id) VALUES (?, ?, 2)', [email, hashedPassword]);
      userId = userResult.insertId;
    }

    let amount = 21250;
    if (plan === 'marketing') {
      amount = subplan === 'ultimate' ? 42500 : 21250;
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
    const payDateStr = payment_date || new Date().toISOString().split('T')[0];
    const payDate = new Date(payDateStr + 'T00:00:00');
    const upcomingDate = new Date(payDate);
    upcomingDate.setFullYear(upcomingDate.getFullYear() + 1);
    const orderId = await generateOrderId();

    const [orderResult] = await pool.query(
      `INSERT INTO orders (order_id, user_id, client_name, mobile, city, company, plan, subplan, payment_date, upcoming_payment_date,
        marketing_person_id, operations_person_id, amount, tax_amount, hosting_charges, gross_margin,
        payments, incentive, office_expenses, extraordinary, net_profit,
        dividend_sumit, dividend_abhay, dividend_ttd, important_info, requirement_snapshot, website_status, website_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, userId, client_name, mobile || null, city || null, company, plan, subplan || null, payDateStr, upcomingDate.toISOString().split('T')[0],
        marketing_person_id || null, operations_person_id || null,
        financials.amount, financials.tax_amount, financials.hosting_charges, financials.gross_margin,
        financials.payments, financials.incentive, financials.office_expenses,
        financials.extraordinary, financials.net_profit,
        financials.dividend_sumit, financials.dividend_abhay, financials.dividend_ttd, 
        important_info || null, requirement_snapshot, req.body.website_status || 'In Progress', req.body.website_link || null]
    );

    const tasks = generateTasksForOrder(orderResult.insertId, payDateStr, plan, subplan);
    for (const task of tasks) {
      await pool.query(
        'INSERT INTO tasks (order_id, task_number, card_number, title, description, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [task.order_id, task.task_number, task.card_number, task.title, task.description, task.due_date, task.status]
      );
    }

    res.status(201).json({ success: true, message: 'Client created successfully', data: { orderId, id: orderResult.insertId } });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update client order
exports.updateClient = async (req, res) => {
  try {
    const { client_name, company, mobile, city, plan, subplan, payment_date, marketing_person_id, operations_person_id, important_info } = req.body;
    const requirement_snapshot = req.file ? req.file.filename : undefined;
    let amount = 21250;
    if (plan === 'marketing') {
      amount = subplan === 'ultimate' ? 42500 : 21250;
    }

    // Check for incentive threshold
    let hasIncentive = false;
    if (marketing_person_id) {
      const [salesResult] = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) as total_sales FROM orders WHERE marketing_person_id = ? AND id != ?',
        [marketing_person_id, req.params.id]
      );
      if (salesResult[0].total_sales >= 100000) {
        hasIncentive = true;
      }
    }

    const financials = calculateFinancials(amount, hasIncentive);
    const payDateStr = payment_date || new Date().toISOString().split('T')[0];
    const payDate = new Date(payDateStr + 'T00:00:00');
    const upcomingDate = new Date(payDate);
    upcomingDate.setFullYear(upcomingDate.getFullYear() + 1);

    const snapshotClause = requirement_snapshot !== undefined ? ', requirement_snapshot=?' : '';
    const snapshotVal = requirement_snapshot !== undefined ? [requirement_snapshot] : [];

    await pool.query(
      `UPDATE orders SET client_name=?, mobile=?, city=?, company=?, plan=?, subplan=?, payment_date=?, upcoming_payment_date=?,
        marketing_person_id=?, operations_person_id=?, amount=?, tax_amount=?, hosting_charges=?,
        gross_margin=?, payments=?, incentive=?, office_expenses=?, extraordinary=?,
        net_profit=?, dividend_sumit=?, dividend_abhay=?, dividend_ttd=?, important_info=?,
        website_status=?, website_link=?${snapshotClause}
       WHERE id=?`,
      [client_name, mobile || null, city || null, company, plan, subplan || null, payDateStr, upcomingDate.toISOString().split('T')[0],
        marketing_person_id || null, operations_person_id || null,
        financials.amount, financials.tax_amount, financials.hosting_charges, financials.gross_margin,
        financials.payments, financials.incentive, financials.office_expenses,
        financials.extraordinary, financials.net_profit,
        financials.dividend_sumit, financials.dividend_abhay, financials.dividend_ttd,
        important_info || null, req.body.website_status || 'In Progress', req.body.website_link || null,
        ...snapshotVal,
        req.params.id]
    );
    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete client order
exports.deleteClient = async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get client orders for logged-in client
exports.getMyOrders = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.*, me.name as marketing_person_name, oe.name as operations_person_name
      FROM orders o
      LEFT JOIN employees me ON o.marketing_person_id = me.id
      LEFT JOIN employees oe ON o.operations_person_id = oe.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    // First day of current month
    const defaultStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    // Last day of current month
    const defaultEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

    const filterStart = startDate || defaultStart;
    const filterEnd = endDate || defaultEnd;

    const [totalClients] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [totalEmployees] = await pool.query('SELECT COUNT(*) as count FROM employees');
    const [pendingTasks] = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'");

    const [revMonthly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as monthly FROM orders WHERE payment_date >= ? AND payment_date < ?",
      [defaultStart, defaultEnd]
    );
    const [revYearly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as yearly FROM orders WHERE payment_date >= ? AND payment_date <= ?",
      [`${currentYear}-01-01`, `${currentYear}-12-31`]
    );
    const [revTotal] = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM orders");

    const [webMonthly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as monthly FROM orders WHERE plan = 'website' AND payment_date >= ? AND payment_date < ?",
      [defaultStart, defaultEnd]
    );
    const [webYearly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as yearly FROM orders WHERE plan = 'website' AND payment_date >= ? AND payment_date <= ?",
      [`${currentYear}-01-01`, `${currentYear}-12-31`]
    );

    const [mktMonthly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as monthly FROM orders WHERE plan = 'marketing' AND payment_date >= ? AND payment_date < ?",
      [defaultStart, defaultEnd]
    );
    const [mktYearly] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as yearly FROM orders WHERE plan = 'marketing' AND payment_date >= ? AND payment_date <= ?",
      [`${currentYear}-01-01`, `${currentYear}-12-31`]
    );

    const [finSummary] = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalRevenue,
        COALESCE(SUM(hosting_charges), 0) as hostingCost,
        COALESCE(SUM(gross_margin), 0) as grossMargin,
        COALESCE(SUM(payments), 0) as payments,
        COALESCE(SUM(incentive), 0) as incentive,
        COALESCE(SUM(office_expenses), 0) as officeExpenses,
        COALESCE(SUM(extraordinary), 0) as extraordinary,
        COALESCE(SUM(net_profit), 0) as netProfit,
        COALESCE(SUM(dividend_sumit), 0) as dividendSumit,
        COALESCE(SUM(dividend_abhay), 0) as dividendAbhay,
        COALESCE(SUM(dividend_ttd), 0) as dividendTTD
      FROM orders
      WHERE payment_date >= ? AND payment_date <= ?
    `, [filterStart, filterEnd]);

    res.json({
      success: true,
      data: {
        totalClients: totalClients[0].count,
        totalEmployees: totalEmployees[0].count,
        pendingTasks: pendingTasks[0].count,
        totalRevenue: { monthly: revMonthly[0].monthly, yearly: revYearly[0].yearly, total: revTotal[0].total },
        websiteEarnings: { monthly: webMonthly[0].monthly, yearly: webYearly[0].yearly },
        marketingEarnings: { monthly: mktMonthly[0].monthly, yearly: mktYearly[0].yearly },
        financialSummary: finSummary[0],
        filter: { startDate: filterStart, endDate: filterEnd }
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
