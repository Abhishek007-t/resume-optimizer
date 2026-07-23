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

router.post("/signup", signupValidation, signup);

router.post("/login", loginValidation, login);

router.get("/profile", auth, getProfile);

router.post("/forgot-password", forgotPasswordValidation, forgotPassword);

router.post("/reset-password", resetPasswordValidation, resetPassword);

module.exports = router;