// backend/src/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticate = require('../middlewares/auth');
const roleGuard = require('../middlewares/roleGuard');

router.get('/popup', authenticate, roleGuard('admin'), taskController.getTasksPopup);
router.get('/my-tasks', authenticate, roleGuard('client'), taskController.getMyTasks);
router.get('/order/:orderId', authenticate, taskController.getTasksByOrder);
router.put('/:id/status', authenticate, taskController.updateTaskStatus);

module.exports = router;
