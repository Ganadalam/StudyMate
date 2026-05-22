'use strict';
const router = require('express').Router();
const { verify } = require('../controllers/authController');
const ctrl   = require('../controllers/taskController');

router.get   ('/reservations/:resId/tasks', verify, ctrl.list);
router.post  ('/reservations/:resId/tasks', verify, ctrl.create);
router.patch ('/tasks/:id/toggle',          verify, ctrl.toggle);
router.patch ('/tasks/:id',                 verify, ctrl.update);
router.delete('/tasks/:id',                 verify, ctrl.remove);

module.exports = router;
