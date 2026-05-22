'use strict';
const express = require('express');
const router  = express.Router();
const { login, register, me, updateProfile, verify, refresh, logout } = require('../controllers/authController');

router.post('/login',    login);
router.post('/register', register);
router.post('/refresh',  refresh);   // ← NEW: 토큰 갱신
router.post('/logout',   logout);    // ← NEW: 로그아웃 (RT 폐기)
router.get('/me',        verify, me);
router.patch('/profile', verify, updateProfile);

module.exports = router;
