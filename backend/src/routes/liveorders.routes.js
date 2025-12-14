const express = require("express");
const router = express.Router();
const { addClient } = require("../utils/sse");
const { listKitchen } = require("../controllers/liveorders.controller");

// ✅ SINGLE SSE SYSTEM
router.get("/", (req, res) => {
  addClient(res);
});

// Kitchen current queue
router.get("/list", listKitchen);

module.exports = router;
