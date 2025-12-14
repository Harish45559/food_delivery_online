const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mailerModule = require("../config/mailer");

async function sendMailSafe(mailOptions = {}) {
  if (!mailOptions.from) {
    mailOptions.from = {
      name: process.env.MAIL_FROM_NAME || "No Reply",
      address: process.env.MAIL_FROM_ADDRESS,
    };
  }

  if (mailerModule && typeof mailerModule.sendMail === "function") {
    return mailerModule.sendMail(mailOptions);
  }

  if (
    mailerModule &&
    mailerModule.transporter &&
    typeof mailerModule.transporter.sendMail === "function"
  ) {
    const info = await mailerModule.transporter.sendMail(mailOptions);

    try {
      const nodemailer = require("nodemailer");
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) info.previewUrl = preview;
    } catch (e) {
      /* ignore */
    }
    return info;
  }

  throw new Error("No mailer available");
}

const OTP_LENGTH = 6;
const OTP_EXP_MIN = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

function generateOtp(length = OTP_LENGTH) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++)
    otp += digits[Math.floor(Math.random() * digits.length)];
  return otp;
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // create user as inactive (is_active = false)
    const q = `INSERT INTO users (name, email, password_hash, is_active) VALUES ($1,$2,$3,false) RETURNING id,email,name`;
    let user;
    try {
      const { rows } = await db.query(q, [name || null, email, hashed]);
      user = rows[0];
    } catch (err) {
      // unique violation -> email exists
      if (err && err.code === "23505") {
        return res.status(400).json({ message: "Email already registered" });
      }
      console.error("register - db error", err && err.stack ? err.stack : err);
      throw err;
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    await db.query(
      "UPDATE users SET otp_code=$1, otp_expires_at=$2 WHERE id=$3",
      [otp, expiresAt, user.id]
    );

    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/verify?email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: {
        name: process.env.MAIL_FROM_NAME || "No Reply",
        address: process.env.MAIL_FROM_ADDRESS,
      },
      to: email,
      subject: "Verify your account - OTP",
      text: `Your verification code is ${otp}. It expires in ${OTP_EXP_MIN} minutes.`,
      html: `<p>Your verification code is <strong>${otp}</strong>. It expires in ${OTP_EXP_MIN} minutes.</p><p>If you did not request this, please ignore.</p><p>Or verify here: <a href="${resetUrl}">${resetUrl}</a></p>`,
    };

    try {
      const info = await sendMailSafe(mailOptions);
      if (info && info.previewUrl) {
        console.log("Signup email preview URL:", info.previewUrl);
      }
    } catch (mailErr) {
      console.warn(
        "Failed to send signup OTP email:",
        mailErr && mailErr.message ? mailErr.message : mailErr
      );
      return res.status(201).json({
        message:
          "Account created but failed to send OTP email. Please contact support.",
      });
    }

    return res.status(201).json({
      message:
        "Account created. Please verify using the OTP sent to your email",
      email: user.email,
    });
  } catch (err) {
    console.error("register error", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = rows[0];
    if (!user) return res.status(400).json({ message: "Invalid request" });

    if (!user.otp_code || !user.otp_expires_at)
      return res.status(400).json({ message: "No OTP requested" });

    if (user.otp_code !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (new Date(user.otp_expires_at) < new Date())
      return res.status(400).json({ message: "OTP expired" });

    await db.query(
      "UPDATE users SET is_active=true, otp_code=NULL, otp_expires_at=NULL WHERE id=$1",
      [user.id]
    );

    return res.json({ message: "Account verified. You can now login." });
  } catch (err) {
    console.error("verifyOtp error", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // ensure account is active (verified)
    if (!user.is_active)
      return res
        .status(403)
        .json({ message: "Account not verified. Please verify your email." });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        role: user.role || "user",
      },
    });
  } catch (err) {
    console.error("login error", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = rows[0];
    if (!user)
      return res
        .status(200)
        .json({ message: "If the email exists, a reset link has been sent" });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(
      Date.now() + (Number(process.env.RESET_EXP_MINUTES) || 15) * 60 * 1000
    );
    await db.query(
      "UPDATE users SET reset_token=$1, reset_expires_at=$2 WHERE id=$3",
      [token, expiresAt, user.id]
    );

    const resetUrl = `${
      process.env.FRONTEND_URL || "https://food-delivery-online-1.onrender.com"
    }/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
    const mailOptions = {
      from: {
        name: process.env.MAIL_FROM_NAME || "No Reply",
        address: process.env.MAIL_FROM_ADDRESS,
      },
      to: user.email,
      subject: "Password reset link",
      text: `Click the link to reset your password (valid for ${
        Number(process.env.RESET_EXP_MINUTES) || 15
      } minutes): ${resetUrl}`,
      html: `<p>Click the link to reset your password (valid for ${
        Number(process.env.RESET_EXP_MINUTES) || 15
      } minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    };

    try {
      const info = await sendMailSafe(mailOptions);
      if (info && info.previewUrl)
        console.log("Reset email preview URL:", info.previewUrl);
    } catch (e) {
      console.warn(
        "Failed to send reset email:",
        e && e.message ? e.message : e
      );
    }

    return res.json({
      message: "If the email exists, a reset link has been sent",
    });
  } catch (err) {
    console.error("forgotPassword error", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword)
      return res.status(400).json({ message: "Missing fields" });

    const { rows } = await db.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = rows[0];
    if (!user || !user.reset_token || !user.reset_expires_at)
      return res.status(400).json({ message: "Invalid or expired token" });

    if (user.reset_token !== token)
      return res.status(400).json({ message: "Invalid token" });
    if (new Date(user.reset_expires_at) < new Date())
      return res.status(400).json({ message: "Token expired" });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires_at=NULL WHERE id=$2",
      [hash, user.id]
    );

    return res.json({ message: "Password updated" });
  } catch (err) {
    console.error("resetPassword error", err && err.stack ? err.stack : err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { register, verifyOtp, login, forgotPassword, resetPassword };
