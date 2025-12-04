// client/src/pages/DeliveryAddress.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/delivery-address.css";

/**
 * DeliveryAddress form (fixed normalization)
 *
 * - Uses backend when logged in (api.getUserAddresses / createUserAddress / updateUserAddress / deleteUserAddress)
 * - Falls back to localStorage when not logged in (key: "saved_addresses")
 * - Stores addresses as objects:
 *   { id, label, name, phone, address, is_default, created_at }
 *
 * - MAX_ADDRESSES controls per-browser / per-user limit.
 */

const LOCAL_KEY = "saved_addresses";
const MAX_ADDRESSES = 5;

export default function DeliveryAddress() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    label: "",
    name: "",
    phone: "",
    address: "",
    is_default: false,
  });

  // simple logged-in heuristic (adapt if you have auth context)
  const isLoggedIn = !!(
    api.defaults &&
    api.defaults.headers &&
    api.defaults.headers.common &&
    api.defaults.headers.common["Authorization"]
  );

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAddresses() {
    setLoading(true);
    setError("");
    try {
      if (isLoggedIn && typeof api.getUserAddresses === "function") {
        const res = await api.getUserAddresses();

        // Robust normalization:
        // - if res.addresses is an array, use it
        // - else if res itself is an array, use it
        // - else fallback to []
        const rows = Array.isArray(res?.addresses)
          ? res.addresses
          : Array.isArray(res)
          ? res
          : [];

        const normalized = rows.map((r) => ({
          id: r.id,
          label: r.label || "",
          name: r.name || "",
          phone: r.phone || "",
          address: r.address || r.address_text || "",
          is_default: !!r.is_default,
          created_at: r.created_at,
        }));
        setAddresses(normalized);
      } else {
        const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
        const normalized = (saved || []).map((s) =>
          typeof s === "string"
            ? {
                id: Date.now() + Math.random(),
                label: "",
                name: "",
                phone: "",
                address: s,
                is_default: false,
                created_at: new Date().toISOString(),
              }
            : {
                id: s.id || Date.now() + Math.random(),
                label: s.label || "",
                name: s.name || "",
                phone: s.phone || "",
                address: s.address || s.text || "",
                is_default: !!s.is_default,
                created_at: s.created_at || new Date().toISOString(),
              }
        );
        setAddresses(normalized);
      }
    } catch (err) {
      console.error("Failed to load addresses, fallback to localStorage:", err);
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      const normalized = (saved || []).map((s) =>
        typeof s === "string"
          ? {
              id: Date.now() + Math.random(),
              label: "",
              name: "",
              phone: "",
              address: s,
              is_default: false,
              created_at: new Date().toISOString(),
            }
          : {
              id: s.id || Date.now() + Math.random(),
              label: s.label || "",
              name: s.name || "",
              phone: s.phone || "",
              address: s.address || s.text || "",
              is_default: !!s.is_default,
              created_at: s.created_at || new Date().toISOString(),
            }
      );
      setAddresses(normalized);
    } finally {
      setLoading(false);
    }
  }

  function persistLocal(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    setAddresses(list);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ label: "", name: "", phone: "", address: "", is_default: false });
    setError("");
    setSuccess("");
  }

  function onChange(field, value) {
    setForm((s) => ({ ...s, [field]: value }));
    setError("");
    setSuccess("");
  }

  function validateForm() {
    if (!form.name || !form.name.trim()) {
      setError("Recipient name is required.");
      return false;
    }
    if (!form.phone || !form.phone.trim()) {
      setError("Mobile number is required.");
      return false;
    }
    if (!form.address || !form.address.trim()) {
      setError("Address is required.");
      return false;
    }
    return true;
  }

  async function saveNew() {
    setError("");
    setSuccess("");
    if (!validateForm()) return;

    if (!editingId && addresses.length >= MAX_ADDRESSES) {
      setError(`Address limit reached (${MAX_ADDRESSES}).`);
      return;
    }

    const payload = {
      label: form.label?.trim() || null,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      is_default: !!form.is_default,
    };

    try {
      if (isLoggedIn && typeof api.createUserAddress === "function") {
        if (editingId) {
          await api.updateUserAddress(editingId, {
            address: payload.address,
            label: payload.label,
            is_default: payload.is_default,
            name: payload.name,
            phone: payload.phone,
          });
        } else {
          await api.createUserAddress({
            address: payload.address,
            label: payload.label,
            is_default: payload.is_default,
            name: payload.name,
            phone: payload.phone,
          });
        }
        await loadAddresses();
        resetForm();
        setSuccess("Address saved.");
      } else {
        if (editingId) {
          const next = addresses.map((a) =>
            a.id === editingId ? { ...a, ...payload } : a
          );
          if (payload.is_default)
            next.forEach((x) => {
              if (x.id !== editingId) x.is_default = false;
            });
          persistLocal(next);
          resetForm();
          setSuccess("Address updated (local).");
        } else {
          const newItem = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString(),
          };
          const next = [...addresses, newItem];
          if (newItem.is_default)
            next.forEach((x) => {
              if (x.id !== newItem.id) x.is_default = false;
            });
          persistLocal(next);
          resetForm();
          setSuccess("Address saved (local).");
        }
      }
    } catch (e) {
      console.error("Save address failed:", e);
      setError(e?.response?.data?.error || "Failed to save address.");
    }
  }

  async function remove(id) {
    setError("");
    setSuccess("");
    if (!confirm("Delete this address?")) return;
    try {
      if (isLoggedIn && typeof api.deleteUserAddress === "function") {
        await api.deleteUserAddress(id);
        await loadAddresses();
        setSuccess("Address deleted.");
      } else {
        const next = addresses.filter((a) => a.id !== id);
        persistLocal(next);
        setSuccess("Address deleted (local).");
      }
    } catch (e) {
      console.error("Delete failed:", e);
      setError("Failed to delete address.");
    }
  }

  function edit(a) {
    setEditingId(a.id);
    setForm({
      label: a.label || "",
      name: a.name || "",
      phone: a.phone || "",
      address: a.address || "",
      is_default: !!a.is_default,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function setAsDefault(a) {
    setError("");
    setSuccess("");
    try {
      if (isLoggedIn && typeof api.updateUserAddress === "function") {
        await api.updateUserAddress(a.id, {
          address: a.address,
          label: a.label,
          is_default: true,
          name: a.name,
          phone: a.phone,
        });
        await loadAddresses();
        setSuccess("Default address set.");
      } else {
        const next = addresses.map((x) => ({
          ...x,
          is_default: x.id === a.id,
        }));
        persistLocal(next);
        setSuccess("Default address set (local).");
      }
    } catch (e) {
      console.error("Set default failed:", e);
      setError("Failed to set default.");
    }
  }

  function useAsCurrent(a) {
    const cur = JSON.parse(localStorage.getItem("customer_info") || "{}");
    const next = {
      ...cur,
      address: a.address,
      name: a.name || cur.name || "",
      phone: a.phone || cur.phone || "",
    };
    localStorage.setItem("customer_info", JSON.stringify(next));
    window.dispatchEvent(new Event("customer_info.updated"));
    setSuccess("Selected for checkout.");
  }

  return (
    <div className="da-container">
      <div className="da-card">
        <h1 className="da-title">Delivery addresses</h1>
        <p className="da-sub">
          Add addresses you use frequently. Stored{" "}
          {isLoggedIn ? "for your account" : "in this browser (localStorage)"}.
        </p>

        <div className="da-form">
          <div className="da-row">
            <input
              className="da-input"
              value={form.label}
              onChange={(e) => onChange("label", e.target.value)}
              placeholder="Label (Home, Work) — optional"
            />
            <input
              className="da-input small"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="Mobile (required)"
            />
          </div>

          <div className="da-row">
            <input
              className="da-input"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Recipient name (required)"
            />
            <label className="da-checkbox">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => onChange("is_default", e.target.checked)}
              />
              <span>Set as default</span>
            </label>
          </div>

          <textarea
            className="da-textarea"
            value={form.address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="Full address — street, area, city, postcode (required)"
            rows={4}
          />

          {error && <div className="da-error">{error}</div>}
          {success && <div className="da-success">{success}</div>}

          <div className="da-actions">
            <button className="btn btn-primary" onClick={saveNew}>
              {editingId ? "Save changes" : "Save address"}
            </button>
            {editingId && (
              <button className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
            <div className="da-limit">
              Saved: <strong>{addresses.length}</strong> • limit:{" "}
              <strong>{MAX_ADDRESSES}</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="da-list">
        {loading ? (
          <div className="da-empty">Loading…</div>
        ) : addresses.length === 0 ? (
          <div className="da-empty">No saved addresses yet.</div>
        ) : (
          addresses.map((a) => (
            <div
              key={a.id}
              className={`da-item ${a.is_default ? "da-default" : ""}`}
            >
              <div className="da-item-main">
                <div className="da-item-head">
                  <div className="da-item-label">{a.label || "Address"}</div>
                  {a.is_default && <div className="da-badge">Default</div>}
                </div>
                <div className="da-item-recipient">
                  <div className="da-item-name">{a.name || "—"}</div>
                  <div className="da-item-phone">{a.phone || ""}</div>
                </div>
                <div className="da-item-address">{a.address}</div>

                <div className="da-item-actions">
                  <button className="btn" onClick={() => useAsCurrent(a)}>
                    Use
                  </button>
                  <button className="btn" onClick={() => edit(a)}>
                    Edit
                  </button>
                  <button className="btn" onClick={() => setAsDefault(a)}>
                    Set default
                  </button>
                  <button
                    className="btn btn-reject"
                    onClick={() => remove(a.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="da-item-meta">
                <div className="da-item-saved">Saved</div>
                <div className="da-item-time">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
