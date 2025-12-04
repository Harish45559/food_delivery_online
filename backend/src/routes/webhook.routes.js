// backend/src/routes/webhook.routes.js
const express = require("express");
const router = express.Router();
const { handleStripeWebhook } = require("../controllers/payments.controller");

// NOTE: do NOT use bodyParser.raw() here — app.js already applies it.
// If you add raw parsing here as well the request body will be consumed twice and Stripe signatures will fail.
router.post("/", handleStripeWebhook);

module.exports = router;
