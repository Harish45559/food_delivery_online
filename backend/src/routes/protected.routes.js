const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');

router.get('/secret', auth, (req, res) => {
  res.json({ secret: 'this is protected data', user: req.user });
});

module.exports = router;
