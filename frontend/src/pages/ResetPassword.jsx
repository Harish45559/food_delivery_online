import React, { useState } from "react";
import "../styles/auth-background.css";
import "../styles/otp.css";
import heroBg from "../assets/landing-food.jpg";
import api from "../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [search] = useSearchParams();
  const token = search.get("token");
  const email = search.get("email");

  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();

  async function handleReset() {
    if (!newPass) return setMsg("Enter a new password");

    try {
      await api.post("/auth/reset-password", {
        token,
        email,
        newPassword: newPass,
      });

      setMsg("Password updated! Redirecting...");
      setTimeout(() => nav("/login"), 1600);
    } catch (e) {
      setMsg(e.response?.data?.message || "Reset failed");
    }
  }

  return (
    <div className="auth-bg-root">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
      />

      <div className="auth-bg-content">
        <div className="otp-wrapper">
          <h2 className="otp-title">Reset password</h2>
          <p className="otp-desc">For: {email}</p>

          <input
            className="otp-input"
            style={{ width: "100%", fontSize: 16 }}
            type="password"
            placeholder="New password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />

          <button className="otp-submit" onClick={handleReset}>
            Update password
          </button>

          {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}
