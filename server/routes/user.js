'use strict';
const express = require('express');
const router  = express.Router();
const { verify, requireAdmin } = require('../controllers/authController');
const ctrl = require('../controllers/userController');

router.get('/',                  verify, requireAdmin, ctrl.list);
router.get('/stats',             verify, requireAdmin, ctrl.stats);
router.get('/export-csv',        verify, requireAdmin, ctrl.exportCSV);
router.patch('/:id',             verify, requireAdmin, ctrl.update);
router.post('/:id/reset-password', verify, requireAdmin, ctrl.resetPassword);
router.delete('/:id',            verify, requireAdmin, ctrl.remove);

module.exports = router;
