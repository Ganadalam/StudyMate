'use strict';
const express = require('express');
const router  = express.Router();
const { verify } = require('../controllers/authController');
const ctrl = require('../controllers/favoriteController');

router.get('/',      verify, ctrl.list);
router.post('/',     verify, ctrl.create);
router.delete('/:id',verify, ctrl.remove);

module.exports = router;
