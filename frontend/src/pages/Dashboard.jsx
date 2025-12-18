// client/src/components/Dashboard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import api from "../services/api";
import "../styles/dashboard.css";
import DeliveryAddress from "../pages/DeliveryAddress";
import { FiLogOut } from "react-icons/fi"; // ⭐ NEW ICON

/* Configuration for client-side ETA fallback */
const DEFAULT_PER_ITEM_MIN = 8;
const DEFAULT_BASE_MIN = 5;

const FINAL_STATUSES = new Set(["completed", "refunded", "cancelled"]);

function formatCurrencyGBP(amount) {
  if (typeof amount !== "number") return "—";
  return `£${amount.toFixed(2)}`;
}

function shortOrderId(o) {
  if (o.order_uid && typeof o.order_uid === "string") {
    return o.order_uid.slice(0, 8);
  }
  if (o.id != null) {
    return String(o.id);
  }
  return "—";
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* simple ETA calculator */
function estimateReadyAtForOrder(order) {
  if (order.estimated_ready_at) {
    const t = new Date(order.estimated_ready_at);
    if (!isNaN(t.getTime())) return t;
  }

  // ONLY fallback if ETA truly does not exist (old orders)
  if (!order.created_at) return new Date();

  const items = Array.isArray(order.payload?.items) ? order.payload.items : [];

  const count = items.reduce((s, it) => s + (it.qty || 1), 0);
  const mins = 5 + count * 8;

  return new Date(new Date(order.created_at).getTime() + mins * 60000);
}

export default function Dashboard() {
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, text: "" });
  const [addresses, setAddresses] = useState([]);
  const pollingRef = useRef(null);

  // load orders + addresses
  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, addrRes] = await Promise.all([
        api.get("/orders"),
        api.get("/addresses"),
      ]);

      const ordJson = ordersRes?.data;
      const rows = Array.isArray(ordJson?.orders) ? ordJson.orders : [];

      const normalized = rows.map((r) => {
        if (r.payload && typeof r.payload === "string") {
          try {
            r.payload = JSON.parse(r.payload);
          } catch (e) {}
        }
        return r;
      });

      normalized.sort(
        (a, b) =>
          new Date(b.created_at || b.createdAt || 0) -
          new Date(a.created_at || a.createdAt || 0)
      );

      setAllOrders(normalized);

      const addJson = addrRes?.data;
      const addRows = Array.isArray(addJson)
        ? addJson
        : Array.isArray(addJson?.addresses)
        ? addJson.addresses
        : [];
      setAddresses(addRows);
    } catch (err) {
      setError(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    pollingRef.current = setInterval(loadData, 10000);
    return () => clearInterval(pollingRef.current);
  }, []);

  useEffect(() => {
    const onMessage = (data) => {
      if (!data || !data.event) return;

      if (data.event === "order_eta_updated") {
        setAllOrders((prev) =>
          prev.map((o) =>
            String(o.order_uid || o.id) ===
            String(
              data.order_uid ||
                data.order?.order_uid ||
                data.orderId ||
                data.order?.id
            )
              ? { ...o, estimated_ready_at: data.estimated_ready_at }
              : o
          )
        );
      }

      if (data.event === "order_updated" && data.order) {
        setAllOrders((prev) =>
          prev.map((o) =>
            String(o.order_uid) === String(data.order.order_uid)
              ? { ...o, ...data.order }
              : o
          )
        );
      }
    };

    const onError = (err) => console.error("Dashboard SSE error", err);

    const unsubscribe = api.liveOrdersStream(onMessage, onError);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // toast helper
  function showToast(text, ms = 2600) {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), ms);
  }

  // address saved listener
  useEffect(() => {
    function onAddressSaved(e) {
      showToast("Address saved");
      setDrawerOpen(false);

      api
        .get("/addresses")
        .then((r) => {
          const addJson = r?.data;
          const addRows = Array.isArray(addJson)
            ? addJson
            : Array.isArray(addJson?.addresses)
            ? addJson.addresses
            : [];
          setAddresses(addRows);

          window.dispatchEvent(
            new CustomEvent("addresses.updated", { detail: e?.detail })
          );
        })
        .catch(() => {});
    }

    window.addEventListener("address.saved", onAddressSaved);
    return () => window.removeEventListener("address.saved", onAddressSaved);
  }, []);

  // derived
  const currentOrders = useMemo(
    () =>
      allOrders.filter(
        (o) => !FINAL_STATUSES.has(String(o.status || "").toLowerCase())
      ),
    [allOrders]
  );

  const todayOrders = useMemo(
    () => allOrders.filter((o) => isToday(o.created_at || o.createdAt)),
    [allOrders]
  );

  const todayRevenue = useMemo(
    () =>
      todayOrders.reduce((s, o) => s + Number(o.total_gbp || o.total || 0), 0),
    [todayOrders]
  );

  const avgPrepMinutes = useMemo(() => {
    let sum = 0,
      count = 0;
    for (const o of allOrders) {
      if (o.accepted_at && o.completed_at) {
        const mins =
          (new Date(o.completed_at) - new Date(o.accepted_at)) / 60000;
        if (mins > 0) {
          sum += mins;
          count++;
        }
      }
    }
    return count ? Math.round(sum / count) : null;
  }, [allOrders]);

  const recentItems = useMemo(() => {
    const map = new Map();
    for (const o of allOrders) {
      const items =
        Array.isArray(o.payload?.items) && o.payload.items.length
          ? o.payload.items
          : Array.isArray(o.items) && o.items.length
          ? o.items
          : [];
      for (const it of items) {
        const name =
          it.name ||
          it.title ||
          it.item_name ||
          it.product_name ||
          (typeof it === "string" ? it : "Item");
        const qty = it.qty || it.quantity || 1;
        map.set(name, (map.get(name) || 0) + qty);
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [allOrders]);

  // active address
  const [activeAddressId, setActiveAddressId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("customer_info") || "{}");
      return saved.address_id || null;
    } catch {
      return null;
    }
  });

  function setActiveAddress(id) {
    setActiveAddressId(id);
    try {
      const cur = JSON.parse(localStorage.getItem("customer_info") || "{}");
      cur.address_id = id;
      localStorage.setItem("customer_info", JSON.stringify(cur));
      showToast("Active address switched");
      window.dispatchEvent(
        new CustomEvent("customer.address_changed", {
          detail: { address_id: id },
        })
      );
    } catch {}
  }

  return (
    <div className="dashboard-container">
      {/* TOP BAR */}
      <div className="dashboard-topbar">
        <div>
          <h2 className="dashboard-title">Dashboard</h2>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Welcome back — overview of your orders
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* address count + selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#374151" }}>Addresses</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {addresses.length}
            </div>

            <select
              value={activeAddressId || ""}
              onChange={(e) => setActiveAddress(e.target.value || null)}
              style={{
                padding: 6,
                borderRadius: 8,
                border: "1px solid #e6eef6",
                background: "#fff",
              }}
            >
              <option value="">— active address —</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ||
                    a.address ||
                    a.text ||
                    a.address_text ||
                    a.address}
                </option>
              ))}
            </select>
          </div>

          {/* open drawer */}
          <button
            className="fab-btn"
            onClick={() => setDrawerOpen(true)}
            title="Manage delivery addresses"
            aria-label="Manage delivery addresses"
          >
            <span className="fab-plus">＋</span>
          </button>

          {/* ⭐ NEW LOGOUT BUTTON WITH ICON */}
          <button
            className="logout-btn"
            onClick={() => {
              try {
                api.post("/auth/logout").catch(() => {});
              } catch {}
              localStorage.clear();
              window.location.href = "/login";
            }}
            title="Logout"
            aria-label="Logout"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            <FiLogOut size={18} />
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            background: "#fff",
            padding: 12,
            borderRadius: 10,
            minWidth: 160,
            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ fontSize: 13, color: "#64748b" }}>Today's Orders</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {todayOrders.length}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 12,
            borderRadius: 10,
            minWidth: 160,
            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ fontSize: 13, color: "#64748b" }}>Today's Revenue</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {formatCurrencyGBP(todayRevenue)}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 12,
            borderRadius: 10,
            minWidth: 220,
            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ fontSize: 13, color: "#64748b" }}>Avg Preparation</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {avgPrepMinutes
              ? `${avgPrepMinutes} min`
              : `${DEFAULT_BASE_MIN + DEFAULT_PER_ITEM_MIN} min (est)`}
          </div>
          <div style={{ fontSize: 12, color: "#94a3af", marginTop: 6 }}>
            Based on recent orders
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="dashboard-grid">
        {/* LEFT PANEL */}
        <div className="dash-panel">
          <div className="dash-header">
            <h3>My Current Orders</h3>
          </div>

          <div className="dash-body">
            {loading && <div className="dash-text">Loading…</div>}
            {error && <div className="dash-error">{error}</div>}

            {!loading && currentOrders.length === 0 && (
              <div className="dash-text">No current orders.</div>
            )}

            {!loading && currentOrders.length > 0 && (
              <div className="orders-list">
                {currentOrders.map((o) => {
                  const est = estimateReadyAtForOrder(o);
                  const eta = Math.max(
                    0,
                    Math.round((est - new Date()) / 60000)
                  );

                  const items =
                    Array.isArray(o.payload?.items) && o.payload.items.length
                      ? o.payload.items
                      : Array.isArray(o.items) && o.items.length
                      ? o.items
                      : [];

                  const totalItems = items.reduce(
                    (s, it) => s + (it.qty || 1),
                    0
                  );

                  return (
                    <div key={o.order_uid || o.id} className="order-card">
                      <div className="order-left">
                        <div className="order-title">
                          Order #{shortOrderId(o)}
                        </div>

                        <div className="order-meta">
                          {totalItems} item{totalItems !== 1 ? "s" : ""} •{" "}
                          {o.customer_name || "—"}
                        </div>

                        <div className="order-date">
                          {o.created_at
                            ? new Date(o.created_at).toLocaleString()
                            : ""}
                        </div>

                        {/* items */}
                        {items.length > 0 && (
                          <div className="order-items">
                            {items.map((it, idx) => (
                              <div key={idx} className="order-item-line">
                                <div className="item-left">
                                  {it.qty || 1} ×{" "}
                                  {it.name ||
                                    it.title ||
                                    it.item_name ||
                                    it.product_name ||
                                    "Item"}
                                </div>
                                <div className="item-right">
                                  {it.price_gbp || it.price
                                    ? formatCurrencyGBP(
                                        it.price_gbp || it.price
                                      )
                                    : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: 8,
                            color: "#065f46",
                            fontWeight: 700,
                          }}
                        >
                          ETA: {eta} min {eta <= 0 ? "(due)" : ""}
                        </div>
                      </div>

                      <div className="order-right">
                        <div className="order-amount">
                          {formatCurrencyGBP(
                            Number(o.total_gbp || o.total || 0)
                          )}
                        </div>
                        <div className="order-status">
                          {String(o.status || "").toUpperCase()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SUMMARY PANEL */}
        <div className="dash-panel dash-summary">
          <h4>Quick Summary</h4>

          <div className="summary-row">
            <span>Active Orders</span>
            <strong>{currentOrders.length}</strong>
          </div>

          <div className="summary-row">
            <span>Active Value</span>
            <strong>
              {formatCurrencyGBP(
                currentOrders.reduce((s, o) => s + Number(o.total_gbp || 0), 0)
              )}
            </strong>
          </div>

          {/* Recently Ordered – DISABLED */}
          {false && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#64748b", marginBottom: 8 }}>
                Recently ordered
              </div>

              {recentItems.length === 0 ? (
                <div style={{ color: "#94a3af" }}>No recent items</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {recentItems.map((it) => (
                    <div
                      key={it.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {it.name}
                      </div>
                      <div style={{ fontWeight: 700 }}>{it.qty}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <a
            href="/app/orders"
            className="btn btn-primary summary-btn"
            style={{ marginTop: 12 }}
          >
            View My Orders
          </a>
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen && (
        <>
          <div
            className="drawer-overlay open"
            onClick={() => setDrawerOpen(false)}
          />

          <aside
            className="drawer left open"
            role="dialog"
            aria-modal="true"
            aria-label="Delivery addresses drawer"
          >
            <div className="drawer-header">
              <h3 style={{ margin: 0 }}>Delivery Addresses</h3>

              <div className="drawer-actions">
                <button
                  className="drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer-body">
              <DeliveryAddress />
            </div>
          </aside>
        </>
      )}

      {/* TOAST */}
      {toast.show && <div className="toast toast-success">{toast.text}</div>}
    </div>
  );
}
