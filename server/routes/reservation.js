'use strict';
const express = require('express');
const router  = express.Router();
const { verify, requireAdmin } = require('../controllers/authController');
const ctrl = require('../controllers/reservationController');

router.get('/mine',         verify, ctrl.myReservations);
router.get('/team',         verify, ctrl.teamReservations);
router.get('/calendar',     verify, ctrl.calendarAll);
router.get('/public-stats', verify, ctrl.publicStats);
router.get('/all',          verify, requireAdmin, ctrl.all);
router.get('/stats',        verify, requireAdmin, ctrl.stats);
router.post('/',            verify, ctrl.create);
router.patch('/:id/cancel', verify, ctrl.cancel);

module.exports = router;
router.get('/room-status',  verify, ctrl.roomStatus);
