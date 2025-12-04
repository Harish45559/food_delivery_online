// client/src/pages/TotalOrders.jsx
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
    if (v !== null && v !== undefined && String(v).trim() !== "") q.set(k, v);
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
  const [summary, setSummary] = useState({ totalOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = async (opts = {}) => {
    setLoading(true);
    try {
      const params = { ...filters, ...opts };
      const qs = buildQuery(params);
      const res = await api.get(`/orders/list?${qs}`);
      const body = res.data || {};
      setOrders(body.orders || []);
      setSummary({
        totalOrders: body.total_count || (body.orders || []).length,
        totalRevenue: body.total_revenue || 0,
      });
      setTotalPages(
        Math.max(1, Math.ceil((body.total_count || 0) / (params.limit || 25)))
      );
    } catch (e) {
      console.error("fetchOrders failed", e);
      // keep previous state but show error in console
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

  /* quick presets */
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

  const onExportCSV = () => {
    if (!orders || orders.length === 0) return;
    const headers = [
      "id",
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
      o.paid_by || o.payload?.paid_by || "",
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

  const debouncedSearch = useMemo(() => {
    let t = null;
    return (val) => {
      clearTimeout(t);
      t = setTimeout(() => onFilterChange({ q: val }), 400);
    };
  }, [filters]);

  const avgOrder = summary.totalOrders
    ? summary.totalRevenue / summary.totalOrders
    : 0;

  return (
    <div className="total-orders-root">
      <div className="top-row">
        <div className="page-title">
          <h1>Total Orders</h1>
          <p className="muted">Filter orders, export and analyse daily sales</p>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="kpi-title">Orders</div>
            <div className="kpi-value">{summary.totalOrders}</div>
            <div className="kpi-sub">for selected range</div>
          </div>

          <div className="kpi">
            <div className="kpi-title">Revenue</div>
            <div className="kpi-value">
              £{Number(summary.totalRevenue || 0).toFixed(2)}
            </div>
            <div className="kpi-sub">total</div>
          </div>

          <div className="kpi">
            <div className="kpi-title">Avg. Order</div>
            <div className="kpi-value">£{Number(avgOrder).toFixed(2)}</div>
            <div className="kpi-sub">estimate</div>
          </div>

          <div className="kpi">
            <div className="kpi-title">Showing</div>
            <div className="kpi-value">{orders.length}</div>
            <div className="kpi-sub">page {filters.page}</div>
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
          <button
            className="pill"
            onClick={() => {
              setFilters({
                start: "",
                end: "",
                q: "",
                id: "",
                status: "",
                page: 1,
                limit: 25,
                sort: "created_at_desc",
              });
              fetchOrders({ page: 1, limit: 25, sort: "created_at_desc" });
            }}
          >
            All
          </button>
        </div>

        <div className="filters-row">
          <input
            className="input-small"
            type="datetime-local"
            value={
              filters.start
                ? new Date(filters.start).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              onFilterChange({
                start: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : "",
              })
            }
          />
          <input
            className="input-small"
            type="datetime-local"
            value={
              filters.end
                ? new Date(filters.end).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              onFilterChange({
                end: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : "",
              })
            }
          />

          <input
            className="search-input"
            placeholder="Search name / phone / address"
            defaultValue={filters.q}
            onChange={(e) => debouncedSearch(e.target.value)}
          />

          <input
            className="input-id"
            placeholder="Order ID"
            value={filters.id}
            onChange={(e) => onFilterChange({ id: e.target.value })}
          />

          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="select-small"
          >
            <option value="">Any status</option>
            <option value="paid">Paid</option>
            <option value="preparing">Preparing</option>
            <option value="prepared">Prepared</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>

          <div className="control-actions">
            <button
              className="btn"
              onClick={() => fetchOrders({ ...filters, page: 1 })}
            >
              Apply
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setFilters({
                  start: "",
                  end: "",
                  q: "",
                  id: "",
                  status: "",
                  page: 1,
                  limit: 25,
                  sort: "created_at_desc",
                });
                fetchOrders({ page: 1, limit: 25, sort: "created_at_desc" });
              }}
            >
              Reset
            </button>
            <button className="btn" onClick={onExportCSV}>
              Export
            </button>
            <button className="btn" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loader">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div>No orders found for the selected range.</div>
            <div className="muted">
              Try widening the date range or remove filters.
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Paid by</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">{String(o.id).padStart(4, "0")}</td>
                      <td>{prettyDate(o.created_at)}</td>
                      <td>
                        <div className="cust-name">
                          {o.customer_name || o.payload?.customer?.name || "-"}
                        </div>
                        <div className="muted small">
                          {o.customer_phone || o.payload?.customer?.phone || ""}
                        </div>
                      </td>
                      <td className="items-col">
                        {(o.payload?.items || [])
                          .map(
                            (it) => `${it.qty}×${it.title || it.name || it.id}`
                          )
                          .join(", ")}
                      </td>
                      <td className="mono">
                        £{Number(o.total_gbp || 0).toFixed(2)}
                      </td>
                      <td>{o.paid_by || o.payload?.paid_by || "—"}</td>
                      <td>
                        <span className={`status-pill status-${o.status}`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-row">
              <div className="pager">
                <button
                  className="btn"
                  onClick={() => onPage(Math.max(1, filters.page - 1))}
                  disabled={filters.page <= 1}
                >
                  Prev
                </button>
                <div className="muted">
                  Page {filters.page} / {totalPages}
                </div>
                <button
                  className="btn"
                  onClick={() => onPage(Math.min(totalPages, filters.page + 1))}
                  disabled={filters.page >= totalPages}
                >
                  Next
                </button>
              </div>

              <div className="page-controls">
                <label className="muted small">Per page</label>
                <select
                  value={filters.limit}
                  onChange={(e) =>
                    onFilterChange({ limit: Number(e.target.value) })
                  }
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <label className="muted small">Sort</label>
                <select
                  value={filters.sort}
                  onChange={(e) => onFilterChange({ sort: e.target.value })}
                >
                  <option value="created_at_desc">Newest</option>
                  <option value="created_at_asc">Oldest</option>
                  <option value="total_desc">Total (high→low)</option>
                  <option value="total_asc">Total (low→high)</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
