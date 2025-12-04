// client/src/components/Dashboard.jsx
// Based off your original Dashboard.jsx. Shows a Delivery addresses button + quick modal.
import React, { useEffect, useState } from "react";

export default function Dashboard() {
  const [addresses, setAddresses] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("saved_addresses") || "[]");
      setAddresses(saved);
    } catch {
      setAddresses([]);
    }
  }, []);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return (
    <div style={{ padding: 20 }}>
      <h2>Dashboard</h2>
      <p>Overview of sales, orders, and quick stats.</p>
      <div style={{ marginTop: 16 }}>
        <div>
          Today's Orders: <strong>12</strong>
        </div>
        <div>
          Live Orders: <strong>3</strong>
        </div>
        <div>
          Revenue: <strong>₹5,420</strong>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="btn btn-primary" onClick={openModal}>
          Delivery addresses ({addresses.length})
        </button>
        <a href="/app/address" className="btn" style={{ marginLeft: 12 }}>
          Manage addresses
        </a>
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            zIndex: 1200,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              width: 520,
              maxHeight: "70vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 20px 60px rgba(2,6,23,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Saved delivery addresses</h3>
              <button className="btn" onClick={closeModal}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              {addresses.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    color: "#6b7280",
                    background: "#f9fafb",
                    borderRadius: 8,
                  }}
                >
                  No saved addresses in this browser.
                </div>
              ) : (
                addresses.map((a) => (
                  <div
                    key={a.id}
                    style={{ padding: 10, borderBottom: "1px solid #eee" }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{a.text}</div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <a href="/app/address" className="btn btn-primary">
                Manage addresses
              </a>
              <button className="btn" onClick={closeModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
