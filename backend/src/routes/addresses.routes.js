// backend/src/routes/addresses.routes.js
const express = require("express");
const router = express.Router();

// load controller
const addresses = require("../controllers/addresses.controller");

// attempt to load authenticate middleware, fall back to a pass-through
let authenticate;
try {
  // adjust path if your middleware file is located elsewhere
  // e.g. "../middlewares/auth.middleware" or "../middleware/auth"
  const authModule = require("../middlewares/auth.middleware");
  authenticate =
    authModule && (authModule.authenticate || authModule.default || authModule);
  if (typeof authenticate !== "function") {
    // when your middleware exports an object, find a function inside
    const maybe = Object.values(authModule).find(
      (v) => typeof v === "function"
    );
    authenticate = maybe || ((req, res, next) => next());
  }
} catch (err) {
  // middleware not present — use a no-op so routes still work
  authenticate = (req, res, next) => next();
  console.warn(
    "Auth middleware not found or failed to load; routes will be public. Error:",
    err && err.message
  );
}

// helper to ensure we pass functions to router
function fnOr404(fnName) {
  const fn = addresses && addresses[fnName];
  if (typeof fn !== "function") {
    // return a handler that responds 500 and logs helpful message
    return (req, res) => {
      console.error(`Controller missing function: addresses.${fnName}`);
      res
        .status(500)
        .json({
          error: `Server misconfiguration: addresses.${fnName} not found`,
        });
    };
  }
  return fn;
}

// Routes
router.get("/", authenticate, fnOr404("getAddresses"));
router.post("/", authenticate, fnOr404("createAddress"));
router.patch("/:id", authenticate, fnOr404("updateAddress"));
router.delete("/:id", authenticate, fnOr404("deleteAddress"));

module.exports = router;
