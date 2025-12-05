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

/* -----------------------------------------------------------
   CORS CONFIG — Supports multiple origins (local + production)
------------------------------------------------------------ */

// Read multiple allowed origins from env:
// Example: FRONTEND_URLS="http://localhost:5173,https://food-delivery-online-1.onrender.com"
const allowedListRaw =
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  process.env.VITE_FRONTEND_URL ||
  "http://localhost:5173"; // fallback for local

const allowedList = allowedListRaw
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

console.log("CORS Whitelist:", allowedList);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow curl/postman
      if (allowedList.includes(origin)) return callback(null, true);

      console.warn("CORS blocked origin:", origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* -----------------------------------------------------------
   Webhook must receive RAW body (Stripe)
------------------------------------------------------------ */
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

/* -----------------------------------------------------------
   JSON Parser (after webhook)
------------------------------------------------------------ */
app.use(express.json());

/* -----------------------------------------------------------
   Health check
------------------------------------------------------------ */
app.get("/", (req, res) => res.json({ ok: true }));

/* -----------------------------------------------------------
   API ROUTES
------------------------------------------------------------ */
app.use("/api/auth", authRoutes);
app.use("/api/auth", userRoutes);

app.use("/api/protected", protectedRoutes);

app.use("/api/menu", menuRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/orders", ordersRoutes);
app.use("/api/orders", ordersListRoutes);

app.use("/api/live-orders", liveordersRoutes);

app.use("/api/addresses", addressesRoutes);

/* -----------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

module.exports = app;
