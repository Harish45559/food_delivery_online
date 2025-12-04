// frontend/src/components/Cart.jsx
import React, { useEffect, useState } from "react";
import "../styles/Menu.css";

function formatPenceToGBP(pence) {
  const n = Number(pence) || 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n / 100);
}

export default function Cart() {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");

  // Load cart + notes
  useEffect(() => {
    function load() {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      setItems(cart);
      setNotes(localStorage.getItem("cart_notes") || "");
    }
    load();

    window.addEventListener("cart.updated", load);
    window.addEventListener("cart.notes.updated", load);

    return () => {
      window.removeEventListener("cart.updated", load);
      window.removeEventListener("cart.notes.updated", load);
    };
  }, []);

  function changeQty(id, delta) {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const idx = cart.findIndex((i) => i.id === id);
    if (idx === -1) return;

    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);

    localStorage.setItem("cart", JSON.stringify(cart));
    setItems(cart);

    window.dispatchEvent(new Event("cart.updated"));
  }

  function saveNotes(value) {
    localStorage.setItem("cart_notes", value || "");
    setNotes(value || "");
    window.dispatchEvent(new Event("cart.notes.updated"));
  }

  const subtotalPence = items.reduce(
    (s, it) => s + (it.price_pence || 0) * it.qty,
    0
  );

  return (
    <div className="cart-card card">
      <h3>Your cart</h3>

      {items.length === 0 ? (
        <p className="text-muted">Cart is empty</p>
      ) : (
        <div>
          {items.map((it) => (
            <div key={it.id} className="cart-row">
              <div>
                <div className="cart-item-title">{it.title}</div>
                <div className="text-muted">
                  {it.price_gbp
                    ? it.price_gbp + ` × ${it.qty}`
                    : `${formatPenceToGBP(it.price_pence)} × ${it.qty}`}
                </div>
              </div>

              <div className="cart-controls">
                <button
                  className="small-btn"
                  onClick={() => changeQty(it.id, -1)}
                >
                  -
                </button>
                <div style={{ padding: "0 8px" }}>{it.qty}</div>
                <button
                  className="small-btn"
                  onClick={() => changeQty(it.id, +1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}

          {/* Notes section */}
          <div style={{ marginTop: 15 }}>
            <label
              style={{
                fontWeight: 600,
                fontSize: 14,
                display: "block",
                marginBottom: 6,
              }}
            >
              Order notes (e.g. "spicy", "no cutlery")
            </label>
            <textarea
              value={notes}
              onChange={(e) => saveNotes(e.target.value)}
              placeholder="Add notes for kitchen or delivery..."
              rows={3}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div className="cart-subtotal">
            <strong>Subtotal</strong>
            <div>{formatPenceToGBP(subtotalPence)}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              className="btn-primary"
              onClick={() => (window.location.href = "/checkout")}
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
