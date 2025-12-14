const {
  listAllOrders,
  listOrdersByUser,
  getOrderByPid,
  getOrderById,
  updateOrderEtaById,
} = require("../utils/orders.db");

const { broadcastSse } = require("../utils/sse");

/**
 * Helper: normalize an order row so that:
 * - order.payload is always an object (parsed if stored as JSON string)
 * - if a separate order.notes column exists, it is merged into payload.notes
 */
function normalizeOrder(order) {
  if (!order) return order;

  const normalized = { ...order };

  // Normalize payload -> object
  let payloadObj = {};
  if (normalized.payload) {
    if (typeof normalized.payload === "string") {
      try {
        payloadObj = JSON.parse(normalized.payload);
      } catch (e) {
        // If parsing fails, still keep as raw string under a field to avoid data loss
        payloadObj = { raw: normalized.payload };
      }
    } else if (typeof normalized.payload === "object") {
      payloadObj = { ...normalized.payload };
    } else {
      payloadObj = {};
    }
  }

  // If there is a separate notes column, prefer that (but don't overwrite payload.notes if present)
  if (normalized.notes) {
    if (!payloadObj.notes || String(payloadObj.notes).trim() === "") {
      payloadObj.notes = normalized.notes;
    }
  }

  // Ensure items exists as array to avoid frontend errors (non-breaking)
  if (!Array.isArray(payloadObj.items)) {
    payloadObj.items = payloadObj.items || [];
  }

  normalized.payload = payloadObj;
  return normalized;
}

/* ----------------------------------------------------
   LIST ORDERS
   - Normal users: only their orders
   - Admin users: only their orders by default
     -> admin can override by passing ?all=true to see everything
---------------------------------------------------- */
exports.listOrders = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Extract userId from token (adjust if you use a different field)
    const userIdRaw = req.user.sub || req.user.id || req.user.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;

    // If admin requested to see all orders explicitly: /api/orders?all=true
    const wantAll = String(req.query.all || "").toLowerCase() === "true";

    if (req.user.role === "admin" && wantAll) {
      const rows = await listAllOrders();
      // normalize payloads and merge notes if present
      const normalized = (rows || []).map(normalizeOrder);
      return res.json({ orders: normalized });
    }

    // For everyone else (including admins without ?all=true) require a userId
    if (!userId) {
      return res.status(400).json({ message: "No user identifier in token" });
    }

    const orders = await listOrdersByUser(userId);
    const normalized = (orders || []).map(normalizeOrder);
    return res.json({ orders: normalized });
  } catch (err) {
    console.error("listOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------
   GET ORDER BY STRIPE PID
   - Users & admins can fetch an order by PID only if it belongs to them
   - Admins may fetch any order if they pass ?all=true
---------------------------------------------------- */
exports.getOrderByPid = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const orderRaw = await getOrderByPid(req.params.pid);
    if (!orderRaw) return res.status(404).json({ message: "Order not found" });

    const order = normalizeOrder(orderRaw);

    const userIdRaw = req.user.sub || req.user.id || req.user.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;
    const wantAll = String(req.query.all || "").toLowerCase() === "true";

    // If admin explicitly asks for all, allow
    if (req.user.role === "admin" && wantAll) {
      return res.json({ order });
    }

    // Otherwise enforce ownership
    if (
      order.user_id &&
      userId &&
      order.user_id !== userId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // If order has user_id but requester doesn't match
    if (order.user_id && userId && order.user_id !== userId) {
      // requester doesn't own the order and didn't pass admin?all=true
      return res.status(403).json({ message: "Forbidden" });
    }

    // If order has no user_id, block unless admin asked for all
    if (!order.user_id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ order });
  } catch (err) {
    console.error("getOrderByPid error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.adjustOrderEta = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta_minutes } = req.body;

    if (!Number.isFinite(Number(delta_minutes))) {
      return res.status(400).json({ message: "delta_minutes is required" });
    }

    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // base ETA (safe)
    let baseTime;
    if (order.estimated_ready_at) {
      const t = new Date(order.estimated_ready_at);
      baseTime = isNaN(t.getTime()) ? new Date(order.created_at) : t;
    } else {
      baseTime = new Date(order.created_at);
    }

    const newEta = new Date(baseTime.getTime() + Number(delta_minutes) * 60000);

    const updated = await updateOrderEtaById(order.id, newEta);

    // 🔔 SSE broadcast
    broadcastSse({
      event: "order_eta_updated",
      orderId: order.id,
      estimated_ready_at: updated.estimated_ready_at,
    });

    return res.json({
      success: true,
      orderId: order.id,
      estimated_ready_at: updated.estimated_ready_at,
    });
  } catch (err) {
    console.error("adjustOrderEta error:", err);
    return res.status(500).json({ message: "Failed to adjust ETA" });
  }
};
