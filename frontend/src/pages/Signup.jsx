import React, { useState } from "react";
import "../styles/signup.css";
import "../styles/auth-background.css";
import heroBg from "../assets/landing-food.jpg";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [stage, setStage] = useState("form");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(null);

  async function handleSignup(e) {
    e.preventDefault();
    setErr(null);
    if (!name || !email || !pass) return setErr("All fields are required");

    try {
      const { data } = await api.post("/auth/register", {
        name,
        email,
        password: pass,
      });

      setMsg(data?.message || "Account created. Enter OTP sent to email.");
      setStage("otp");
    } catch (e) {
      setErr(e.response?.data?.message || "Signup failed");
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setErr(null);
    if (!otp) return setErr("Enter OTP");

    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      setMsg(data?.message || "Verified. Redirecting...");
      setTimeout(() => nav("/login"), 1500);
    } catch (e) {
      setErr(e.response?.data?.message || "OTP verification failed");
    }
  }

  return (
    <div className="auth-bg-root">
      <div
        className="auth-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
      />

      <div className="auth-bg-content">
        <div className="signup-wrapper">
          {stage === "form" && (
            <>
              <h2 className="signup-title">Create account</h2>

              <form onSubmit={handleSignup}>
                <div className="field-grid">
                  <input
                    className="input"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

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
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </div>

                {err && <p className="error">{err}</p>}
                {msg && <p className="helper">{msg}</p>}

                <p className="terms">
                  By creating an account, you agree to our Terms & Privacy Policy.
                </p>

                <button className="submit-btn" type="submit">
                  Create account
                </button>
              </form>
            </>
          )}

          {stage === "otp" && (
            <div style={{ textAlign: "center" }}>
              <h3>Enter verification code</h3>
              <p className="helper">Code sent to <strong>{email}</strong></p>

              <form onSubmit={handleVerifyOtp}>
                <input
                  className="input"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />

                {err && <p className="error">{err}</p>}
                {msg && <p className="helper">{msg}</p>}

                <button className="submit-btn" style={{ marginTop: 12 }}>
                  Verify
                </button>
              </form>

              <button
                className="btn btn-outline"
                onClick={() => {
                  setStage("form");
                  setErr(null);
                  setMsg("");
                }}
              >
                Use different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
