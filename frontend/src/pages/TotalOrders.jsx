import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "../styles/total-orders.css";

/* ---------- helpers ---------- */
function prettyDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString();
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      q.set(k, v);
    }
  });
  return q.toString();
}

function getPresetRange(preset) {
  const now = new Date();
  const start = new Date(now);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }

  if (preset === "this_week") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }

  if (preset === "this_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }

  return { start: "", end: "" };
}

/* ---------- component ---------- */
export default function TotalOrders() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    q: "",
    id: "",
    status: "",
    page: 1,
    limit: 25,
    sort: "created_at_desc",
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  /* ---------- derived values ---------- */
  const paidOrders = orders.filter((o) => o.paid_by);
  const totalRevenue = paidOrders.reduce(
    (s, o) => s + Number(o.total_gbp || 0),
    0
  );
  const avgOrder = paidOrders.length ? totalRevenue / paidOrders.length : 0;

  /* ---------- api ---------- */
  const fetchOrders = async (opts = {}) => {
    setLoading(true);
    try {
      const params = { ...filters, ...opts };
      const qs = buildQuery(params);
      const res = await api.get(`/orders/list?${qs}`);
      const body = res.data || {};

      setOrders(body.orders || []);
      setTotalPages(
        Math.max(1, Math.ceil((body.total_count || 0) / (params.limit || 25)))
      );
    } catch (e) {
      console.error("fetchOrders failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { start, end } = getPresetRange("today");
    setFilters((f) => ({ ...f, start, end }));
    fetchOrders({ start, end, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- payment actions (ADMIN) ---------- */
  const changePaymentMethod = async (id, method) => {
    try {
      await api.changePaymentMethod(id, method);
      fetchOrders();
    } catch (e) {
      alert(e.message || "Failed to change payment method");
    }
  };

  const markAsPaid = async (id) => {
    try {
      await api.markOrderAsPaid(id);
      fetchOrders();
    } catch (e) {
      alert(e.message || "Failed to mark as paid");
    }
  };

  /* ---------- controls ---------- */
  const applyPreset = (p) => {
    const { start, end } = getPresetRange(p);
    setFilters((f) => ({ ...f, start, end, page: 1 }));
    fetchOrders({ start, end, page: 1 });
  };

  const onFilterChange = (patch) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    fetchOrders(next);
  };

  const onPage = (n) => {
    const next = { ...filters, page: n };
    setFilters(next);
    fetchOrders(next);
  };

  const debouncedSearch = useMemo(() => {
    let t = null;
    return (val) => {
      clearTimeout(t);
      t = setTimeout(() => onFilterChange({ q: val }), 400);
    };
  }, [filters]);

  const onExportCSV = () => {
    if (!orders.length) return;

    const headers = [
      "order_uid",

      "created_at",
      "customer_name",
      "phone",
      "items",
      "total_gbp",
      "status",
      "paid_by",
    ];

    const rows = orders.map((o) => [
      o.id,
      o.created_at,
      o.customer_name || o.payload?.customer?.name || "",
      o.customer_phone || o.payload?.customer?.phone || "",
      (o.payload?.items || [])
        .map((i) => `${i.qty}×${i.title || i.name || i.id}`)
        .join("; "),
      o.total_gbp,
      o.status,
      o.paid_by || "",
    ]);

    const csv = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- render ---------- */
  return (
    <div className="total-orders-root">
      <div className="top-row">
        <div className="page-title">
          <h1>Total Orders</h1>
          <p className="muted">Filter orders, export and analyse sales</p>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="kpi-title">Orders</div>
            <div className="kpi-value">{orders.length}</div>
          </div>

          <div className="kpi">
            <div className="kpi-title">Revenue</div>
            <div className="kpi-value">£{Number(totalRevenue).toFixed(2)}</div>
          </div>

          <div className="kpi">
            <div className="kpi-title">Avg. Order</div>
            <div className="kpi-value">£{Number(avgOrder).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="controls-card">
        <div className="preset-group">
          <button className="pill" onClick={() => applyPreset("today")}>
            Today
          </button>
          <button className="pill" onClick={() => applyPreset("this_week")}>
            This week
          </button>
          <button className="pill" onClick={() => applyPreset("this_month")}>
            This month
          </button>
        </div>

        <div className="filters-row">
          <input
            className="search-input"
            placeholder="Search name / phone / address"
            onChange={(e) => debouncedSearch(e.target.value)}
          />

          <input
            className="input-id"
            placeholder="Order Ref"
            value={filters.id}
            onChange={(e) => onFilterChange({ id: e.target.value })}
          />

          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="select-small"
          >
            <option value="">Any status</option>
            <option value="new">New</option>
            <option value="preparing">Preparing</option>
            <option value="prepared">Prepared</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button className="btn" onClick={onExportCSV}>
            Export
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loader">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">No orders found.</div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order Ref</th>

                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid by</th>
                <th>Status</th>
                <th>Payment Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_uid}>
                  <td className="mono">{o.order_uid.slice(0, 8)}</td>

                  <td>{prettyDate(o.created_at)}</td>
                  <td>{o.customer_name || o.payload?.customer?.name || "-"}</td>
                  <td>
                    {(o.payload?.items || [])
                      .map((it) => `${it.qty}×${it.title || it.name || it.id}`)
                      .join(", ")}
                  </td>
                  <td className="mono">
                    £{Number(o.total_gbp || 0).toFixed(2)}
                  </td>
                  <td>
                    {o.status === "cancelled"
                      ? "—"
                      : o.paid_by
                      ? `PAID BY ${o.paid_by.toUpperCase()}`
                      : "PAY AT PICKUP"}
                  </td>
                  <td>
                    <span className={`status-pill status-${o.status}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {!o.paid_by && o.status !== "cancelled" && (
                      <div className="payment-actions">
                        <button
                          onClick={() =>
                            changePaymentMethod(o.order_uid, "cash")
                          }
                        >
                          Cash
                        </button>
                        <button
                          onClick={() =>
                            changePaymentMethod(o.order_uid, "card")
                          }
                        >
                          Card
                        </button>

                        <button
                          className="mark-paid"
                          onClick={() => markAsPaid(o.order_uid)}
                        >
                          Mark Paid
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination-row">
          <button
            className="btn"
            onClick={() => onPage(Math.max(1, filters.page - 1))}
            disabled={filters.page <= 1}
          >
            Prev
          </button>
          <span className="muted">
            Page {filters.page} / {totalPages}
          </span>
          <button
            className="btn"
            onClick={() => onPage(Math.min(totalPages, filters.page + 1))}
            disabled={filters.page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
