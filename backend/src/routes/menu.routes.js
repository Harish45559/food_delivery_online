// backend/src/routes/menu.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/menu.controller');
const auth = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isAdmin.middleware');

// public
router.get('/categories', ctrl.listCategories);
router.get('/items', ctrl.listItems);

// admin protected
router.get('/admin/categories', auth, isAdmin, ctrl.adminListCategories);
router.post('/admin/categories', auth, isAdmin, ctrl.createCategory);
router.put('/admin/categories/:id', auth, isAdmin, ctrl.updateCategory);
router.delete('/admin/categories/:id', auth, isAdmin, ctrl.deleteCategory);

router.post('/admin/items', auth, isAdmin, ctrl.adminCreateItem);
router.put('/admin/items/:id', auth, isAdmin, ctrl.adminUpdateItem);
router.delete('/admin/items/:id', auth, isAdmin, ctrl.adminDeleteItem);

module.exports = router;
