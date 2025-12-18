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

// 🔥 STATIC FILES (frontend public)
app.use(express.static(path.join(__dirname, "../../frontend/public")));

/**
 * CORS config:
 * - If FRONTEND_URL is set in env (recommended), allow only that origin.
 * - Otherwise allow any origin (useful for quick testing; tighten for production).
 */
const frontendOrigin =
  process.env.FRONTEND_URL ||
  process.env.VITE_FRONTEND_URL ||
  process.env.VITE_API_URL;

const corsOptions = frontendOrigin
  ? { origin: frontendOrigin, credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));

/* -------------------------------------------------------
   ✅ TRUST PROXY (Cloudflare / Render)
------------------------------------------------------- */
app.set("trust proxy", true);

/* -------------------------------------------------------
   ✅ RAW BODY FOR WEBHOOKS (Stripe etc.)
------------------------------------------------------- */
app.use("/webhook", bodyParser.raw({ type: "application/json" }), webhookRoute);

/* -------------------------------------------------------
   ❗ Enable express.json() for all standard routes
------------------------------------------------------- */
app.use(express.json());

/* -------------------------------------------------------
   ✅ STABLE REQUEST LOGGER
   (lightweight, shows proxy, body length, etc.)
------------------------------------------------------- */
app.use((req, res, next) => {
  console.log(
    `[REQ] ${req.method} ${req.originalUrl} :: content-type=${
      req.headers["content-type"] || "none"
    }, content-length=${req.headers["content-length"] || "none"}`
  );
  next();
});

/* -------------------------------------------------------
   ✅ DEFENSIVE EMPTY JSON-BODY HANDLER
   Prevents silent 200 when proxies strip bodies.
------------------------------------------------------- */
app.use((req, res, next) => {
  if (
    ["POST", "PUT", "PATCH"].includes(req.method) &&
    req.is("application/json")
  ) {
    const bodyWasEmpty =
      !req.body ||
      (Object.keys(req.body).length === 0 &&
        req.headers["content-length"] !== "0");

    if (bodyWasEmpty) {
      console.warn(
        `[WARN] Empty or missing JSON body for ${req.method} ${req.originalUrl}`
      );
      return res.status(400).json({
        message:
          "Empty or missing JSON body. Ensure Content-Type: application/json and include a valid JSON payload.",
      });
    }
  }
  next();
});

/* -------------------------------------------------------
   HEALTH CHECK
------------------------------------------------------- */
app.get("/", (req, res) => res.json({ ok: true }));

/* -------------------------------------------------------
   ROUTES
------------------------------------------------------- */

app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/auth", "/auth"], userRoutes);

app.use(["/api/protected", "/protected"], protectedRoutes);

app.use(["/api/menu", "/menu"], menuRoutes);

app.use(["/api/payments", "/payments"], paymentRoutes);

app.use(["/api/orders", "/orders"], ordersRoutes);

app.use(["/api/orders", "/orders"], ordersListRoutes);

app.use(["/api/live-orders", "/live-orders"], liveordersRoutes);

app.use(["/api/addresses", "/addresses"], addressesRoutes);

/* -------------------------------------------------------
   OPTIONAL STATIC (uploads)
------------------------------------------------------- */
// app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* -------------------------------------------------------
   ❗ JSON 404 HANDLER (prevents silent empty responses)
------------------------------------------------------- */
app.use((req, res) => {
  return res.status(404).json({ message: "Route not found" });
});

/* -------------------------------------------------------
   GLOBAL ERROR HANDLER
------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  return res
    .status(err.status || 500)
    .json({ message: err.message || "Server error" });
});

module.exports = app;
