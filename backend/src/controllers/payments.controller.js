// backend/src/controllers/payments.controller.js
require("dotenv").config();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const {
  addOrder,
  updateOrderStatusByPid,
  getOrderByPid,
  deleteOrderByPid,
} = require("../utils/orders.db");
const { broadcastSse } = require("../utils/sse");

const MINIMUM_PENCE = 50;

function normalizeIncomingBody(body) {
  let items = [];
  let notes = null;

  if (Array.isArray(body)) {
    items = body;
    return { items, notes };
  }

  if (body && typeof body === "object") {
    if (body.items !== undefined) {
      if (Array.isArray(body.items)) {
        items = body.items;
      } else if (body.items && typeof body.items === "object") {
        if (Array.isArray(body.items.items)) {
          items = body.items.items;
          if (typeof body.items.notes === "string") {
            notes = body.items.notes;
          }
        } else {
          const arrayLikeKeys = Object.keys(body.items).filter((k) =>
            /^[0-9]+$/.test(k)
          );
          if (arrayLikeKeys.length > 0) {
            arrayLikeKeys.sort((a, b) => Number(a) - Number(b));
            items = arrayLikeKeys.map((k) => body.items[k]);
          } else {
            items = [];
          }
        }
      } else {
        items = [];
      }
    } else {
      const topArrayLikeKeys = Object.keys(body).filter((k) =>
        /^[0-9]+$/.test(k)
      );
      if (topArrayLikeKeys.length > 0) {
        topArrayLikeKeys.sort((a, b) => Number(a) - Number(b));
        items = topArrayLikeKeys.map((k) => body[k]);
      } else {
        items = [];
      }
    }

    if (typeof body.notes === "string" && body.notes.trim() !== "") {
      notes = body.notes;
    } else if (
      notes == null &&
      body.items &&
      typeof body.items === "object" &&
      typeof body.items.notes === "string"
    ) {
      notes = body.items.notes;
    } else if (
      notes == null &&
      typeof body.notes !== "undefined" &&
      body.notes != null
    ) {
      notes = String(body.notes);
    } else if (notes == null) {
      notes = null;
    }
  }

  return { items, notes };
}

