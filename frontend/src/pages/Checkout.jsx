// client/src/pages/Checkout.jsx
import React from "react";
import CheckoutForm from "../components/CheckoutForm";

// Stripe provider
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

/**
 * Checkout page
 *
 * Important:
 * - Make sure you set VITE_STRIPE_PUBLISHABLE_KEY in your .env (or replace below)
 * - This wraps CheckoutForm in <Elements>, so useStripe() / useElements() will work
 */

// prefer env var, fallback to a placeholder (replace if testing)
const stripePubKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_replace_me_do_not_use";

// Create stripePromise once (loadStripe caches internally)
const stripePromise = loadStripe(stripePubKey);

export default function Checkout() {
  return (
    <div
      style={{
        padding: 20,
        maxWidth: 1100,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 24,
      }}
    >
      <div>
        <h2>Checkout</h2>
        <p style={{ color: "#6b7280" }}>
          Review your order and enter delivery details.
        </p>

        {/* Wrap the form in Elements so it has Stripe context */}
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>

      <aside
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e6e7eb",
          height: "fit-content",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Order summary</h3>
        <div id="order-summary" style={{ color: "#374151" }}>
          <p style={{ margin: 0 }}>
            Items in your cart will be listed here (your existing summary
            component).
          </p>
          <p style={{ marginTop: 10, color: "#6b7280" }}>
            Tip: use the "Manage addresses" link to add or select saved
            addresses.
          </p>
        </div>
      </aside>
    </div>
  );
}
