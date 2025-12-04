// client/src/components/CheckoutForm.jsx
import React, { useEffect, useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import api from "../services/api";

/**
 * CheckoutForm component
 * - Shows saved addresses dropdown (backend-first, localStorage fallback)
 * - Selecting a saved address populates name, phone, address fields
 * - Supports card (Stripe) and cash
 */

export default function CheckoutForm({ onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();

  const [cart, setCart] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // saved addresses (normalized objects)
  // shape: { id, label, name, phone, address, is_default, created_at }
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [deliveryType, setDeliveryType] = useState("delivery"); // default

  /* ------------------------------------------------
     load cart, initial customer_info and saved addresses
  --------------------------------------------------*/
  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("cart") || "[]"));
    } catch {
      setCart([]);
    }

    try {
      const savedCustomer = JSON.parse(
        localStorage.getItem("customer_info") || "{}"
      );
      setName(savedCustomer.name || "");
      setPhone(savedCustomer.phone || "");
      setAddress(savedCustomer.address || "");
    } catch {}

    // load saved addresses (backend-first if logged-in)
    loadSavedAddresses();

    try {
      setNotes(localStorage.getItem("cart_notes") || "");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------
     loadSavedAddresses: backend-first, fallback localStorage
  --------------------------------------------------*/
  async function loadSavedAddresses() {
    // helper to normalize rows
    const normalize = (rows) =>
      (rows || []).map((r) =>
        typeof r === "string" || typeof r.text === "string"
          ? {
              id: r.id || Date.now() + Math.random(),
              label: r.label || "",
              name: r.name || "",
              phone: r.phone || "",
              address: r.text || r.address || r,
              is_default: !!r.is_default,
              created_at: r.created_at || new Date().toISOString(),
            }
          : {
              id: r.id,
              label: r.label || "",
              name: r.name || "",
              phone: r.phone || "",
              address: r.address || r.address_text || "",
              is_default: !!r.is_default,
              created_at: r.created_at,
            }
      );

    try {
      // heuristic: logged-in if Authorization header present
      const isLoggedIn =
        !!(
          api.defaults &&
          api.defaults.headers &&
          api.defaults.headers.common &&
          api.defaults.headers.common["Authorization"]
        ) && typeof api.getUserAddresses === "function";

      if (isLoggedIn) {
        const res = await api.getUserAddresses();
        // robustly find array: res.addresses or res (array)
        const rows = Array.isArray(res?.addresses)
          ? res.addresses
          : Array.isArray(res)
          ? res
          : [];
        setSavedAddresses(normalize(rows));
        return;
      }
    } catch (err) {
      // swallow and fallback to localStorage
      console.warn(
        "Failed to load backend addresses, falling back to localStorage",
        err
      );
    }

    try {
      const saved = JSON.parse(localStorage.getItem("saved_addresses") || "[]");
      setSavedAddresses(normalize(saved));
    } catch {
      setSavedAddresses([]);
    }
  }

  /* ------------------------------------------------
     when the selectedAddressId changes, populate fields
  --------------------------------------------------*/
  useEffect(() => {
    if (!selectedAddressId) return;
    const chosen = savedAddresses.find(
      (a) => String(a.id) === String(selectedAddressId)
    );
    if (!chosen) return;

    // Fill in fields (do not override if empty? we overwrite to match selection)
    if (chosen.name) setName(chosen.name);
    if (chosen.phone) setPhone(chosen.phone);
    if (chosen.address) setAddress(chosen.address);

    // persist to customer_info for checkout convenience
    try {
      const cur = JSON.parse(localStorage.getItem("customer_info") || "{}");
      const merged = {
        ...cur,
        name: chosen.name || cur.name,
        phone: chosen.phone || cur.phone,
        address: chosen.address || cur.address,
      };
      localStorage.setItem("customer_info", JSON.stringify(merged));
      window.dispatchEvent(new Event("customer_info.updated"));
    } catch (e) {}
  }, [selectedAddressId, savedAddresses]);

  const subtotal = cart.reduce((sum, item) => {
    const price =
      item.price_gbp ??
      item.price ??
      (item.price_pence ? item.price_pence / 100 : 0);
    return sum + price * (item.qty || 1);
  }, 0);

  /* ------------------------------------------------
     handle submit (card + cash)
  --------------------------------------------------*/
  async function handleSubmit(e) {
    e.preventDefault();

    const nameTrim = (name || "").trim();
    const phoneTrim = (phone || "").trim();
    const addressTrim = (address || "").trim();

    if (!nameTrim) return setMessage("Full name is required.");
    if (!phoneTrim) return setMessage("Mobile number is required.");

    if (deliveryType === "delivery" && !addressTrim)
      return setMessage("Delivery address is required for Delivery orders.");

    if (!cart || cart.length === 0)
      return setMessage("Your cart is empty. Add items before paying.");

    if (paymentMethod === "card" && (!stripe || !elements)) {
      return setMessage("Stripe not ready. Please wait a moment.");
    }

    setProcessing(true);
    setMessage("");

    try {
      const customerInfo = {
        name: nameTrim,
        phone: phoneTrim,
        // for pickup we store an empty address (backend can rely on delivery_type)
        address: deliveryType === "delivery" ? addressTrim : "",
      };

      // persist basic customer info (address persisted only for delivery)
      try {
        localStorage.setItem("customer_info", JSON.stringify(customerInfo));
      } catch {}

      const payload = {
        items: cart,
        notes: notes || undefined,
        customer: customerInfo,
        delivery_type: deliveryType, // <-- important: send delivery_type to backend
      };

      if (paymentMethod === "cash") {
        try {
          const res = await api.createCashOrder(payload);
          if (!res) throw new Error("No response from server");

          setMessage("Order placed (cash). Please pay on delivery/pickup.");
          localStorage.removeItem("cart");
          localStorage.removeItem("cart_notes");
          localStorage.removeItem("inflight_payment_pid");
          window.dispatchEvent(new Event("cart.updated"));

          if (onPaymentSuccess) onPaymentSuccess(res.order || null);

          window.location.href = "/app/orders";
        } catch (err) {
          console.error("createCashOrder error:", err);
          setMessage(err.message || "Failed to create cash order.");
        } finally {
          setProcessing(false);
        }
        return;
      }

      // Card flow
      const res = await api.createPaymentIntent(payload);
      if (!res?.clientSecret) throw new Error("No clientSecret from server");

      if (res.stripe_pid)
        localStorage.setItem("inflight_payment_pid", res.stripe_pid);

      const result = await stripe.confirmCardPayment(res.clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) {
        setMessage(result.error.message || "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        setMessage("Payment successful!");
        localStorage.removeItem("cart");
        localStorage.removeItem("cart_notes");
        localStorage.removeItem("inflight_payment_pid");
        window.dispatchEvent(new Event("cart.updated"));

        if (onPaymentSuccess) onPaymentSuccess(result.paymentIntent);

        window.location.href = "/app/orders";
      } else {
        setMessage("Payment did not succeed.");
      }
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Payment failed.");
    }

    setProcessing(false);
  }

  /* ------------------------------------------------
     helper to format dropdown option text
  --------------------------------------------------*/
  function formatAddressOption(a) {
    const namePart = a.name ? `${a.name}` : "";
    const phonePart = a.phone ? ` • ${a.phone}` : "";
    const addr = a.address
      ? ` — ${a.address.length > 60 ? a.address.slice(0, 60) + "…" : a.address}`
      : "";
    const label = a.label ? `${a.label}: ` : "";
    return `${label}${namePart}${phonePart}${addr}`;
  }

  /* ------------------------------------------------
     RENDER
  --------------------------------------------------*/
  return (
    <form
      onSubmit={handleSubmit}
      className="checkout-form"
      style={{ maxWidth: 720 }}
    >
      <h3 style={{ marginBottom: 10 }}>Order Type</h3>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="radio"
            name="deliveryType"
            value="delivery"
            checked={deliveryType === "delivery"}
            onChange={() => setDeliveryType("delivery")}
          />
          Delivery
        </label>

        <label style={{ marginLeft: 20 }}>
          <input
            type="radio"
            name="deliveryType"
            value="pickup"
            checked={deliveryType === "pickup"}
            onChange={() => setDeliveryType("pickup")}
          />
          Pick-Up
        </label>
      </div>

      {/* show delivery details only when delivery is selected */}
      {deliveryType === "delivery" && (
        <>
          <h3 style={{ marginBottom: 10 }}>Delivery details</h3>

          {/* saved addresses dropdown */}
          {savedAddresses && savedAddresses.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{ display: "block", marginBottom: 6, color: "#374151" }}
              >
                Saved addresses
              </label>
              <select
                value={selectedAddressId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedAddressId(val || null);
                  if (!val) {
                    // clear selection — do not clear user inputs
                    // setName(""); setPhone(""); setAddress("");
                  }
                }}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              >
                <option value="">— select saved address —</option>
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatAddressOption(a)}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6 }}>
                <a href="/app/address" className="btn btn-ghost">
                  Manage addresses
                </a>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (required)"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (required)"
              required
            />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Delivery address — street, city, postcode (required)"
              rows={3}
              required
            />
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                localStorage.setItem("cart_notes", e.target.value || "");
              }}
              placeholder="Order notes (optional)"
              rows={2}
            />
          </div>
        </>
      )}

      {/* for pickup, still collect name/phone and notes */}
      {deliveryType === "pickup" && (
        <>
          <h3 style={{ marginBottom: 10 }}>Pick-Up details</h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (required)"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (required)"
              required
            />
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                localStorage.setItem("cart_notes", e.target.value || "");
              }}
              placeholder="Order notes (optional)"
              rows={2}
            />
          </div>
        </>
      )}

      <h3 style={{ marginTop: 10, marginBottom: 8 }}>Payment</h3>

      <div
        className="stripe-card-wrapper"
        style={{
          padding: 12,
          border: "1px solid #e6e7ea",
          borderRadius: 8,
          marginBottom: 8,
        }}
      >
        {paymentMethod === "card" && (
          <CardElement options={{ hidePostalCode: true }} />
        )}
        {paymentMethod !== "card" && (
          <div style={{ color: "#6b7280" }}>
            Card entry hidden for cash orders
          </div>
        )}
      </div>

      {message && (
        <div style={{ marginTop: 10, color: "crimson" }}>{message}</div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="paymentMethod"
            value="card"
            checked={paymentMethod === "card"}
            onChange={() => setPaymentMethod("card")}
          />{" "}
          Card (online)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="radio"
            name="paymentMethod"
            value="cash"
            checked={paymentMethod === "cash"}
            onChange={() => setPaymentMethod("cash")}
          />{" "}
          Cash (pay on pickup/delivery)
        </label>
      </div>

      <button
        className="btn-primary"
        type="submit"
        disabled={(!stripe && paymentMethod === "card") || processing}
        style={{ marginTop: 12 }}
      >
        {processing
          ? "Processing…"
          : paymentMethod === "card"
          ? `Pay £${subtotal.toFixed(2)}`
          : `Place cash order £${subtotal.toFixed(2)}`}
      </button>
    </form>
  );
}
