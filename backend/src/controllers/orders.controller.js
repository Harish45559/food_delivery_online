const {
  listAllOrders,
  listOrdersByUser,
  getOrderByPid,
  getOrderById,
  getOrderByUid,
  updateOrderEtaById,
  updateOrderStatusById,
  updateOrderPaidByById,
  updateOrderPaymentMethodByUid,
} = require("../utils/orders.db");

const { broadcastSse } = require("../utils/sse");

/**
 * Normalize order payload safely
 */
function normalizeOrder(order) {
  if (!order) return order;

  const normalized = { ...order };

  let payloadObj = {};
  if (normalized.payload) {
    if (typeof normalized.payload === "string") {
      try {
        payloadObj = JSON.parse(normalized.payload);
      } catch {
        payloadObj = { raw: normalized.payload };
      }
    } else if (typeof normalized.payload === "object") {
      payloadObj = { ...normalized.payload };
    }
  }

  if (normalized.notes && !payloadObj.notes) {
    payloadObj.notes = normalized.notes;
  }

  if (!Array.isArray(payloadObj.items)) {
    payloadObj.items = payloadObj.items || [];
  }

  normalized.payload = payloadObj;
  return normalized;
}

/* ----------------------------------------------------
   LIST ORDERS
---------------------------------------------------- */
exports.listOrders = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const userIdRaw = req.user.sub || req.user.id || req.user.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;
    const wantAll = String(req.query.all || "").toLowerCase() === "true";

    if (req.user.role === "admin" && wantAll) {
      const rows = await listAllOrders();
      return res.json({ orders: rows.map(normalizeOrder) });
    }

    if (!userId) {
      return res.status(400).json({ message: "No user id in token" });
    }

    const orders = await listOrdersByUser(userId);
    return res.json({ orders: orders.map(normalizeOrder) });
  } catch (err) {
    console.error("listOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------
   GET ORDER BY STRIPE PID
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

    if (req.user.role === "admin" && wantAll) {
      return res.json({ order });
    }

    if (order.user_id && order.user_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json({ order });
  } catch (err) {
    console.error("getOrderByPid error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ----------------------------------------------------
   ADJUST ETA (internal numeric ID – admin/kitchen use)
---------------------------------------------------- */
exports.adjustOrderEta = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { delta_minutes } = req.body;

    if (!id || !Number.isFinite(Number(delta_minutes))) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const order = await getOrderById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const baseTime = order.estimated_ready_at
      ? new Date(order.estimated_ready_at)
      : new Date(order.created_at);

    const newEta = new Date(baseTime.getTime() + Number(delta_minutes) * 60000);

    const updated = await updateOrderEtaById(id, newEta);

    broadcastSse({
      event: "order_eta_updated",
      order_uid: order.order_uid,
      estimated_ready_at: updated.estimated_ready_at,
    });

    res.json({
      success: true,
      order_uid: order.order_uid,
      estimated_ready_at: updated.estimated_ready_at,
    });
  } catch (err) {
    console.error("adjustOrderEta error:", err);
    res.status(500).json({ message: "Failed to adjust ETA" });
  }
};

/* ----------------------------------------------------
   CANCEL ORDER (ADMIN – uses UUID)
---------------------------------------------------- */
exports.cancelOrder = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { orderUid } = req.params;
    if (!orderUid) {
      return res.status(400).json({ message: "Invalid order UID" });
    }

    const order = await getOrderByUid(orderUid);
    if (!order) return res.status(404).json({ message: "Order not found" });

    await updateOrderStatusById(order.id, "cancelled");
    await updateOrderPaidByById(order.id, null);

    broadcastSse({
      event: "order_updated",
      order: { order_uid: orderUid, status: "cancelled" },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ message: "Cancel failed" });
  }
};

/* ----------------------------------------------------
   CHANGE PAYMENT METHOD (UUID – CUSTOMER SAFE)
---------------------------------------------------- */
exports.changePaymentMethod = async (req, res) => {
  try {
    const { orderUid } = req.params;
    const { paymentMethod } = req.body;

    if (!orderUid) {
      return res.status(400).json({ message: "Invalid order UID" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "paymentMethod is required" });
    }

    const allowedMethods = ["cash", "card"];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const order = await getOrderByUid(orderUid);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.paid_at) {
      return res.status(400).json({
        message: "Payment method cannot be changed after payment",
      });
    }

    const updatedOrder = await updateOrderPaymentMethodByUid(
      orderUid,
      paymentMethod
    );

    broadcastSse({
      event: "order_updated",
      order: updatedOrder,
    });

    res.json({
      ok: true,
      message: "Payment method updated",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("[orders] changePaymentMethod error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
