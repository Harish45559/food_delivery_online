// frontend/src/pages/Profile.jsx
import React, { useEffect, useState, useContext } from "react";
import "../styles/profile.css";
import api from "../services/api";
import { AuthContext } from "../contexts/AuthContext";

export default function Profile() {
  const { user, login } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    dob: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postcode: "",
    country: "",
  });

  const [originalForm, setOriginalForm] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/auth/me");
        const u = res.data?.user;
        if (!u) throw new Error("No user returned");
        if (!mounted) return;

        const initial = {
          name: u.name || "",
          email: u.email || "",
          mobile: u.mobile || "",
          dob: u.dob ? (u.dob.split ? u.dob.split("T")[0] : u.dob) : "",
          addressLine1: u.addressLine1 || "",
          addressLine2: u.addressLine2 || "",
          city: u.city || "",
          county: u.county || "",
          postcode: u.postcode || "",
          country: u.country || "",
        };

        setForm(initial);
        setOriginalForm(initial);
      } catch (e) {
        console.error("Failed to load profile", e);
        setErr(e.response?.data?.message || e.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => (mounted = false);
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function enterEdit() {
    setErr(null);
    setMsg(null);
    setEditMode(true);
  }

  function cancelEdit() {
    if (originalForm) setForm(originalForm);
    setErr(null);
    setMsg(null);
    setEditMode(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!form.name) {
      setErr("Please enter your name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        mobile: form.mobile || null,
        dob: form.dob || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        county: form.county || null,
        postcode: form.postcode || null,
        country: form.country || null,
      };

      const res = await api.put("/auth/me", payload);
      const updated = res.data?.user;
      if (!updated) throw new Error("Server did not return updated user");

      // update context and local storage
      const token = localStorage.getItem("token");
      login(token, updated);

      setOriginalForm({
        name: updated.name || "",
        email: updated.email || "",
        mobile: updated.mobile || "",
        dob: updated.dob ? (updated.dob.split ? updated.dob.split("T")[0] : updated.dob) : "",
        addressLine1: updated.addressLine1 || "",
        addressLine2: updated.addressLine2 || "",
        city: updated.city || "",
        county: updated.county || "",
        postcode: updated.postcode || "",
        country: updated.country || "",
      });
      setForm((f) => ({ ...f })); // keep current values
      setMsg("Profile saved");
      setEditMode(false);
    } catch (e) {
      console.error("Save profile error", e);
      setErr(e.response?.data?.message || e.message || "Failed to save profile");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="profile-page container">
        <div className="profile-card card">
          <h2>Profile</h2>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page container">
      <div className="profile-card card">
        <div className="profile-header" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>{form.name || form.email}</h2>
            <p className="text-muted">{user?.role ? `Role: ${user.role}` : ""}</p>
          </div>

          <div>
            {!editMode ? (
              <button className="btn btn-outline" onClick={enterEdit}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" onClick={cancelEdit} disabled={saving}>Cancel</button>
                <button className="submit-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            )}
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <div className="grid-2">
            <div>
              <label className="label">Full name</label>
              <input name="name" className="input" value={form.name} onChange={onChange} disabled={!editMode} />

              <label className="label">Email</label>
              <input name="email" className="input" value={form.email} readOnly />

              <label className="label">Mobile</label>
              <input name="mobile" className="input" value={form.mobile} onChange={onChange} disabled={!editMode} />

              <label className="label">Date of birth</label>
              <input name="dob" type="date" className="input" value={form.dob} onChange={onChange} disabled={!editMode} />
            </div>

            <div>
              <label className="label">Address line 1</label>
              <input name="addressLine1" className="input" value={form.addressLine1} onChange={onChange} disabled={!editMode} />

              <label className="label">Address line 2</label>
              <input name="addressLine2" className="input" value={form.addressLine2} onChange={onChange} disabled={!editMode} />

              <label className="label">City</label>
              <input name="city" className="input" value={form.city} onChange={onChange} disabled={!editMode} />

              <label className="label">County / State</label>
              <input name="county" className="input" value={form.county} onChange={onChange} disabled={!editMode} />
            </div>
          </div>

          <div className="grid-2 mt-12">
            <div>
              <label className="label">Postcode</label>
              <input name="postcode" className="input" value={form.postcode} onChange={onChange} disabled={!editMode} />
            </div>
            <div>
              <label className="label">Country</label>
              <input name="country" className="input" value={form.country} onChange={onChange} disabled={!editMode} />
            </div>
          </div>

          {err && <p className="error mt-12">{err}</p>}
          {msg && <p className="helper mt-12">{msg}</p>}

          {editMode && (
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={cancelEdit} disabled={saving}>Cancel</button>
              <button type="submit" className="submit-btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
