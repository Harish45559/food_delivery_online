const express = require("express");
const router = express.Router();
const {
  listOrders,
  getOrderByPid,
} = require("../controllers/orders.controller");
const { updateOrderStatus } = require("../controllers/orderStatus.controller");
const auth = require("../middlewares/auth.middleware");

// GET /api/orders
router.get("/", auth, listOrders);

// GET /api/orders/by-pid/:pid
router.get("/by-pid/:pid", auth, getOrderByPid);

// PATCH /api/orders/:id  → mark as completed, in_progress, refunded, etc.
router.patch("/:id", auth, updateOrderStatus);

module.exports = router;
