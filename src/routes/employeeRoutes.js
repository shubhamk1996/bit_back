// backend/src/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authenticate = require('../middlewares/auth');
const roleGuard = require('../middlewares/roleGuard');

router.get('/', authenticate, roleGuard('admin'), employeeController.getAllEmployees);
router.get('/public/department/:department', employeeController.getEmployeesByDepartment);
router.get('/department/:department', authenticate, employeeController.getEmployeesByDepartment);
router.get('/salary-incentive', authenticate, roleGuard('admin'), employeeController.getSalaryIncentive);
router.get('/payouts', authenticate, roleGuard('admin'), employeeController.getPayoutsByDate);
router.get('/dashboard', authenticate, roleGuard('employee'), employeeController.getEmployeeDashboard);
router.post('/', authenticate, roleGuard('admin'), employeeController.createEmployee);
router.put('/:id', authenticate, roleGuard('admin'), employeeController.updateEmployee);
router.delete('/:id', authenticate, roleGuard('admin'), employeeController.deleteEmployee);

module.exports = router;