exports.createPaymentIntent = async (req, res) => {
  try {
    const {
      items = [],
      notes = null,
      customer = null,
      delivery_type = "pickup",
    } = req.body || {};

    /* ---------------------------------------
       Mandatory backend validation
       (Protects API even if frontend is bypassed)
    --------------------------------------- */
    if (!customer || !customer.name || !customer.name.trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }

    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    // Defensive: no items
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    /* ---------------------------------------
       Compute total amount
    --------------------------------------- */
    const totalPence = (items || []).reduce((sum, item) => {
      const qty = Number(item?.qty || 1);
      const price =
        typeof item.price_gbp !== "undefined"
          ? Number(item.price_gbp)
          : typeof item.price !== "undefined"
          ? Number(item.price)
          : item.price_pence
          ? Number(item.price_pence)
          : 0;

      const pricePence =
        typeof item.price_gbp !== "undefined"
          ? Math.round(Number(item.price_gbp) * 100)
          : typeof item.price !== "undefined"
          ? Math.round(Number(item.price) * 100)
          : Math.round(Number(price));

      return sum + pricePence * qty;
    }, 0);

    if (totalPence < MINIMUM_PENCE) {
      return res.status(400).json({
        error: `Amount too small. Minimum is ${MINIMUM_PENCE} pence. Computed amount: ${totalPence} pence.`,
      });
    }

    const userIdRaw = req.user?.sub || req.user?.id || req.user?.userId;
    const userId = userIdRaw ? String(userIdRaw) : null;

    /* ---------------------------------------
       Build payload to store in DB
    --------------------------------------- */
    const payloadToSave = {
      items,
      ...(notes ? { notes } : {}),
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        address: customer.address?.trim() || "",
      },
    };

    /* ---------------------------------------
       Create Stripe PaymentIntent
    --------------------------------------- */
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPence,
      currency: "gbp",
      metadata: {
        user_id: userId || "",
      },
    });

    /* ---------------------------------------
       Insert order into DB
    --------------------------------------- */
    const order = await addOrder({
      user_id: userId ? Number(userId) : null,
      stripe_pid: paymentIntent.id,
      status: "pending",
      total_gbp: totalPence / 100,
      payload: JSON.stringify(payloadToSave),
      notes: notes || null,
      customer_name: customer.name.trim(),
      customer_phone: customer.phone.trim(),
      customer_address: customer.address?.trim() || null,
      paid_by: "card",
      delivery_type,
    });

    if (order) broadcastSse({ event: "order_created", order });

    console.log("✅ Created PaymentIntent and order:", {
      paymentIntentId: paymentIntent.id,
      orderId: order?.id,
      clientSecret: paymentIntent.client_secret,
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      stripe_pid: paymentIntent.id,
      order: order || null,
    });
  } catch (err) {
    console.error("❌ Error in createPaymentIntent:", err);
    if (err && err.type === "StripeInvalidRequestError") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

/**
 * Cancel PaymentIntent endpoint
 * POST /api/payments/cancel-payment-intent
 * body: { payment_intent_id: "pi_..." }
 *
 * Cancels the PaymentIntent at Stripe, then marks the DB order as 'cancelled'
 * (or deletes it if you prefer). This is safe to call even if intent is already completed.
 */
exports.cancelPaymentIntent = async (req, res) => {
  try {
    const pid = req.body?.payment_intent_id || req.body?.stripe_pid;
    if (!pid)
      return res.status(400).json({ error: "payment_intent_id required" });

    // Attempt to cancel at Stripe (may fail if already succeeded)
    try {
      await stripe.paymentIntents.cancel(pid);
    } catch (stripeErr) {
      // log but continue to update DB
      console.warn(
        "stripe cancel error (non-fatal):",
        stripeErr && stripeErr.message
      );
    }

    // Mark order cancelled in DB (we keep a record)
    try {
      await updateOrderStatusByPid(pid, "cancelled");
      // optionally, you may prefer to delete the order:
      // await deleteOrderByPid(pid);
    } catch (dbErr) {
      console.warn("Failed to mark order cancelled for pid:", pid, dbErr);
    }

    // Optionally broadcast SSE to update UIs
    try {
      const order = await getOrderByPid(pid);
      if (order) broadcastSse({ event: "order_cancelled", order });
    } catch (e) {
      // non-fatal
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("cancelPaymentIntent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  console.log("[webhook] headers:", req.headers["stripe-signature"]);
  try {
    console.log("[webhook] raw body length:", req.body && req.body.length);
    console.log(
      "[webhook] raw body preview:",
      req.body ? req.body.toString().slice(0, 1000) : "<missing>"
    );
  } catch (e) {
    console.warn("[webhook] cannot log raw body", e);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ Webhook received:", event.type);

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;

    console.log("💰 PaymentIntent succeeded:", pi.id);

    try {
      const updated = await updateOrderStatusByPid(pi.id, "paid");
      console.log("📝 Order update result:", updated);

      const order = await getOrderByPid(pi.id);
      console.log("📦 Order after update:", order);

      try {
        if (order) {
          if (typeof order.payload === "string") {
            order.payload = JSON.parse(order.payload);
          }
          if (!order.payload || typeof order.payload !== "object") {
            order.payload = {};
          }

          if (order.notes && !order.payload.notes) {
            order.payload.notes = order.notes;
          }
        }
      } catch (e) {
        console.error("Failed to merge notes into payload:", e);
      }

      broadcastSse({ event: "order_paid", order });
      console.log("📢 SSE broadcast sent.");
    } catch (err) {
      console.error("❌ Error updating order DB:", err);
    }
  }

  // also respond to canceled intents via webhook if desired
  if (event.type === "payment_intent.canceled") {
    const pi = event.data.object;
    console.log("⚠️ PaymentIntent canceled webhook:", pi.id);
    try {
      await updateOrderStatusByPid(pi.id, "cancelled");
      const order = await getOrderByPid(pi.id);
      if (order) broadcastSse({ event: "order_cancelled", order });
    } catch (err) {
      console.warn("Failed to mark cancelled from webhook:", err);
    }
  }

  res.status(200).send("OK");
};

// payments.controller.js — createCashOrder (Option A, stripe_pid can be NULL)
exports.createCashOrder = async (req, res) => {
  try {
    const { items = [], notes = null, customer = null } = req.body || {};

    if (!customer || !customer.name || !customer.name.trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }

    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const totalPence = (items || []).reduce((sum, item) => {
      const qty = Number(item?.qty || 1);
      const price =
        typeof item.price_gbp !== "undefined"
          ? Number(item.price_gbp)
          : typeof item.price !== "undefined"
          ? Number(item.price)
          : item.price_pence
          ? Number(item.price_pence) / 100
          : 0;
      return sum + Math.round(price * 100) * qty;
    }, 0);

    const total_gbp = totalPence / 100;
    const userIdRaw = req.user?.sub || req.user?.id || req.user?.userId;
    const user_id = userIdRaw ? Number(userIdRaw) : null;

    const payloadToSave = {
      items,
      ...(notes ? { notes } : {}),
      ...(customer ? { customer } : {}),
    };

    const order = await addOrder({
      user_id,
      stripe_pid: null, // allowed to be null (Option A)
      status: "paid", // CASH -> mark as paid immediately
      total_gbp,
      payload: JSON.stringify(payloadToSave),
      notes: notes || null,
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      customer_address: customer?.address || null,
      paid_by: "cash",
    });

    if (order) broadcastSse({ event: "order_created", order });

    return res.json({ order });
  } catch (err) {
    console.error("createCashOrder error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
