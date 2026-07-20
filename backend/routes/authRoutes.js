const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  signup,
  login,
  getProfile,
} = require("../controllers/authController");

router.post("/signup", signup);

router.post("/login", login);

router.get("/profile", auth, getProfile);

module.exports = router;