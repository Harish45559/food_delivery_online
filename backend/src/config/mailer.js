// src/mailer.js
require('dotenv').config(); // ensure .env is loaded

const nodemailer = require('nodemailer');

const host = process.env.MAIL_HOST || 'localhost';
const port = Number(process.env.MAIL_PORT || 587);
const user = process.env.MAIL_USERNAME || '';
const pass = process.env.MAIL_PASSWORD || '';

console.log('SMTP config (masked):', {
  host,
  port,
  user: user ? `${user.slice(0, 8)}...` : '(empty)',
  hasPassword: !!pass
});

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: user && pass ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000
});

transporter.verify()
  .then(() => console.log('Mailer ready — connection ok to', host + ':' + port))
  .catch((err) => {
    console.warn('Mailer verify failed:', err && err.message ? err.message : err);
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      console.warn('It looks like MAIL_HOST points to localhost. Do you expect a local SMTP server?');
    } else {
      console.warn('If this is a remote SMTP host, check firewall/DNS/outbound port blocking.');
    }
  });

module.exports = transporter;
