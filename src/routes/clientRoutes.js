// backend/src/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authenticate = require('../middlewares/auth');
const roleGuard = require('../middlewares/roleGuard');
const upload = require('../middlewares/upload');

router.get('/', authenticate, roleGuard('admin'), clientController.getAllClients);
router.get('/dashboard-stats', authenticate, roleGuard('admin'), clientController.getDashboardStats);
router.get('/my-orders', authenticate, roleGuard('client'), clientController.getMyOrders);
router.get('/:id', authenticate, roleGuard('admin'), clientController.getClientById);
router.post('/', authenticate, roleGuard('admin'), upload.single('requirement_snapshot'), clientController.createClient);
router.put('/:id', authenticate, roleGuard('admin'), upload.single('requirement_snapshot'), clientController.updateClient);
router.delete('/:id', authenticate, roleGuard('admin'), clientController.deleteClient);

module.exports = router;
