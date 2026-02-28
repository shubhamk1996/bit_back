// backend/src/cron/taskCron.js - Cron job to mark overdue tasks
const cron = require('node-cron');
const pool = require('../config/db');

const initCronJobs = () => {
  // Run every day at midnight - mark overdue tasks
  cron.schedule('0 0 * * *', async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        "UPDATE tasks SET status = 'overdue' WHERE due_date < ? AND status = 'pending'",
        [today]
      );
      console.log('Cron: Overdue tasks updated');
    } catch (error) {
      console.error('Cron error:', error.message);
    }
  });
  console.log('Cron jobs initialized');
};

module.exports = initCronJobs;
