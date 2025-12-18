import axios from "axios";

/**
 * Axios instance for normal API calls.
 * Use VITE_API_URL to point at the backend root, e.g. "http://localhost:4000/api"
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

/* ---------------------------------------
   AUTH
---------------------------------------- */

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

/* ---------------------------------------
   STRIPE / PAYMENTS
---------------------------------------- */

// Create PaymentIntent (card)
api.createPaymentIntent = async (payload) => {
  const res = await api.post("/payments/create-payment-intent", payload);
  return res.data;
};

// Create cash order
api.createCashOrder = async (payload) => {
  const res = await api.post("/payments/cash", payload);
  return res.data;
};

/* ---------------------------------------
   ORDERS (UUID SAFE)
---------------------------------------- */

// Fetch orders (current user / admin)
api.fetchOrders = async () => {
  const res = await api.get("/orders");
  return res.data;
};

// Get order by Stripe PID
api.fetchOrderByPid = async (pid) => {
  const res = await api.get(`/orders/by-pid/${pid}`);
  return res.data;
};

// Update order status (ADMIN / KITCHEN) — UUID
api.updateOrderStatus = async (id, status) => {
  const res = await api.patch(`/orders/${id}`, { status });
  return res.data;
};
/* ---------------------------------------
   ADMIN PAYMENT ACTIONS (UUID)
---------------------------------------- */

// Change payment method (cash | card)
api.changePaymentMethod = async (orderUid, paymentMethod) => {
  const res = await api.patch(`/orders/${orderUid}/payment-method`, {
    paymentMethod,
  });
  return res.data;
};

// Mark order as paid
api.markOrderAsPaid = async (orderUid) => {
  const res = await api.patch(`/orders/${orderUid}/pay`);
  return res.data;
};

/* ---------------------------------------
   ETA ADJUSTMENT (UUID)
---------------------------------------- */

// POST /orders/:orderUid/adjust_eta
api.adjustOrderEta = async (orderUid, payload) => {
  const res = await api.post(`/orders/${orderUid}/adjust_eta`, payload);
  return res.data;
};

/* ---------------------------------------
   USER ADDRESSES
---------------------------------------- */

api.getUserAddresses = async () => {
  const res = await api.get("/addresses");
  return res.data;
};

api.createUserAddress = async (payload) => {
  const res = await api.post("/addresses", payload);
  return res.data;
};

api.updateUserAddress = async (id, payload) => {
  const res = await api.patch(`/addresses/${id}`, payload);
  return res.data;
};

api.deleteUserAddress = async (id) => {
  const res = await api.delete(`/addresses/${id}`);
  return res.data;
};

/* ---------------------------------------
   LIVE ORDERS STREAM (SSE)
---------------------------------------- */

api.liveOrdersStream = (onMessage, onError) => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const baseNoApi = base.replace(/\/api\/?$/, "");
  const url = `${baseNoApi}/api/live-orders`;

  const es = new EventSource(url);

  es.onopen = () => console.debug("[api] SSE connection opened", url);

  es.onmessage = (e) => {
    if (!e?.data) return;
    try {
      const parsed = JSON.parse(e.data);
      onMessage && onMessage(parsed);
    } catch (err) {
      console.error("[api] SSE JSON parse error:", err, "raw:", e.data);
    }
  };

  es.onerror = (err) => {
    console.error("[api] SSE error", err);
    if (onError) onError(err);
    try {
      es.close();
    } catch {}
  };

  return () => {
    try {
      es.close();
    } catch {}
  };
};

export default api;
