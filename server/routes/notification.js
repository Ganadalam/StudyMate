const express = require('express');
const router  = express.Router();
const { verify, requireAdmin } = require('../controllers/authController');
const ctrl = require('../controllers/notificationController');

/* 정적 경로를 동적 경로보다 먼저 선언 */
router.post('/',             verify, requireAdmin, ctrl.create);
router.get('/admin',         verify, requireAdmin, ctrl.adminList);
router.get('/unread-count',  verify, ctrl.unreadCount);   // /:id 보다 먼저
router.patch('/read-all',    verify, ctrl.markAllRead);   // /:id 보다 먼저
router.get('/',              verify, ctrl.userList);
router.patch('/:id/read',    verify, ctrl.markRead);
router.delete('/:id',        verify, requireAdmin, ctrl.remove);

module.exports = router;
