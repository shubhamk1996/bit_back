// backend/src/controllers/taskController.js - Task Management Controller
const pool = require('../config/db');

// Get tasks for an order (Admin view)
exports.getTasksByOrder = async (req, res) => {
  try {
    const [tasks] = await pool.query(
      'SELECT * FROM tasks WHERE order_id = ? ORDER BY card_number ASC',
      [req.params.orderId]
    );
    const [order] = await pool.query(
      'SELECT o.*, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?',
      [req.params.orderId]
    );
    res.json({ success: true, data: { tasks, order: order[0] || null } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tasks for logged-in client
exports.getMyTasks = async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT id FROM orders WHERE user_id = ?', [req.user.id]);
    if (orders.length === 0) {
      return res.json({ success: true, data: [] });
    }
      const orderIds = orders.map(o => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const [tasks] = await pool.query(
        `SELECT t.*, o.order_id as order_code, o.company
         FROM tasks t JOIN orders o ON t.order_id = o.id
         WHERE t.order_id IN (${placeholders})
         ORDER BY t.due_date ASC`,
        orderIds
      );
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const completedAt = status === 'completed' ? new Date() : null;
    await pool.query(
      'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?',
      [status, completedAt, req.params.id]
    );
    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get tasks popup data (today, 2 days left, 4 days upcoming)
exports.getTasksPopup = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const twoDaysLater = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const fourDaysLater = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];

    // Today's tasks (not completed)
    const [todayTasks] = await pool.query(`
      SELECT t.*, o.order_id as order_code, o.company
      FROM tasks t JOIN orders o ON t.order_id = o.id
      WHERE t.due_date = ? AND t.status != 'completed'
      ORDER BY t.card_number
    `, [today]);

    // Tasks due in 2 days (not completed)
    const [twoDayTasks] = await pool.query(`
      SELECT t.*, o.order_id as order_code, o.company
      FROM tasks t JOIN orders o ON t.order_id = o.id
      WHERE t.due_date = ? AND t.status != 'completed'
      ORDER BY t.card_number
    `, [twoDaysLater]);

    // Upcoming tasks (4 days from now, not completed)
    const [upcomingTasks] = await pool.query(`
      SELECT t.*, o.order_id as order_code, o.company
      FROM tasks t JOIN orders o ON t.order_id = o.id
      WHERE t.due_date = ? AND t.status != 'completed'
      ORDER BY t.card_number
    `, [fourDaysLater]);

    // Completed tasks (last 7 days only)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const [completedTasks] = await pool.query(`
      SELECT t.*, o.order_id as order_code, o.company
      FROM tasks t JOIN orders o ON t.order_id = o.id
      WHERE t.status = 'completed' AND t.completed_at >= ?
      ORDER BY t.completed_at DESC
    `, [sevenDaysAgo]);

    res.json({
      success: true,
      data: { todayTasks, twoDayTasks, upcomingTasks, completedTasks }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
