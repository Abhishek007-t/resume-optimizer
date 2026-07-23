const nodemailer = require("nodemailer");

// Gmail SMTP via an "app password" (requires 2FA enabled on the sending
// Gmail account) — free, no third-party signup. If not configured, password
// reset requests are logged instead of emailed so local dev doesn't hard-fail.
const isConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);

const getTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (!isConfigured()) {
    console.warn(`EMAIL_USER/EMAIL_APP_PASSWORD not set — password reset link for ${toEmail}: ${resetUrl}`);
    return;
  }

  await getTransporter().sendMail({
    from: `"Resume Optimizer" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your Resume Optimizer password",
    html: `
      <p>You (or someone else) requested a password reset for your Resume Optimizer account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });
};

module.exports = { sendPasswordResetEmail, isConfigured };
