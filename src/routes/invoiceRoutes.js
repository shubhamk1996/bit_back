// backend/src/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authenticate = require('../middlewares/auth');
const roleGuard = require('../middlewares/roleGuard');

router.get('/download/:orderId', authenticate, roleGuard('admin'), invoiceController.downloadInvoice);
router.get('/client/:orderId', authenticate, invoiceController.downloadClientInvoice);
router.get('/', authenticate, roleGuard('admin'), invoiceController.getAllInvoices);

module.exports = router;
