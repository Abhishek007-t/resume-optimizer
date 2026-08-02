const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const {
  signupValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require("../middleware/validators");

const {
  signup,
  login,
  getProfile,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { getLastEmailAttempt } = require("../services/emailService");

router.post("/signup", signupValidation, signup);

router.post("/login", loginValidation, login);

router.get("/profile", auth, getProfile);

router.post("/forgot-password", forgotPasswordValidation, forgotPassword);

router.post("/reset-password", resetPasswordValidation, resetPassword);

// TEMP DEBUG: remove alongside emailService.js's lastAttempt tracking once
// the production email-delivery issue is diagnosed.
router.get("/debug/last-email", (req, res) => res.json(getLastEmailAttempt() || { message: "no attempts yet" }));

module.exports = router;