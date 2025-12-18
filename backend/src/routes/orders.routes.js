const express = require("express");
const router = express.Router();

const {
  listOrders,
  getOrderByPid,
  changePaymentMethod,
  adjustOrderEta,
} = require("../controllers/orders.controller");

const {
  updateOrderStatus,
  markOrderAsPaid,
} = require("../controllers/orderStatus.controller");

const auth = require("../middlewares/auth.middleware");

// GET /api/orders
router.get("/", auth, listOrders);

// GET /api/orders/by-pid/:pid
router.get("/by-pid/:pid", auth, getOrderByPid);

// PATCH /api/orders/:id  → update order status
router.patch("/:id", auth, updateOrderStatus);

// PATCH /api/orders/:id/payment-method → CASH / CARD
router.patch("/:orderUid/payment-method", auth, changePaymentMethod);

// PATCH /api/orders/:id/pay → mark order as PAID
router.patch("/:id/pay", auth, markOrderAsPaid);

// POST /api/orders/:id/adjust_eta
router.post("/:id/adjust_eta", auth, adjustOrderEta);

module.exports = router;
