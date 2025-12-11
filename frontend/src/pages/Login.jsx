import React, { useState, useContext } from "react";
import "../styles/login.css";
import "../styles/auth-background.css";
import heroBg from "../assets/landing-food.jpg";
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

    if (!email || !password) return setErr("Please enter email & password");

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const data = res.data || {};

      if (!data.token) return setErr("Login failed: no token received");

      const userObj = data.user || { email };

      login(data.token, userObj);
      nav("/app/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg-root">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
      />

      <div className="auth-bg-content">
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
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {err && <p className="error">{err}</p>}

            <button className="primary-cta" type="submit">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="secondary-link">
            <a href="/forgot">Forgot password?</a>
          </div>
        </div>
      </div>
    </div>
  );
}
