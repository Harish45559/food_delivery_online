import React, { useState } from "react";
import "../styles/forgot.css";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    if (!email) {
      setMsg("Please enter a valid email");
      return;
    }

    try {
      await api.post("/auth/forgot-password", { email });
      setMsg("If the email exists, a reset link has been sent.");
    } catch (e) {
      setMsg("Something went wrong.");
    }
  }

  return (
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
  );
}
