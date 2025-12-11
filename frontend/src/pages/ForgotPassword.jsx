import React, { useState } from "react";
import "../styles/forgot.css";
import "../styles/auth-background.css";
import api from "../services/api";
import heroBg from "../assets/landing-food.jpg";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    if (!email) return setMsg("Please enter a valid email");

    try {
      await api.post("/auth/forgot-password", { email });
      setMsg("If the email exists, a reset link has been sent.");
    } catch {
      setMsg("Something went wrong.");
    }
  }

  return (
    <div className="auth-bg-root">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
      />

      <div className="auth-bg-content">
        <div className="forgot-card">
          <h2 className="forgot-title">Forgot password</h2>
          <p className="forgot-desc">We’ll send you a reset link</p>

          <input
            className="input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button className="send-btn" onClick={handleSubmit}>
            Send reset link
          </button>

          {msg && <p className="note">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
