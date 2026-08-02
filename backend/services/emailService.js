const nodemailer = require("nodemailer");
const dns = require("dns");

// smtp.gmail.com resolves to both an A and AAAA record. Render's network has
// no IPv6 egress route, but Node's default DNS ordering can still hand back
// the AAAA address first, so the connection dies instantly with ENETUNREACH.
// Forcing IPv4 first avoids that regardless of what the host's routing supports.
dns.setDefaultResultOrder("ipv4first");

// Gmail SMTP via an "app password" (requires 2FA enabled on the sending
// Gmail account) — free, no third-party signup. If not configured, password
// reset requests are logged instead of emailed so local dev doesn't hard-fail.
const isConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);

// Gmail's SMTP silently stalls instead of erroring when it throttles an app
// password (e.g. sends from multiple source IPs in a short window) — without
// these, a stalled connection hangs the caller indefinitely.
const getTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// TEMP DEBUG: tracks the outcome of the most recent send attempt so it can
// be inspected via a debug route when the host's own logs aren't reachable.
// Remove alongside the /debug/last-email route once diagnosed.
let lastAttempt = null;
const getLastEmailAttempt = () => lastAttempt;

const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (!isConfigured()) {
    console.warn(`EMAIL_USER/EMAIL_APP_PASSWORD not set — password reset link for ${toEmail}: ${resetUrl}`);
    lastAttempt = { at: new Date().toISOString(), configured: false };
    return;
  }

  try {
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
    lastAttempt = { at: new Date().toISOString(), success: true, to: toEmail };
  } catch (error) {
    lastAttempt = {
      at: new Date().toISOString(),
      success: false,
      to: toEmail,
      code: error.code,
      message: error.message,
    };
    throw error;
  }
};

module.exports = { sendPasswordResetEmail, isConfigured, getLastEmailAttempt };
