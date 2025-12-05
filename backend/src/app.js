

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

/**
 * CORS config:
 * - If FRONTEND_URL is set in env (recommended), allow only that origin.
 * - Otherwise allow any origin (useful for quick testing; tighten for production).
 */
const frontendOrigin = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || process.env.VITE_API_URL;
const corsOptions = frontendOrigin
  ? { origin: frontendOrigin, credentials: true }
  : { origin: true, credentials: true }; // echo origin, allow credentials

app.use(cors(corsOptions));




// ✅ VERY IMPORTANT: mount webhook BEFORE express.json()
// Webhooks (Stripe etc.) need raw body to validate signatures.
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

// ❗ Now it's safe to enable express.json()
app.use(express.json());

// health
app.get("/", (req, res) => res.json({ ok: true }));

/**
 * Mount routes on BOTH the /api/... namespace AND the short form /... namespace.
 * This provides backward compatibility for clients that use /auth/login instead of /api/auth/login.
 * Example: both POST /auth/login and POST /api/auth/login will be handled by authRoutes.
 */

app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/auth', '/auth'], userRoutes);

app.use(['/api/protected', '/protected'], protectedRoutes);

app.use(['/api/menu', '/menu'], menuRoutes);

app.use(['/api/payments', '/payments'], paymentRoutes);

app.use(['/api/orders', '/orders'], ordersRoutes);

// orders-list (admin/reporting) — mounted under the same base so /api/orders/list and /orders/list work
app.use(['/api/orders', '/orders'], ordersListRoutes);

// live orders SSE
app.use(['/api/live-orders', '/live-orders'], liveordersRoutes);

// addresses
app.use(['/api/addresses', '/addresses'], addressesRoutes);

// serve uploads if needed (optional — your server.js already mounts /uploads after listen in many setups)
// Uncomment if you want app to serve uploads directly:
// app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  return res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

module.exports = app;


