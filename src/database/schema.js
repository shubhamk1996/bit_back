// backend/src/database/schema.js - Database Schema Initialization
// Strictly using MySQL syntax
const pool = require('../config/db');

const createTables = async () => {
  const connection = await pool.getConnection();
  try {
    // Roles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INT NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `);

    // Employees table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        aadhar VARCHAR(255),
        department VARCHAR(255) NOT NULL,
        incentive_applicable TINYINT(1) DEFAULT 0,
        salary DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

      // Orders table
  await connection.query(`
  CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  client_name VARCHAR(255),
  company VARCHAR(255) NOT NULL,
  plan VARCHAR(255) NOT NULL,
  subplan VARCHAR(255),
  payment_date DATE NOT NULL,
  upcoming_payment_date DATE NOT NULL,
  marketing_person_id INT,
  operations_person_id INT,
  amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  gross_margin DECIMAL(15,2) NOT NULL,
  hosting_charges DECIMAL(15,2) NOT NULL,
  payments DECIMAL(15,2) NOT NULL,
  incentive DECIMAL(15,2) NOT NULL,
  office_expenses DECIMAL(15,2) NOT NULL,
  extraordinary DECIMAL(15,2) NOT NULL,
  net_profit DECIMAL(15,2) NOT NULL,
  dividend_sumit DECIMAL(15,2) NOT NULL,
  dividend_abhay DECIMAL(15,2) NOT NULL,
  dividend_ttd DECIMAL(15,2) NOT NULL,

status VARCHAR(255) DEFAULT 'active',
website_status VARCHAR(255) DEFAULT 'In Progress',
website_link VARCHAR(255),
important_info TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
FOREIGN KEY (marketing_person_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (operations_person_id) REFERENCES employees(id) ON DELETE SET NULL
  )
  `);

    // Ensure columns exist for existing tables
    const [cols] = await connection.query('SHOW COLUMNS FROM orders');
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes('tax_amount')) {
      await connection.query('ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0 AFTER amount');
    }
    if (!colNames.includes('client_name')) {
      await connection.query('ALTER TABLE orders ADD COLUMN client_name VARCHAR(255) AFTER user_id');
    }
    if (!colNames.includes('website_status')) {
      await connection.query('ALTER TABLE orders ADD COLUMN website_status VARCHAR(255) DEFAULT "In Progress" AFTER status');
    }
    if (!colNames.includes('website_link')) {
      await connection.query('ALTER TABLE orders ADD COLUMN website_link VARCHAR(255) AFTER website_status');
    }
    if (!colNames.includes('important_info')) {
      await connection.query('ALTER TABLE orders ADD COLUMN important_info TEXT AFTER website_link');
    }
    if (!colNames.includes('dividend_sumit')) {
      await connection.query('ALTER TABLE orders ADD COLUMN dividend_sumit DECIMAL(15,2) DEFAULT 0 AFTER net_profit');
    }
    if (!colNames.includes('dividend_abhay')) {
      await connection.query('ALTER TABLE orders ADD COLUMN dividend_abhay DECIMAL(15,2) DEFAULT 0 AFTER dividend_sumit');
    }
    if (!colNames.includes('dividend_ttd')) {
      await connection.query('ALTER TABLE orders ADD COLUMN dividend_ttd DECIMAL(15,2) DEFAULT 0 AFTER dividend_abhay');
    }



    // Tasks table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        task_number INT NOT NULL,
        card_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        status VARCHAR(255) DEFAULT 'pending',
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Invoices table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(255) NOT NULL UNIQUE,
        order_id INT NOT NULL,
        generated_by INT,
        file_path VARCHAR(255),
        total_amount DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Email logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        body TEXT,
        status VARCHAR(255) DEFAULT 'pending',
        sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Salary records table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS salary_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        base_salary DECIMAL(15,2) DEFAULT 0,
        incentive_earned DECIMAL(15,2) DEFAULT 0,
        total_payout DECIMAL(15,2) DEFAULT 0,
        revenue_generated DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);

    // Settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(255) NOT NULL UNIQUE,
        key_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings
    await connection.query(`
      INSERT IGNORE INTO settings (key_name, key_value) VALUES
      ('theme_colors', '["#1a237e", "#3949ab"]'),
      ('logo_url', '')
    `);

    // Insert default roles
    await connection.query(`
      INSERT IGNORE INTO roles (id, name, description) VALUES
      (1, 'admin', 'System Administrator'),
      (2, 'client', 'Client User'),
      (3, 'employee', 'Employee User')
    `);

    // Insert default admin user (password: Admin@123)
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    await connection.query(`
      INSERT IGNORE INTO users (id, email, password, role_id) VALUES
      (1, 'admin@admin.com', ?, 1)
    `, [hashedPassword]);

    console.log('All database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { createTables };
