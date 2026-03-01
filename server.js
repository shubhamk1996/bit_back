// backend/server.js - Server Entry Point
require('dotenv').config();
const app = require('./src/app');
const { createTables } = require('./src/database/schema');
const seedEmployees = require('./src/database/seedEmployees');
const initCronJobs = require('./src/cron/taskCron');

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    // Initialize database tables
    await createTables();
    // Seed employees (Marketing & Operations)
    await seedEmployees();
    // Initialize cron jobs
    initCronJobs();
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
