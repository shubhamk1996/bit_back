// backend/src/controllers/employeeController.js - Employee Management Controller
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, u.email, u.is_active
      FROM employees e JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get employees by department
exports.getEmployeesByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const [rows] = await pool.query(
      'SELECT e.*, u.email FROM employees e JOIN users u ON e.user_id = u.id WHERE e.department = ? AND u.is_active = 1',
      [department]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create employee
exports.createEmployee = async (req, res) => {
  try {
    const { name, aadhar, department, incentive_applicable, email, password, salary } = req.body;
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [userResult] = await pool.query(
      'INSERT INTO users (email, password, role_id) VALUES (?, ?, 3)',
      [email, hashedPassword]
    );
    const [empResult] = await pool.query(
      'INSERT INTO employees (user_id, name, aadhar, department, incentive_applicable, salary) VALUES (?, ?, ?, ?, ?, ?)',
      [userResult.insertId, name, aadhar, department, (department === 'Sales' || department === 'Marketing') ? (incentive_applicable ? 1 : 0) : 0, salary || 0]
    );
    res.status(201).json({ success: true, message: 'Employee created successfully', data: { id: empResult.insertId } });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const { name, aadhar, department, incentive_applicable, email, password, salary } = req.body;
    const { id } = req.params;
    const [emp] = await pool.query('SELECT * FROM employees WHERE id = ?', [id]);
    if (emp.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });

    await pool.query(
      'UPDATE employees SET name=?, aadhar=?, department=?, incentive_applicable=?, salary=? WHERE id=?',
      [name, aadhar, department, (department === 'Sales' || department === 'Marketing') ? (incentive_applicable ? 1 : 0) : 0, salary || 0, id]
    );
    if (email) await pool.query('UPDATE users SET email = ? WHERE id = ?', [email, emp[0].user_id]);
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, emp[0].user_id]);
    }
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const [emp] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [req.params.id]);
    if (emp.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = ?', [emp[0].user_id]);
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get employee salary & incentive data
exports.getSalaryIncentive = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = String(now.getFullYear());
    const monthStart = `${currentYear}-${currentMonth}-01`;
    const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
    const nextMonthYear = nextMonth === 1 ? now.getFullYear() + 1 : now.getFullYear();
    const monthEnd = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    // Get employees with totals
    const [employees] = await pool.query(`
      SELECT e.*, u.email,
        COALESCE((SELECT SUM(o.incentive) FROM orders o WHERE o.marketing_person_id = e.id), 0) as total_incentive_earned,
        COALESCE((SELECT SUM(o.amount) FROM orders o WHERE o.marketing_person_id = e.id), 0) as total_revenue_generated,
        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.marketing_person_id = e.id), 0) as total_orders
      FROM employees e JOIN users u ON e.user_id = u.id
      WHERE u.is_active = 1
      ORDER BY e.department, e.name
    `);

    // Monthly salary total
    const [salaryTotal] = await pool.query(
      'SELECT COALESCE(SUM(e.salary), 0) as total_salary FROM employees e JOIN users u ON e.user_id = u.id WHERE u.is_active = 1'
    );

    // Monthly incentive total
    const [monthlyInc] = await pool.query(
      `SELECT COALESCE(SUM(o.incentive), 0) as monthly_incentive
       FROM orders o WHERE o.marketing_person_id IS NOT NULL AND o.payment_date >= ? AND o.payment_date < ?`,
      [monthStart, monthEnd]
    );

    // Yearly incentive total
    const [yearlyInc] = await pool.query(
      `SELECT COALESCE(SUM(o.incentive), 0) as yearly_incentive
       FROM orders o WHERE o.marketing_person_id IS NOT NULL AND o.payment_date >= ? AND o.payment_date <= ?`,
      [yearStart, yearEnd]
    );

    res.json({
      success: true,
      data: {
        employees,
        monthlyPayouts: { total_salary: salaryTotal[0].total_salary, monthly_incentive: monthlyInc[0].monthly_incentive },
        yearlyPayouts: { total_salary: salaryTotal[0].total_salary * 12, yearly_incentive: yearlyInc[0].yearly_incentive }
      }
    });
  } catch (error) {
    console.error('Salary incentive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payouts by date range
exports.getPayoutsByDate = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = 'AND o.payment_date >= ? AND o.payment_date <= ?';
      params.push(startDate, endDate);
    }

    const [data] = await pool.query(`
      SELECT e.id, e.name, e.department, e.salary,
        COALESCE(SUM(o.incentive), 0) as incentive_earned,
        COALESCE(SUM(o.amount), 0) as revenue_generated,
        COUNT(o.id) as order_count
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN orders o ON o.marketing_person_id = e.id ${dateFilter}
      WHERE u.is_active = 1
      GROUP BY e.id, e.name, e.department, e.salary
      ORDER BY e.department, e.name
    `, params);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get employee dashboard data (for logged-in employee)
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const [emp] = await pool.query('SELECT * FROM employees WHERE user_id = ?', [req.user.id]);
    if (emp.length === 0) return res.status(404).json({ success: false, message: 'Employee profile not found' });
    const employee = emp[0];
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    // Fetch previous year tasks for both departments
    const [prevYearTasks] = await pool.query(`
      SELECT t.*, o.company, o.order_id as order_display_id
      FROM tasks t
      JOIN orders o ON t.order_id = o.id
      WHERE (o.marketing_person_id = ? OR o.operations_person_id = ?)
      AND YEAR(t.due_date) = ?
      ORDER BY t.due_date DESC
    `, [employee.id, employee.id, prevYear]);

    if (employee.department === 'Sales' || employee.department === 'Marketing') {
      const [orders] = await pool.query(`
        SELECT o.order_id, o.company, o.plan, o.amount, o.incentive, o.payment_date, o.created_at
        FROM orders o WHERE o.marketing_person_id = ?
        ORDER BY o.created_at DESC
      `, [employee.id]);

      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.amount), 0);
      const totalIncentive = orders.reduce((sum, o) => sum + parseFloat(o.incentive), 0);
      const incentiveEligible = totalRevenue >= 100000;

      res.json({
        success: true,
        data: {
          employee, orders, totalRevenue, totalIncentive, incentiveEligible,
          prevYearTasks,
          salary: parseFloat(employee.salary),
          progressBar: {
            salary: parseFloat(employee.salary),
            incentive: incentiveEligible ? totalIncentive : 0,
            revenueToUnlock: 100000, currentRevenue: totalRevenue
          }
        }
      });
    } else {
      // Operations department
      const [orders] = await pool.query(`
        SELECT o.order_id, o.company, o.plan, o.status, o.created_at
        FROM orders o WHERE o.operations_person_id = ?
        ORDER BY o.created_at DESC
      `, [employee.id]);

      res.json({
        success: true,
        data: {
          employee, orders, totalRevenue: 0, totalIncentive: 0, incentiveEligible: false,
          prevYearTasks,
          salary: parseFloat(employee.salary),
          progressBar: { salary: parseFloat(employee.salary), incentive: 0, revenueToUnlock: 0, currentRevenue: 0 }
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
