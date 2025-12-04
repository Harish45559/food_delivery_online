// backend/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/me', auth, ctrl.me);
router.put('/me', auth, ctrl.updateMe);

module.exports = router;
