'use strict';
const express = require('express');
const router  = express.Router();
const { verify, requireAdmin } = require('../controllers/authController');
const ctrl = require('../controllers/roomController');

router.get('/',          verify, ctrl.list);
router.get('/all',       verify, requireAdmin, ctrl.listAll);
router.patch('/:id',     verify, requireAdmin, ctrl.update);

module.exports = router;
