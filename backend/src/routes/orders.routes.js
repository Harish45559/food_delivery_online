const express = require("express");
const router = express.Router();
const {
  listOrders,
  getOrderByPid,
} = require("../controllers/orders.controller");
const { updateOrderStatus } = require("../controllers/orderStatus.controller");
const auth = require("../middlewares/auth.middleware");
const { adjustOrderEta } = require("../controllers/orders.controller");

// GET /api/orders
router.get("/", auth, listOrders);

// GET /api/orders/by-pid/:pid
router.get("/by-pid/:pid", auth, getOrderByPid);

// PATCH /api/orders/:id  → mark as completed, in_progress, refunded, etc.
router.patch("/:id", auth, updateOrderStatus);

router.post("/:id/adjust_eta", auth, adjustOrderEta);

module.exports = router;
