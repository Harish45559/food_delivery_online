// backend/src/controllers/ordersList.controller.js
// Uses your existing utils/orders.db.js helpers (pool + listAllOrders)
const { listAllOrders } = require("../utils/orders.db");

/**
 * normalizePayload: ensure payload is an object with items array
 */
function normalizePayload(p) {
  if (!p) return { items: [] };
  if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p);
      parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
      return parsed;
    } catch (e) {
      return { raw: p, items: [] };
    }
  }
  if (typeof p === "object") {
    return { ...p, items: Array.isArray(p.items) ? p.items : [] };
  }
  return { items: [] };
}

/**
 * GET /api/orders/list
 * Query params supported:
 *  - start (ISO datetime)
 *  - end   (ISO datetime)
 *  - q     (free text: name/phone/address or payload)
 *  - id    (order id)
 *  - status (string)
 *  - page (1..)
 *  - limit (items per page)
 *  - sort  (created_at_desc|created_at_asc|total_desc|total_asc)
 *
 * NOTE: This implementation loads all orders via listAllOrders()
 * and filters in memory. That is simplest to integrate with your existing
 * orders.db helpers. If your dataset grows very large you can convert this
 * to server-side SQL with parameterized queries (I can help adapt it).
 */
exports.listOrders = async (req, res) => {
  try {
    const qRaw = (req.query.q || "").trim();
    const idReq = req.query.id ? Number(req.query.id) : null;
    const statusReq = (req.query.status || "").trim().toLowerCase();
    const start = req.query.start ? new Date(req.query.start) : null;
    const end = req.query.end ? new Date(req.query.end) : null;
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 25)));
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = (page - 1) * limit;
    const sort = req.query.sort || "created_at_desc";

    // Load all orders using your helper
    const rows = await listAllOrders(); // uses pool.query internally (see utils/orders.db.js). :contentReference[oaicite:1]{index=1}

    // Normalize and filter in JS
    const filtered = (rows || []).filter((r) => {
      // Filter by id
      if (idReq && Number(r.id) !== idReq) return false;

      // Filter by status
      if (statusReq) {
        const s = r.status ? String(r.status).toLowerCase().trim() : "";
        if (s !== statusReq) return false;
      }

      // Filter by start/end (created_at is a Date or string)
      if (start) {
        const ct = new Date(r.created_at);
        if (isNaN(ct.getTime()) || ct < start) return false;
      }
      if (end) {
        const ct = new Date(r.created_at);
        if (isNaN(ct.getTime()) || ct > end) return false;
      }

      // Free-text search (q) across customer_name, phone, address and payload text
      if (qRaw) {
        const q = qRaw.toLowerCase();
        const name = (r.customer_name || "").toString().toLowerCase();
        const phone = (r.customer_phone || "").toString().toLowerCase();
        const addr = (r.customer_address || "").toString().toLowerCase();
        const payloadText =
          r.payload && typeof r.payload === "string"
            ? r.payload.toLowerCase()
            : r.payload && typeof r.payload === "object"
            ? JSON.stringify(r.payload).toLowerCase()
            : "";
        if (
          !(
            name.includes(q) ||
            phone.includes(q) ||
            addr.includes(q) ||
            payloadText.includes(q)
          )
        )
          return false;
      }

      return true;
    });

    // total count & revenue (before pagination)
    const total_count = filtered.length;
    const total_revenue = filtered.reduce((s, o) => {
      const v =
        o.total_gbp === null || o.total_gbp === undefined
          ? 0
          : Number(o.total_gbp);
      return s + (isNaN(v) ? 0 : v);
    }, 0);

    // sorting
    const sorted = filtered.sort((a, b) => {
      if (sort === "created_at_asc") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sort === "created_at_desc") {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sort === "total_asc") {
        return (Number(a.total_gbp) || 0) - (Number(b.total_gbp) || 0);
      }
      if (sort === "total_desc") {
        return (Number(b.total_gbp) || 0) - (Number(a.total_gbp) || 0);
      }
      // default: created_at_desc
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // pagination
    const paged = sorted.slice(offset, offset + limit);

    // normalize payloads
    const normalized = paged.map((r) => {
      const copy = { ...r };
      copy.payload = normalizePayload(copy.payload);
      return copy;
    });

    return res.json({
      total_count,
      total_revenue: Number(total_revenue.toFixed(2)),
      orders: normalized,
    });
  } catch (err) {
    console.error("ordersList.listOrders error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
