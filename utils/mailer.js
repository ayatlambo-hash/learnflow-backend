const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

async function sendVerificationEmail(toEmail, code) {
  const t = getTransporter();
  await t.sendMail({
    from: `"LearnFlow" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your LearnFlow verification code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#2563eb;">LearnFlow</h2>
        <p>Use the code below to verify your email address:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e293b; background: #f1f5f9; padding: 16px 20px; border-radius: 10px; text-align: center; margin: 16px 0;">
          ${code}
        </div>
        <p style="color:#64748b; font-size: 13px;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };
