// backend/src/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middlewares/auth');
const roleGuard = require('../middlewares/roleGuard');

router.get('/', settingsController.getSettings);
router.put('/', authenticate, roleGuard('admin'), settingsController.updateSettings);

module.exports = router;
