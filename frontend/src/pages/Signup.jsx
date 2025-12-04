import React, { useState } from "react";
import "../styles/signup.css";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [stage, setStage] = useState("form"); // 'form' or 'otp'
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setErr(null);
    if (!name || !email || !pass) {
      setErr("All fields are required");
      return;
    }
    try {
      const { data } = await api.post("/auth/register", { name, email, password: pass });
      setMsg(data?.message || "Account created. Enter OTP sent to your email.");
      setStage("otp");
    } catch (e) {
      setErr(e.response?.data?.message || "Signup failed");
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setErr(null);
    if (!otp) {
      setErr("Enter OTP");
      return;
    }
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      setMsg(data?.message || "Verified. Redirecting to login...");
      setTimeout(() => nav("/login"), 1400);
    } catch (e) {
      setErr(e.response?.data?.message || "OTP verification failed");
    }
  }

  return (
    <div className="signup-wrapper">
      {stage === "form" && (
        <>
          <div className="signup-header">
            <h2 className="signup-title">Create account</h2>
          </div>

          <form onSubmit={handleSignup}>
            <div className="field-grid">
              <div className="field full-row">
                <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="field full-row">
                <input className="input" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="field full-row">
                <input className="input" placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>
            </div>

            {err && <p className="error">{err}</p>}
            {msg && <p className="helper">{msg}</p>}

            <p className="terms">By creating an account, you agree to our Terms & Privacy Policy.</p>

            <button className="submit-btn" type="submit">Create account</button>
          </form>
        </>
      )}

      {stage === "otp" && (
        <div style={{ textAlign: "center" }}>
          <h3 style={{ marginBottom: 6 }}>Enter verification code</h3>
          <p className="helper">We sent a code to <strong>{email}</strong></p>

          <form onSubmit={handleVerifyOtp}>
            <div style={{ maxWidth: 320, margin: "12px auto" }}>
              <input className="input" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
              {err && <p className="error">{err}</p>}
              {msg && <p className="helper">{msg}</p>}
              <button className="submit-btn" style={{ marginTop: 12 }} type="submit">Verify</button>
            </div>
          </form>

          <div style={{ marginTop: 10 }}>
            <button className="btn btn-outline" onClick={() => { setStage("form"); setMsg(""); setErr(null); }}>Use different email</button>
          </div>
        </div>
      )}
    </div>
  );
}
