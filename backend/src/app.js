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
   CORS CONFIG — Works for both LOCAL & PRODUCTION
------------------------------------------------------------ */

const FRONTEND =
  process.env.FRONTEND_URL ||     // for Render
  process.env.VITE_FRONTEND_URL || // for Vite env
  "http://localhost:5173";         // fallback for local

console.log("CORS Allowed Origin:", FRONTEND);

app.use(
  cors({
    origin: FRONTEND,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* -----------------------------------------------------------
   IMPORTANT: Webhook must receive RAW body (Stripe, etc.)
------------------------------------------------------------ */
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

/* -----------------------------------------------------------
   Normal JSON body parser after webhook
------------------------------------------------------------ */
app.use(express.json());

/* -----------------------------------------------------------
   Health check
------------------------------------------------------------ */
app.get("/", (req, res) => res.json({ ok: true }));

/* -----------------------------------------------------------
   API ROUTES — Production-safe
   Only expose `/api/...` versions to avoid confusion.
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
   Serve uploaded images (optional)
------------------------------------------------------------ */
// app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* -----------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Server error"
  });
});

module.exports = app;
