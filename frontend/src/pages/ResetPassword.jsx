import React, { useState, useEffect } from "react";
import "../styles/otp.css";
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
    if (!newPass) {
      setMsg("Enter a new password");
      return;
    }

    try {
      await api.post("/auth/reset-password", {
        token,
        email,
        newPassword: newPass,
      });

      setMsg("Password updated! Redirecting to login...");
      setTimeout(() => nav("/login"), 1800);
    } catch (e) {
      setMsg(e.response?.data?.message || "Reset failed");
    }
  }

  return (
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
  );
}
