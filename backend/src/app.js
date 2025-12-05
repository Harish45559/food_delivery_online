// backend/src/app.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
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
   CORS: support comma-separated FRONTEND_URLS or single FRONTEND_URL
------------------------------------------------------------ */
const allowedListRaw =
  (process.env.FRONTEND_URLS && process.env.FRONTEND_URLS.trim()) ||
  process.env.FRONTEND_URL ||
  process.env.VITE_FRONTEND_URL ||
  "http://localhost:5173";

const allowedList = allowedListRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("CORS Whitelist:", allowedList);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (curl/postman/server-to-server)
      if (!origin) return callback(null, true);
      if (allowedList.includes(origin)) return callback(null, true);
      console.warn("CORS blocked origin:", origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  })
);

/* -----------------------------------------------------------
   Webhook (must be BEFORE express.json() and BEFORE static fallback)
   Example: Stripe webhook needs raw body to validate signatures.
------------------------------------------------------------ */
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

/* -----------------------------------------------------------
   Normal JSON parser for API routes (after webhook)
------------------------------------------------------------ */
app.use(express.json());

/* -----------------------------------------------------------
   Health check
------------------------------------------------------------ */
app.get("/health", (req, res) => res.json({ ok: true }));

/* -----------------------------------------------------------
   API ROUTES
   Mount routes under both /api/... and short /... for compatibility
------------------------------------------------------------ */
app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/auth", "/auth"], userRoutes);

app.use(["/api/protected", "/protected"], protectedRoutes);

app.use(["/api/menu", "/menu"], menuRoutes);

app.use(["/api/payments", "/payments"], paymentRoutes);

app.use(["/api/orders", "/orders"], ordersRoutes);
app.use(["/api/orders", "/orders"], ordersListRoutes);

app.use(["/api/live-orders", "/live-orders"], liveordersRoutes);

app.use(["/api/addresses", "/addresses"], addressesRoutes);

/* -----------------------------------------------------------
   Serve frontend static files (if built) + SPA fallback
   This must come AFTER API routes so /api/* is handled by Express routes.
------------------------------------------------------------ */
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  console.log("Serving frontend from", frontendDist);
  app.use(express.static(frontendDist));

  // For any other GET request not handled above, serve index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  console.log("No frontend build found at", frontendDist, "- skipping static serve");
}

/* -----------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  // If CORS rejected origin, express-cors will call next(err) with message; preserve status 403 for that case
  if (err && err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: "CORS error: origin not allowed" });
  }
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

module.exports = app;
