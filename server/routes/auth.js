'use strict';
const express = require('express');
const router  = express.Router();
const { login, register, me, updateProfile, verify } = require('../controllers/authController');

router.post('/login',    login);
router.post('/register', register);
router.get('/me',        verify, me);
router.patch('/profile', verify, updateProfile);

module.exports = router;
