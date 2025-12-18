// backend/src/controllers/orderStatus.controller.js
const {
  updateOrderStatusById,
  getOrderById,
  updateOrderPaidByPid,
} = require("../utils/orders.db");
const { broadcastSse } = require("../utils/sse");

exports.updateOrderStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id" });

    const { status } = req.body;
    if (!status || typeof status !== "string") {
      return res.status(400).json({ message: "status is required" });
    }

    // Validate allowed statuses
    const allowed = ["new", "preparing", "prepared", "completed", "cancelled"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "invalid status value" });
    }

    console.log(
      `[orders] updateOrderStatus request -> id=${id} status=${status}`
    );

    // Update DB (util returns truthy on success)
    const updated = await updateOrderStatusById(id, status);
    if (!updated) {
      return res.status(404).json({ message: "order not found" });
    }

    // Fetch fresh order (to ensure full row)
    const order = await getOrderById(id);

    // Normalize payload if required (defensive)
    if (order && typeof order.payload === "string") {
      try {
        order.payload = JSON.parse(order.payload);
      } catch (e) {
        // leave as-is
      }
    }

    // Broadcast to SSE clients
    try {
      broadcastSse({ event: "order_updated", order });
      console.log(
        `[orders] broadcast: order_updated id=${order.id} status=${order.status}`
      );
    } catch (bErr) {
      console.error("[orders] broadcast error:", bErr);
    }

    return res.json({ ok: true, order });
  } catch (err) {
    console.error(
      "[orders] updateOrderStatus error:",
      err && err.stack ? err.stack : err
    );
    return res.status(500).json({ message: "Server error" });
  }
};

exports.markOrderAsPaid = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id" });

    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paid_at) {
      return res.status(400).json({ message: "Order already paid" });
    }

    await updateOrderPaidByById(id, new Date());

    const updatedOrder = await getOrderById(id);

    broadcastSse({
      event: "order_updated",
      order: updatedOrder,
    });

    return res.json({
      ok: true,
      message: "Payment completed",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("[orders] markOrderAsPaid error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
