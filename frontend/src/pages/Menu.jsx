// client/src/pages/Menu.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/menu.css";
import MenuItemCard from "../components/MenuItemCard";

/**
 * Menu.jsx
 *
 * - Horizontal category scroller with wheel-to-scroll when hovered
 * - Toggle (hamburger) opens animated dropdown of all categories
 * - Compact menu cards grid on the left
 * - Sticky cart on the right (InlineCart) — checkout button navigates to /app/checkout
 * - Robust price resolver (supports price_gbp, price, price_pence and several alternate keys)
 *
 * This file is the same as your original Menu.jsx but the InlineCart now includes:
 * - Order notes textarea (stored in localStorage key "cart_notes")
 * - Notes are broadcast with a "cart.notes.updated" event so other views (Cart, Checkout, LiveOrders) may react
 */

/* ---------------- Inline Cart ---------------- */
function InlineCart({ items }) {
  const navigate = useNavigate();

  // initial cart read from localStorage
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });

  // notes state (stored separately so we don't change cart shape)
  const [notes, setNotes] = useState(() => {
    try {
      return localStorage.getItem("cart_notes") || "";
    } catch {
      return "";
    }
  });

  // keep cart updated when other parts of app dispatch events
  useEffect(() => {
    function onUpdate() {
      try {
        setCart(JSON.parse(localStorage.getItem("cart") || "[]"));
      } catch {
        setCart([]);
      }
    }
    function onNotesUpdate() {
      try {
        setNotes(localStorage.getItem("cart_notes") || "");
      } catch {
        setNotes("");
      }
    }
    window.addEventListener("cart.updated", onUpdate);
    window.addEventListener("cart.updated.local", onUpdate);
    window.addEventListener("cart.notes.updated", onNotesUpdate);
    return () => {
      window.removeEventListener("cart.updated", onUpdate);
      window.removeEventListener("cart.updated.local", onUpdate);
      window.removeEventListener("cart.notes.updated", onNotesUpdate);
    };
  }, []);

  // save notes (immediate save on change)
  function saveNotes(value) {
    try {
      localStorage.setItem("cart_notes", value || "");
      setNotes(value || "");
      // notify other components
      window.dispatchEvent(new Event("cart.notes.updated"));
      window.dispatchEvent(new Event("cart.updated.local"));
    } catch (e) {
      console.warn("Failed to save notes", e);
    }
  }

  // robust price resolver: checks many common fields and falls back to items (menu)
  const resolvePrice = useCallback(
    (it) => {
      if (!it) return 0;
      const tryNumber = (v) => (typeof v === "number" && !isNaN(v) ? v : null);

      // common direct fields
      let p = tryNumber(it.price);
      if (p !== null) return p;

      if (it.price && !isNaN(parseFloat(it.price))) return parseFloat(it.price);

      // explicit GBP field used by your API
      if (typeof it.price_gbp === "number" && !isNaN(it.price_gbp))
        return it.price_gbp;
      if (it.price_gbp && !isNaN(parseFloat(it.price_gbp)))
        return parseFloat(it.price_gbp);

      // pence-style keys
      const penceCandidates = [
        "price_pence",
        "unit_price_pence",
        "priceInPence",
        "amount_pence",
      ];
      for (const k of penceCandidates) {
        if (typeof it[k] === "number") return it[k] / 100;
        if (it[k] && !isNaN(parseFloat(it[k]))) return parseFloat(it[k]) / 100;
      }

      // alternate price keys
      const altPriceKeys = [
        "unit_price",
        "unitPrice",
        "amount",
        "gross_price",
        "selling_price",
      ];
      for (const k of altPriceKeys) {
        if (typeof it[k] === "number") return it[k];
        if (it[k] && !isNaN(parseFloat(it[k]))) return parseFloat(it[k]);
      }

      // try find in provided items (menu) — items is a prop passed from MenuPage
      if (items && items.length) {
        const found = items.find(
          (m) =>
            String(m.id) === String(it.id) || String(m.sku) === String(it.id)
        );
        if (found) {
          if (typeof found.price_gbp === "number") return found.price_gbp;
          if (found.price_gbp && !isNaN(parseFloat(found.price_gbp)))
            return parseFloat(found.price_gbp);
          if (typeof found.price === "number") return found.price;
          if (typeof found.price_pence === "number")
            return found.price_pence / 100;
          if (found.price && !isNaN(parseFloat(found.price)))
            return parseFloat(found.price);

          for (const k of [...altPriceKeys, ...penceCandidates]) {
            if (typeof found[k] === "number") {
              return k.toLowerCase().includes("pence")
                ? found[k] / 100
                : found[k];
            }
            if (found[k] && !isNaN(parseFloat(found[k]))) {
              return k.toLowerCase().includes("pence")
                ? parseFloat(found[k]) / 100
                : parseFloat(found[k]);
            }
          }
        }
      }

      return 0;
    },
    [items]
  );

  // --- UPDATE: updateCart will cancel inflight PID automatically if cart becomes empty
  async function updateCart(next) {
    localStorage.setItem("cart", JSON.stringify(next));
    setCart(next);
    window.dispatchEvent(new Event("cart.updated.local"));

    // If cart is now empty, cancel any inflight payment intent we created earlier
    try {
      if (
        (!next || next.length === 0) &&
        localStorage.getItem("inflight_payment_pid")
      ) {
        const pid = localStorage.getItem("inflight_payment_pid");
        try {
          await api.post("/payments/cancel-payment-intent", {
            payment_intent_id: pid,
          });
        } catch (e) {
          console.warn("Failed to cancel inflight payment intent", e);
        }
        localStorage.removeItem("inflight_payment_pid");
      }
    } catch (e) {
      console.warn("updateCart cancel logic failed", e);
    }
  }

  function changeQty(id, delta) {
    const next = cart
      .map((c) => {
        if (String(c.id) !== String(id)) return c;
        return { ...c, qty: Math.max(0, (c.qty || 0) + delta) };
      })
      .filter((c) => (c.qty || 0) > 0);
    updateCart(next);
  }

  function removeItem(id) {
    const next = cart.filter((c) => String(c.id) !== String(id));
    updateCart(next);
  }

  const subtotal = cart.reduce((sum, it) => {
    const price = resolvePrice(it);
    const qty = Number(it.qty || 0);
    return sum + price * qty;
  }, 0);

  const currency = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  });

  return (
    <div className="cart-card" aria-live="polite">
      <h3>Your cart</h3>
      {cart.length === 0 && <p>Your cart is empty</p>}
      {cart.map((it) => {
        const price = resolvePrice(it);
        return (
          <div className="cart-row" key={String(it.id)}>
            <div>
              <div className="cart-item-title">{it.title}</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {currency.format(price)} × {it.qty || 0}
              </div>
            </div>

            <div className="cart-controls">
              <button
                className="small-btn"
                aria-label={`Decrease ${it.title}`}
                onClick={() => changeQty(it.id, -1)}
              >
                -
              </button>
              <div style={{ minWidth: 28, textAlign: "center" }}>
                {it.qty || 0}
              </div>
              <button
                className="small-btn"
                aria-label={`Increase ${it.title}`}
                onClick={() => changeQty(it.id, +1)}
              >
                +
              </button>
              <button
                className="small-btn"
                aria-label={`Remove ${it.title}`}
                onClick={() => removeItem(it.id)}
                title="Remove"
                style={{ marginLeft: 8 }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      <div className="cart-subtotal">
        <div>Subtotal</div>
        <div style={{ fontWeight: 900 }}>{currency.format(subtotal)}</div>
      </div>

      {/* Notes textarea (order-level) */}
      <div style={{ marginTop: 12 }}>
        <label
          style={{
            fontWeight: 700,
            fontSize: 13,
            display: "block",
            marginBottom: 6,
          }}
        >
          Order notes (e.g. "spicy", "no cutlery")
        </label>
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder="Add a note for the kitchen or delivery..."
          rows={3}
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            boxSizing: "border-box",
            resize: "vertical",
            fontSize: 14,
            color: "#111827",
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          className="add-btn"
          onClick={() => {
            // Navigate to the protected checkout route
            // ensure notes are stored (already done on change) and broadcasted
            window.dispatchEvent(new Event("cart.notes.updated"));
            navigate("/app/checkout");
          }}
        >
          Checkout
        </button>
      </div>
    </div>
  );
}

/* ---------------- MenuPage ---------------- */
export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [pointerOverBar, setPointerOverBar] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const categoryBarRef = useRef(null);
  const wrapperRef = useRef(null);

  // load categories + initial items
  async function loadAll() {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        api.get("/menu/categories"),
        api.get("/menu/items"),
      ]);
      setCategories(cRes.data.categories || []);
      setItems(iRes.data.items || []);
      if (!active && (cRes.data.categories || []).length) {
        setActive(cRes.data.categories[0].slug);
      }
    } catch (e) {
      console.error("Failed to load menu", e);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => updateArrows());
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchCategory(slug) {
    setActive(slug);
    setShowAll(false);
    setLoading(true);
    try {
      const res = await api.get("/menu/items", { params: { category: slug } });
      setItems(res.data.items || []);
      const node = categoryBarRef.current?.querySelector(
        `button[data-slug="${slug}"]`
      );
      if (node && categoryBarRef.current) {
        node.scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => updateArrows());
    }
  }

  // Add to cart: store price_gbp if present, otherwise fallback and also store price & price_pence
  function onAdd(item) {
    let priceFloat = null;
    let pence = null;

    if (typeof item.price_gbp === "number") {
      priceFloat = item.price_gbp;
    } else if (item.price_gbp && !isNaN(parseFloat(item.price_gbp))) {
      priceFloat = parseFloat(item.price_gbp);
    } else if (typeof item.price === "number") {
      priceFloat = item.price;
    } else if (typeof item.price_pence === "number") {
      pence = item.price_pence;
      priceFloat = item.price_pence / 100;
    } else if (item.unit_price && typeof item.unit_price === "number") {
      priceFloat = item.unit_price;
    } else if (
      item.unit_price_pence &&
      typeof item.unit_price_pence === "number"
    ) {
      pence = item.unit_price_pence;
      priceFloat = pence / 100;
    } else if (item.price && !isNaN(parseFloat(item.price))) {
      priceFloat = parseFloat(item.price);
    }

    if (pence === null && priceFloat !== null && !isNaN(priceFloat))
      pence = Math.round(priceFloat * 100);
    if (priceFloat === null && pence !== null) priceFloat = pence / 100;

    const existing = JSON.parse(localStorage.getItem("cart") || "[]");
    const found = existing.find((i) => String(i.id) === String(item.id));
    if (found) {
      found.qty = (found.qty || 0) + 1;
      found.price = priceFloat;
      found.price_pence = pence;
      if (typeof item.price_gbp !== "undefined")
        found.price_gbp = item.price_gbp;
    } else {
      const cartItem = {
        id: item.id,
        title: item.title || item.name || "Item",
        price: priceFloat,
        price_pence: pence,
        qty: 1,
      };
      if (typeof item.price_gbp !== "undefined")
        cartItem.price_gbp = item.price_gbp;
      existing.push(cartItem);
    }
    localStorage.setItem("cart", JSON.stringify(existing));
    window.dispatchEvent(new Event("cart.updated"));
  }

  // only translate vertical wheel to horizontal when pointer is over the category bar
  function onCategoryWheel(e) {
    const el = categoryBarRef.current;
    if (!el || !pointerOverBar) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }

  // Arrow helpers: scroll by half bar width
  function scrollCategories(dir = "right") {
    const el = categoryBarRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.5);
    el.scrollBy({
      left: dir === "right" ? amount : -amount,
      behavior: "smooth",
    });
  }

  // arrow visibility calculation
  const updateArrows = useCallback(() => {
    const el = categoryBarRef.current;
    if (!el) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    const canScroll = el.scrollWidth > el.clientWidth + 4;
    if (!canScroll) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    const atLeft = el.scrollLeft <= 2;
    const atRight =
      Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 2;
    setShowLeftArrow(!atLeft);
    setShowRightArrow(!atRight);
  }, []);

  useEffect(() => {
    const el = categoryBarRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    const onResize = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    updateArrows();
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateArrows]);

  // close dropdown if clicked outside wrapper
  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setShowAll(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="menu-page container">
      <div className="menu-grid">
        <div className="menu-left">
          <h2>Menu</h2>

          <div
            className="category-wrapper"
            ref={wrapperRef}
            onPointerLeave={() => {
              setShowAll(false);
              setPointerOverBar(false);
            }}
          >
            <button
              className={`cat-scroll-btn left ${
                showLeftArrow ? "visible" : "hidden"
              }`}
              onClick={() => scrollCategories("left")}
              aria-hidden
              disabled={!showLeftArrow}
            >
              ◀
            </button>

            <div
              className="category-bar"
              ref={categoryBarRef}
              onWheel={onCategoryWheel}
              onPointerEnter={() => setPointerOverBar(true)}
              onPointerLeave={() => setPointerOverBar(false)}
            >
              <button
                className="category-toggle"
                aria-label="Show all categories"
                onClick={(e) => {
                  e.stopPropagation(); // keep dropdown open
                  setShowAll((s) => !s);
                }}
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>

              {categories.map((c) => (
                <button
                  key={c.id}
                  data-slug={c.slug}
                  className={`category-pill ${
                    active === c.slug ? "active" : ""
                  }`}
                  onClick={() => switchCategory(c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <button
              className={`cat-scroll-btn right ${
                showRightArrow ? "visible" : "hidden"
              }`}
              onClick={() => scrollCategories("right")}
              aria-hidden
              disabled={!showRightArrow}
            >
              ▶
            </button>

            {/* Animated dropdown — uses `showAll` for class toggling */}
            <div
              className={`category-dropdown ${showAll ? "show" : ""}`}
              onPointerEnter={() => setShowAll(true)}
              onPointerLeave={() => setShowAll(false)}
              aria-hidden={!showAll}
            >
              <ul className="category-dropdown-list" role="list">
                {categories.map((c) => (
                  <li key={c.id}>
                    <button
                      className={`dropdown-item ${
                        active === c.slug ? "active" : ""
                      }`}
                      onClick={() => switchCategory(c.slug)}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {loading ? (
            <p>Loading…</p>
          ) : (
            <div className="items-grid" aria-live="polite">
              {items.map((it) => (
                <div key={String(it.id)} className="item-card-outer">
                  <MenuItemCard item={it} onAdd={() => onAdd(it)} compact />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="menu-right">
          <InlineCart items={items} />
        </aside>
      </div>
    </div>
  );
}
