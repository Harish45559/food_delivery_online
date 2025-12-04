// backend/src/routes/liveorders.routes.js
const express = require("express");
const router = express.Router();
const {
  sseHandler,
  listKitchen,
} = require("../controllers/liveorders.controller");

// SSE stream (GET /api/live-orders/)
router.get("/", sseHandler);

// Kitchen current queue (GET /api/live-orders/list)
router.get("/list", listKitchen);

module.exports = router;
