// client/src/components/OrderMiniCard.jsx
import React from "react";
import "../styles/order-mini.css";

/**
 * OrderMiniCard
 * Props:
 *  - order: { id, created_at, total_gbp, payload, customer: { name, phone, address } }
 *  - onInspect: (order) => void    // optional inspect callback
 *  - compact: boolean              // smaller layout if true
 */
export default function OrderMiniCard({ order, onInspect, compact = false }) {
  const customer = order.customer || {};
  const items =
    order.payload && Array.isArray(order.payload.items)
      ? order.payload.items
      : [];
  const address =
    customer.address || (order.payload && order.payload.address) || "";

  return (
    <div className={`mini-order-card ${compact ? "compact" : ""}`}>
      <div className="mini-head">
        <div className="mini-id">#{order.id}</div>
        <div className="mini-total">
          £{parseFloat(order.total_gbp || 0).toFixed(2)}
        </div>
      </div>

      <div className="mini-customer">
        <div className="cust-name">
          {customer.name || (order.payload && order.payload.name) || "Unknown"}
        </div>
        <div className="cust-phone">
          {customer.phone || (order.payload && order.payload.phone) || ""}
        </div>
      </div>

      <div className="mini-address">
        <div className="addr-label">Address</div>
        <div className="addr-text">{address || "—"}</div>
      </div>

      <div className="mini-items">
        <div className="items-label">Items</div>
        <div className="items-list">
          {items.length === 0 && <div className="item-row empty">No items</div>}
          {items.slice(0, 4).map((it, i) => (
            <div key={i} className="item-row">
              <div className="item-title">
                {it.title || it.name || `Item ${it.id}`}
              </div>
              <div className="item-qty">{it.qty || 1}×</div>
              <div className="item-price">
                {typeof it.price_gbp === "number"
                  ? `£${(it.price_gbp * (it.qty || 1)).toFixed(2)}`
                  : it.price_pence
                  ? `£${((it.price_pence / 100) * (it.qty || 1)).toFixed(2)}`
                  : "-"}
              </div>
            </div>
          ))}
          {items.length > 4 && (
            <div className="item-row more">+{items.length - 4} more</div>
          )}
        </div>
      </div>

      <div className="mini-actions">
        <button
          className="mini-btn"
          onClick={() => onInspect && onInspect(order)}
        >
          Inspect
        </button>
      </div>
    </div>
  );
}
