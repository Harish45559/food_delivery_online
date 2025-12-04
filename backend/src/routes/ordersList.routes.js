// backend/src/routes/ordersList.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/ordersList.controller");
// Optional: require auth middleware if you have one:
// const auth = require("../middlewares/auth.middleware");

router.get("/list", /* auth, */ controller.listOrders);

module.exports = router;
