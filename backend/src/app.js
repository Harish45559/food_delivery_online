// backend/src/app.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const protectedRoutes = require("./routes/protected.routes");
const menuRoutes = require("./routes/menu.routes");
const paymentRoutes = require("./routes/payments.routes");
const ordersRoutes = require("./routes/orders.routes");
const liveordersRoutes = require("./routes/liveorders.routes");
const webhookRoute = require("./routes/webhook.routes");
const ordersListRoutes = require("./routes/ordersList.routes");
const addressesRoutes = require("./routes/addresses.routes");

const app = express();
app.use(cors());

// ✅ VERY IMPORTANT: mount webhook BEFORE express.json()
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

// ❗ Now it's safe to enable express.json()
app.use(express.json());

// health
app.get("/", (req, res) => res.json({ ok: true }));

// mount auth routes (register, login, forgot, reset)
app.use("/api/auth", authRoutes);
app.use("/api/auth", userRoutes);

// protected example
app.use("/api/protected", protectedRoutes);

// menu
app.use("/api/menu", menuRoutes);

// payments
app.use("/api/payments", paymentRoutes);

// orders (existing routes)
app.use("/api/orders", ordersRoutes);

// orders-list (admin/reporting) — mounted under the same base so /api/orders/list works
app.use("/api/orders", ordersListRoutes);

// live orders SSE
app.use("/api/live-orders", liveordersRoutes);

// addresses
app.use("/api/addresses", addressesRoutes);

// error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  return res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

module.exports = app;
