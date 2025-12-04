// frontend/src/pages/Login.jsx
import React, { useState, useContext } from "react";
import "../styles/login.css";
import api from "../services/api";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);

    if (!email || !password) {
      setErr("Please enter email & password");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const data = res.data || {};
      // Defensive checks
      if (!data.token) {
        setErr("Login failed: no token received from server");
        setLoading(false);
        return;
      }
      // prefer server user, fallback to email-only object
      const userObj = data.user || { email };

      // Save token & user in context + localStorage
      login(data.token, userObj);

      // Navigate to app dashboard
      nav("/app/dashboard");
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "Login failed";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <h2 className="auth-title">Welcome back</h2>
      <p className="auth-sub">Sign in to continue ordering</p>

      <form onSubmit={handleSubmit} className="form-row">
        <input
          className="input"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <p className="error">{err}</p>}

        <button className="primary-cta" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="secondary-link">
        <a href="/forgot">Forgot password?</a>
      </div>
    </div>
  );
}
