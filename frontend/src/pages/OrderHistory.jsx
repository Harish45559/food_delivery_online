// client/src/pages/OrderHistory.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/order-history.css";

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await api.fetchOrders();
      setOrders(res.orders || []);
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();

    const unsubscribe = api.liveOrdersStream((data) => {
      try {
        // when order_updated or order_paid occurs, refresh list
        if (
          data &&
          (data.event === "order_updated" || data.event === "order_paid")
        ) {
          loadOrders();
        }
      } catch (e) {
        console.error("SSE error on OrderHistory", e);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h2>Order history</h2>
      {loading && <div>Loading…</div>}
      {!loading && orders.length === 0 && <div>No orders</div>}
      <div style={{ marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{ textAlign: "left", borderBottom: "2px solid #f3f4f6" }}
            >
              <th style={{ padding: 12, width: 100 }}>Order #</th>
              <th style={{ padding: 12 }}>Items</th>
              <th style={{ padding: 12, width: 120 }}>Status</th>
              <th style={{ padding: 12, textAlign: "right", width: 120 }}>
                Total
              </th>
              <th style={{ padding: 12, width: 120 }}>Paid by</th>
              <th style={{ padding: 12, width: 180 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
                <td style={{ padding: 12 }}>{o.id}</td>
                <td style={{ padding: 12 }}>
                  {(o.payload?.items || []).map((it, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        {it.title || it.name || `Item ${it.id}`} × {it.qty}
                      </div>
                      <div>
                        £
                        {(
                          it.price_gbp ||
                          (it.price_pence ? it.price_pence / 100 : 0)
                        ).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </td>
                <td style={{ padding: 12 }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background:
                        o.status === "paid"
                          ? "#16a34a"
                          : o.status === "completed"
                          ? "#6b7280"
                          : "#f59e0b",
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: "right" }}>
                  £{parseFloat(o.total_gbp || 0).toFixed(2)}
                </td>
                <td style={{ padding: 12 }}>
                  {/* show paid_by (fallback to payload) */}
                  {o.paid_by || o.payload?.paid_by || "—"}
                </td>
                <td style={{ padding: 12 }}>
                  {new Date(o.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
