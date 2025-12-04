// backend/src/config/mailer.js
require("dotenv").config();
const nodemailer = require("nodemailer");

/**
 * Load required SMTP environment variables
 */
const {
  MAIL_MAILER,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USERNAME,
  MAIL_PASSWORD,
  MAIL_FROM_ADDRESS,
  MAIL_FROM_NAME,
  MAIL_ENCRYPTION
} = process.env;

/**
 * If any required value is missing → disable mailer
 */
if (
  !MAIL_HOST ||
  !MAIL_PORT ||
  !MAIL_USERNAME ||
  !MAIL_PASSWORD ||
  !MAIL_FROM_ADDRESS
) {
  console.log("❌ Mailer disabled — Missing SMTP environment variables.");
  module.exports = null;
  return;
}

/**
 * Create nodemailer transporter for MailerSend
 */
const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: MAIL_ENCRYPTION === "ssl", // TLS = secure:false
  auth: {
    user: MAIL_USERNAME,
    pass: MAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Verify connection on startup
 */
transporter.verify((err, success) => {
  if (err) {
    console.log("❌ Mailer verify failed:", err.message || err);
  } else {
    console.log("✅ SMTP Mailer ready to send email");
  }
});

/**
 * Force-safe sendMail:
 * Always injects the `from` field (required by MailerSend)
 */
async function sendMailSafe(options = {}) {
  if (!options.from) {
    options.from = {
      name: MAIL_FROM_NAME || "No Reply",
      address: MAIL_FROM_ADDRESS
    };
  }

  try {
    const info = await transporter.sendMail(options);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err.message || err);
    throw err;
  }
}

module.exports = {
  transporter,
  sendMail: sendMailSafe
};
