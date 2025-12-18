// backend/src/controllers/liveorders.controller.js
const { addClient } = require("../utils/sse");
const { listKitchenOrders } = require("../utils/orders.db");

exports.sseHandler = (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
  } catch (e) {}

  try {
    res.write(
      `data: ${JSON.stringify({ event: "connected", ts: Date.now() })}\n\n`
    );
  } catch (e) {}
  addClient(res);
};

exports.listKitchen = async (req, res) => {
  try {
    const rows = await listKitchenOrders();

    const KITCHEN_STATUSES = new Set(["new", "preparing", "prepared"]);

    const filtered = (rows || []).filter((r) => {
      const s = r && r.status ? String(r.status).toLowerCase().trim() : "";
      return KITCHEN_STATUSES.has(s);
    });

    const normalized = filtered.map((order) => {
      const o = { ...order };

      try {
        if (o.payload && typeof o.payload === "string") {
          o.payload = JSON.parse(o.payload);
        }
      } catch (e) {}

      o.payload = o.payload || {};
      o.payload.items = Array.isArray(o.payload.items) ? o.payload.items : [];

      const customer = {};
      if (o.customer_name) customer.name = o.customer_name;
      if (o.customer_phone) customer.phone = o.customer_phone;
      if (o.customer_address) customer.address = o.customer_address;

      // fallback to payload fields
      if (!customer.name && o.payload.name) customer.name = o.payload.name;
      if (!customer.phone && o.payload.phone) customer.phone = o.payload.phone;

      // 🔥 FIX — read nested payload.customer.*
      if (!customer.name && o.payload.customer && o.payload.customer.name) {
        customer.name = o.payload.customer.name;
      }
      if (!customer.phone && o.payload.customer && o.payload.customer.phone) {
        customer.phone = o.payload.customer.phone;
      }
      if (
        !customer.address &&
        o.payload.customer &&
        o.payload.customer.address
      ) {
        customer.address = o.payload.customer.address;
      }

      // existing fallback for flat payload.address
      if (!customer.address && o.payload.address)
        customer.address = o.payload.address;

      // final fallback
      if (!customer.address && o.address) customer.address = o.address;
      if (!customer.name && o.notes)
        customer.name = o.notes?.split("\n")?.[0] || o.notes;

      o.customer = customer;

      return o;
    });

    return res.json({ orders: normalized });
  } catch (err) {
    console.error("listKitchen error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
