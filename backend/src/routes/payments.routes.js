// backend/src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const controller = require("../controllers/payments.controller");
const auth = require("../middlewares/auth.middleware"); // ensure this path is correct

// Create PaymentIntent + create pending order (protected)
router.post("/create-payment-intent", auth, controller.createPaymentIntent);

// Cancel a PaymentIntent + cancel order (protected)
router.post("/cancel-payment-intent", auth, controller.cancelPaymentIntent);
// Cash order
router.post("/cash", auth, controller.createCashOrder);

// Stripe Webhook (handled separately, raw body required) - DO NOT protect this route
router.post("/webhook", controller.handleStripeWebhook);

module.exports = router;
