// nodemailer Gmail STARTTLS transporter
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: false, // use STARTTLS
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD // use App Password (16 chars)
  },
  requireTLS: true,
  connectionTimeout: 20000, // 20s
  greetingTimeout: 20000
});

// optional: verbose verify & logs
transporter.verify()
  .then(() => console.log('Mailer: SMTP connection & auth successful'))
  .catch(err => {
    console.error('Mailer verify failed:', err);
  });
