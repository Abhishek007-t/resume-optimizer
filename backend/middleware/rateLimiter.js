const rateLimit = require("express-rate-limit");

// Baseline protection for the whole API — generous enough not to bother a
// real user, tight enough to blunt a basic scripted flood.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests — please slow down and try again shortly." },
});

// Tighter limit for auth endpoints specifically — these are the classic
// abuse targets: credential stuffing on /login, mass account creation on
// /signup, and email-bombing a victim's inbox via /forgot-password.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts — please wait a few minutes before trying again." },
});

module.exports = { apiLimiter, authLimiter };
