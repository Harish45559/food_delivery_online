// backend/src/config/mailer.js
require("dotenv").config();
const nodemailer = require("nodemailer");

const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USERNAME,
  MAIL_PASSWORD,
  MAIL_FROM_ADDRESS,
  MAIL_FROM_NAME,
  MAIL_ENCRYPTION
} = process.env;

if (!MAIL_HOST || !MAIL_PORT || !MAIL_USERNAME || !MAIL_PASSWORD || !MAIL_FROM_ADDRESS) {
  console.log("❌ Mailer disabled — missing SMTP environment variables.");
  module.exports = null;
  return;
}

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: MAIL_ENCRYPTION === "ssl",
  auth: {
    user: MAIL_USERNAME,
    pass: MAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((err) => {
  if (err) console.log("❌ Mailer verify failed:", err.message || err);
  else console.log("✅ SMTP Mailer ready");
});

module.exports = transporter;
