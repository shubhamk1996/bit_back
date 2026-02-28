// backend/src/database/seedEmployees.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const seedEmployees = async () => {
  const connection = await pool.getConnection();
  try {
    const hashedPassword = await bcrypt.hash('Employee@123', 12);

    const employees = [
      { email: 'm1@company.com', name: 'Marketing John', department: 'Marketing' },
      { email: 'm2@company.com', name: 'Marketing Sarah', department: 'Marketing' },
      { email: 'o1@company.com', name: 'Operations Mike', department: 'Operations' },
      { email: 'o2@company.com', name: 'Operations Anna', department: 'Operations' }
    ];

    for (const emp of employees) {
      // Check if user exists
      const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [emp.email]);
      if (existing.length === 0) {
        const [userResult] = await connection.query(
          'INSERT INTO users (email, password, role_id) VALUES (?, ?, 3)',
          [emp.email, hashedPassword]
        );
        await connection.query(
          'INSERT INTO employees (user_id, name, department, incentive_applicable, salary) VALUES (?, ?, ?, 1, 30000)',
          [userResult.insertId, emp.name, emp.department]
        );
        console.log(`Seeded employee: ${emp.name}`);
      }
    }
  } catch (error) {
    console.error('Error seeding employees:', error);
  } finally {
    connection.release();
  }
};

module.exports = seedEmployees;
