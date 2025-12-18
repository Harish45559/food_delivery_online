// client/src/pages/LiveOrders.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "../styles/live-orders.css";

/* -------------------- helpers -------------------- */
function normalizeStatus(s) {
  return s == null ? "" : String(s).toLowerCase().trim();
}
function normalizePayload(p) {
  if (p === null || p === "" || p === undefined) return { items: [] };
  if (typeof p === "string") {
    try {
      const parsed = JSON.parse(p);
      return {
        ...parsed,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch (e) {
      return { items: [] };
    }
  }
  if (typeof p === "object") {
    return { ...p, items: Array.isArray(p.items) ? p.items : [] };
  }
  return { items: [] };
}
const KITCHEN_STATUSES = ["new", "preparing", "prepared"];

/* -------------------- localStorage ack helpers -------------------- */
const ACK_KEY = "liveorders_acknowledged_ids";
function loadAcknowledgedSet() {
  try {
    const v = localStorage.getItem(ACK_KEY);
    if (!v) return new Set();
    return new Set(JSON.parse(v));
  } catch (e) {
    return new Set();
  }
}
function saveAcknowledgedSet(set) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

/* -------------------- small timer hook -------------------- */
function useElapsedTimer(startIso) {
  const [elapsed, setElapsed] = useState(() =>
    startIso ? Math.max(0, Date.now() - new Date(startIso).getTime()) : 0
  );
  useEffect(() => {
    if (!startIso) return;
    const id = setInterval(
      () => setElapsed(Math.max(0, Date.now() - new Date(startIso).getTime())),
      1000
    );
    return () => clearInterval(id);
  }, [startIso]);
  const secs = Math.floor(elapsed / 1000);
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* -------------------- remaining countdown hook -------------------- */
/**
 * useRemainingTime(targetIso)
 * - targetIso: Date | ISO string | number
 * Returns { mins: number, mmss: "MM:SS", done: boolean }
 */
function useRemainingTime(targetIso) {
  const parseTarget = () => {
    if (!targetIso) return null;
    const t = typeof targetIso === "string" ? new Date(targetIso) : targetIso;
    if (t instanceof Date && !isNaN(t.getTime())) return t;
    return null;
  };

  const [remainingMs, setRemainingMs] = useState(() => {
    const t = parseTarget();
    return t ? Math.max(0, t.getTime() - Date.now()) : 0;
  });

  useEffect(() => {
    const t = parseTarget();
    if (!t) {
      setRemainingMs(0);
      return;
    }
    const id = setInterval(() => {
      const rem = Math.max(0, t.getTime() - Date.now());
      setRemainingMs(rem);
    }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const secs = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = Math.floor(secs / 60).toString();
  const ss = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  const mins = Math.max(0, Math.round(secs / 60));
  const mmss = `${mm}:${ss}`;
  return { mins, mmss, done: remainingMs <= 0 };
}

/* -------------------- ETA estimate helper (frontend fallback) -------------------- */
const DEFAULT_PER_ITEM_MIN = 8; // fallback per-item minutes
const DEFAULT_BASE_MIN = 5; // base kitchen time

function estimateReadyAtForOrder(order) {
  // prefer explicit server-provided timestamp
  if (order.estimated_ready_at) {
    const t = new Date(order.estimated_ready_at);
    if (!isNaN(t.getTime())) return t;
  }

  // prefer estimated_prep_minutes if present
  if (
    order.estimated_prep_minutes &&
    Number.isFinite(Number(order.estimated_prep_minutes))
  ) {
    const mins = Number(order.estimated_prep_minutes);
    return new Date(new Date(order.created_at).getTime() + mins * 60000);
  }

  // otherwise compute from items
  const items =
    Array.isArray(order.payload?.items) && order.payload.items.length
      ? order.payload.items
      : Array.isArray(order.items) && order.items.length
      ? order.items
      : [];

  const itemCount = items.reduce((s, it) => s + (it.qty || 1), 0);
  const mins = DEFAULT_BASE_MIN + DEFAULT_PER_ITEM_MIN * itemCount;
  return new Date(new Date(order.created_at).getTime() + mins * 60000);
}

/* -------------------- OrderCard (UI) -------------------- */
/* Added 'onAdjustEta' prop to receive adjustments from parent */
function OrderCard({
  order,
  onAccept,
  onMarkPrepared,
  onComplete,
  onReject,
  onAdjustEta,
}) {
  const timer = useElapsedTimer(order.created_at);
  const status = normalizeStatus(order.status);
  const isNew = order.acknowledged === false && status === "paid";

  // Robust extraction of customer fields:
  // check DB columns, then payload.customer.*, then top-level payload fields
  const payload =
    order.payload && typeof order.payload === "object" ? order.payload : {};
  const payloadCustomer = payload.customer || {};

  const customerName =
    order.customer_name || payloadCustomer.name || payload.name || "";

  const customerPhone =
    order.customer_phone || payloadCustomer.phone || payload.phone || "";

  const customerAddress =
    order.customer_address || payloadCustomer.address || payload.address || "";

  // Determine delivery type (preferred order: DB field -> payload -> infer from address)
  const deliveryTypeRaw =
    (order.delivery_type || "").toString().trim().toLowerCase() ||
    (payload.delivery_type || "").toString().trim().toLowerCase();

  const deliveryType =
    deliveryTypeRaw ||
    (customerAddress && String(customerAddress).trim() !== ""
      ? "delivery"
      : "take-away");

  // Compute ETA & remaining
  const estimatedReadyAt = estimateReadyAtForOrder(order);
  const remaining = useRemainingTime(estimatedReadyAt);
  // remaining.mins = integer minutes left, remaining.mmss = "M:SS"

  return (
    <div className={`live-order-card ${isNew ? "new-order" : ""}`}>
      <div className="live-order-head">
        <div className="live-order-meta">
          <div className="live-order-id">
            Order #{order.order_uid.slice(0, 8)}
          </div>

          <div className="live-ts">
            {new Date(order.created_at).toLocaleString()}
          </div>

          {/* ORDER TYPE – left top, bold */}
          <div className="order-type-top">{deliveryType.toUpperCase()}</div>

          {/* Customer info block */}
          {(customerName || customerPhone || customerAddress) && (
            <div className="customer-info">
              {customerName && <div className="cust-name">{customerName}</div>}
              {customerPhone && (
                <div className="cust-phone">{customerPhone}</div>
              )}
              {customerAddress && (
                <div className="cust-address">{customerAddress}</div>
              )}
            </div>
          )}
        </div>

        <div className="live-order-right">
          {/* PAYMENT BADGE */}
          {order.status !== "cancelled" && (
            <>
              {order.paid_by ? (
                <div className="paid-by-top">
                  PAID BY: {String(order.paid_by).toUpperCase()}
                </div>
              ) : (
                <div className="paid-by-top unpaid">PAY AT PICKUP</div>
              )}
            </>
          )}

          {/* STATUS badge */}
          <div
            className={`live-status ${
              status === "paid"
                ? "live-paid"
                : status === "preparing"
                ? "live-preparing"
                : status === "prepared"
                ? "live-prepared"
                : status === "cancelled"
                ? "live-cancelled"
                : "live-pending"
            }`}
          >
            {status || order.status}
          </div>

          {/* TOTAL */}
          <div className="live-total">
            £{parseFloat(order.total_gbp || 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="live-items">
        {order.payload.items && order.payload.items.length ? (
          order.payload.items.map((it, i) => (
            <div key={i} className="live-item">
              <div className="item-left">
                <div className="item-title">
                  {it.title || it.name || `Item ${it.id}`}
                </div>
                <div className="item-sub">
                  {it.qty} ×{" "}
                  {typeof it.price_gbp === "number"
                    ? `£${it.price_gbp.toFixed(2)}`
                    : it.price_pence
                    ? `£${(it.price_pence / 100).toFixed(2)}`
                    : "-"}
                </div>
              </div>
              <div className="item-right">
                {typeof it.price_gbp === "number"
                  ? `£${(it.price_gbp * (it.qty || 1)).toFixed(2)}`
                  : "-"}
              </div>
            </div>
          ))
        ) : (
          <div className="live-item empty">No items</div>
        )}
      </div>

      {order.payload?.notes && (
        <div className="live-notes">
          <strong>Notes</strong>
          <div className="notes-text">{order.payload.notes}</div>
        </div>
      )}

      <div className="live-controls">
        {/* Primary actions only — no dropdown */}
        {status === "new" && (
          <>
            <button
              className="btn btn-accept"
              onClick={() => onAccept(order.id)}
            >
              Accept
            </button>
            <button
              className="btn btn-reject"
              onClick={() => onReject(order.id)}
            >
              Reject
            </button>
          </>
        )}

        {status === "preparing" && (
          <>
            <button
              className="btn btn-primary"
              onClick={() => onMarkPrepared(order.id)}
            >
              Mark Prepared
            </button>
            <button
              className="btn btn-reject small"
              onClick={() => onReject(order.id)}
            >
              Reject
            </button>
          </>
        )}

        {status === "prepared" && (
          <button
            className="btn btn-primary"
            onClick={() => onComplete(order.id)}
          >
            Mark Complete
          </button>
        )}

        {/* ETA adjust controls: -5 / +5 minutes (calls parent via onAdjustEta) */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            className="btn small"
            title="Subtract 5 minutes"
            onClick={() =>
              typeof onAdjustEta === "function" && onAdjustEta(order.id, -5)
            }
          >
            −5m
          </button>
          <button
            className="btn small"
            title="Add 5 minutes"
            onClick={() =>
              typeof onAdjustEta === "function" && onAdjustEta(order.id, +5)
            }
          >
            +5m
          </button>
        </div>

        <div
          className={`live-eta ${
            remaining.done ? "due" : remaining.mins <= 3 ? "warn" : ""
          }`}
        >
          ETA: {remaining.mins} min{" "}
          {remaining.done ? "(due)" : `(${remaining.mmss})`}
        </div>

        <div className="elapsed">⏱ {timer}</div>
      </div>
    </div>
  );
}

/* -------------------- Main LiveOrders component -------------------- */
export default function LiveOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const ackSetRef = useRef(loadAcknowledgedSet());
  const audioRef = useRef(null);
  const globalAlarmRef = useRef(null);

  /* Audio - simple two-tone ding */
  useEffect(() => {
    audioRef.current = {
      play: () => {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o1 = ctx.createOscillator(),
            g1 = ctx.createGain();
          o1.type = "sine";
          o1.frequency.value = 900;
          g1.gain.value = 0.18;
          o1.connect(g1);
          g1.connect(ctx.destination);
          o1.start();
          setTimeout(() => {
            try {
              g1.gain.exponentialRampToValueAtTime(
                0.0001,
                ctx.currentTime + 0.02
              );
            } catch (e) {}
            o1.stop();
          }, 110);
          setTimeout(() => {
            const o2 = ctx.createOscillator(),
              g2 = ctx.createGain();
            o2.type = "sine";
            o2.frequency.value = 660;
            g2.gain.value = 0.12;
            o2.connect(g2);
            g2.connect(ctx.destination);
            o2.start();
            setTimeout(() => {
              try {
                g2.gain.exponentialRampToValueAtTime(
                  0.0001,
                  ctx.currentTime + 0.02
                );
              } catch (e) {}
              o2.stop();
            }, 200);
          }, 120);
        } catch (e) {
          console.warn("sound failed", e);
        }
      },
    };
  }, []);

  const startGlobalAlarm = () => {
    if (!audioRef.current) return;
    if (globalAlarmRef.current) return;
    audioRef.current.play();
    globalAlarmRef.current = setInterval(
      () => audioRef.current && audioRef.current.play(),
      2200
    );
  };
  const stopGlobalAlarm = () => {
    if (globalAlarmRef.current) {
      clearInterval(globalAlarmRef.current);
      globalAlarmRef.current = null;
    }
  };

  useEffect(() => () => stopGlobalAlarm(), []);

  const anyUnacknowledged = (list) =>
    (list || orders).some(
      (o) => normalizeStatus(o.status) === "new" && o.acknowledged === false
    );

  /* Load initial list (use api so VITE_API_URL is respected) */
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/live-orders/list");
        const body = res.data || {};
        const all = body.orders || [];

        const keep = all
          .map((o) => ({
            ...o,
            status: normalizeStatus(o.status),
            payload: normalizePayload(o.payload),
            acknowledged: ackSetRef.current.has(String(o.order_uid)),
          }))
          .filter((o) => KITCHEN_STATUSES.includes(o.status));

        keep.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (mounted) {
          setOrders(keep);
          if (keep.some((o) => o.acknowledged === false && o.status === "paid"))
            startGlobalAlarm();
          else stopGlobalAlarm();
        }
      } catch (err) {
        console.error("Failed to load orders", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* SSE subscription */
  useEffect(() => {
    const onMessage = (data) => {
      try {
        if (!data || !data.event) return;

        if (data.event === "order_paid") {
          const incoming = {
            ...data.order,
            status: normalizeStatus(data.order.status),
            payload: normalizePayload(data.order.payload),
            acknowledged:
              ackSetRef.current.has(String(data.order.order_uid)) || false,
          };
          setOrders((prev) => {
            const idx = prev.findIndex(
              (p) => String(p.order_uid) === String(data.order.order_uid)
            );

            const next =
              idx !== -1
                ? (() => {
                    const c = [...prev];
                    c.splice(idx, 1);
                    return [incoming, ...c];
                  })()
                : [incoming, ...prev];
            if (anyUnacknowledged(next)) startGlobalAlarm();
            return next;
          });
          return;
        }

        if (data.event === "order_updated") {
          const incomingStatus = normalizeStatus(
            data.order && data.order.status
          );
          setOrders((prev) => {
            const idx = prev.findIndex(
              (p) => String(p.id) === String(data.order.id)
            );
            if (KITCHEN_STATUSES.includes(incomingStatus)) {
              const incoming = {
                ...data.order,
                status: incomingStatus,
                payload: normalizePayload(data.order.payload),
                acknowledged:
                  (idx !== -1 && prev[idx] && prev[idx].acknowledged) || true,
              };
              const next =
                idx !== -1
                  ? (() => {
                      const c = [...prev];
                      c[idx] = incoming;
                      return c;
                    })()
                  : [incoming, ...prev];
              if (anyUnacknowledged(next)) startGlobalAlarm();
              else stopGlobalAlarm();
              return next;
            } else {
              if (idx !== -1) {
                const copy = [...prev];
                copy.splice(idx, 1);
                if (anyUnacknowledged(copy)) startGlobalAlarm();
                else stopGlobalAlarm();
                return copy;
              }
              return prev;
            }
          });
          return;
        }

        if (data.event === "order_eta_updated") {
          setOrders((prev) =>
            prev.map((o) =>
              String(o.order_uid) === String(data.order_uid)
                ? { ...o, estimated_ready_at: data.estimated_ready_at }
                : o
            )
          );
          return;
        }
      } catch (e) {
        console.error("SSE handler error", e);
      }
    };

    const onError = (err) => console.error("SSE error", err);
    const unsubscribe = api.liveOrdersStream(onMessage, onError);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ack persistence helpers */
  const markAcknowledged = (orderId) => {
    const key = String(orderId);
    ackSetRef.current.add(key);
    saveAcknowledgedSet(ackSetRef.current);
  };

  /* Action handlers */
  const acceptOrder = async (orderId) => {
    setOrders((prev) => {
      const next = prev.map((o) =>
        Number(o.id) === Number(orderId)
          ? { ...o, status: "preparing", acknowledged: true }
          : o
      );
      if (!anyUnacknowledged(next)) stopGlobalAlarm();
      return next;
    });
    markAcknowledged(orderId);
    try {
      await api.updateOrderStatus(orderId, "preparing");
    } catch (err) {
      console.error("accept failed", err);
      await reloadList();
    }
  };

  const markPrepared = async (orderId) => {
    setOrders((prev) =>
      prev.map((o) =>
        Number(o.id) === Number(orderId)
          ? { ...o, status: "prepared", acknowledged: true }
          : o
      )
    );
    markAcknowledged(orderId);
    try {
      await api.updateOrderStatus(orderId, "prepared");
    } catch (err) {
      console.error("markPrepared failed", err);
      await reloadList();
    }
  };

  const completeOrder = async (orderId) => {
    setOrders((prev) =>
      prev.map((o) =>
        Number(o.id) === Number(orderId)
          ? { ...o, status: "completed", acknowledged: true }
          : o
      )
    );
    markAcknowledged(orderId);
    try {
      await api.updateOrderStatus(orderId, "completed");
    } catch (err) {
      console.error("complete failed", err);
      await reloadList();
    }
  };

  const rejectOrder = async (orderId) => {
    setOrders((prev) => {
      const next = prev.filter((o) => Number(o.id) !== Number(orderId));
      if (!anyUnacknowledged(next)) stopGlobalAlarm();
      return next;
    });
    markAcknowledged(orderId);
    try {
      await api.updateOrderStatus(orderId, "cancelled");
    } catch (err) {
      console.error("reject failed", err);
      await reloadList();
    }
  };

  /* NEW: optimistic ETA adjust handler (calls API) */
  const adjustOrderEta = async (orderId, deltaMinutes) => {
    // optimistic UI update
    setOrders((prev) =>
      prev.map((o) => {
        if (Number(o.id) !== Number(orderId)) return o;
        // compute previous estimated ready (fallback to estimator)
        const prevEst = o.estimated_ready_at
          ? new Date(o.estimated_ready_at)
          : estimateReadyAtForOrder(o);
        const newEst = new Date(prevEst.getTime() + deltaMinutes * 60000);
        return { ...o, estimated_ready_at: newEst.toISOString() };
      })
    );

    try {
      // call API (server should persist and broadcast order_updated)
      await api.adjustOrderEta(orderId, { delta_minutes: deltaMinutes });
      // success: server SSE should update others; keep optimistic state
    } catch (err) {
      console.error("adjust ETA failed", err);
      // revert by reloading authoritative data
      await reloadList();
    }
  };

  const reloadList = async () => {
    try {
      const r = await api.get("/live-orders/list");
      const body = r.data || {};
      const keep = (body.orders || [])
        .map((o) => ({
          ...o,
          status: normalizeStatus(o.status),
          payload: normalizePayload(o.payload),
          acknowledged: ackSetRef.current.has(String(o.order_uid)),
        }))
        .filter((o) => KITCHEN_STATUSES.includes(o.status));
      keep.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(keep);
      if (anyUnacknowledged(keep)) startGlobalAlarm();
      else stopGlobalAlarm();
    } catch (e) {
      console.error("reload failed", e);
    }
  };

  return (
    <div className="live-orders-page">
      <div className="page-header">
        <h2>Live Orders — Kitchen</h2>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={reloadList}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {!loading && orders.length === 0 && (
        <div className="empty">No orders in kitchen queue.</div>
      )}

      <div className="live-list">
        {orders.map((order) => (
          <OrderCard
            key={order.order_uid}
            order={order}
            onAccept={acceptOrder}
            onMarkPrepared={markPrepared}
            onComplete={completeOrder}
            onReject={rejectOrder}
            onAdjustEta={adjustOrderEta} /* new prop */
          />
        ))}
      </div>
    </div>
  );
}
