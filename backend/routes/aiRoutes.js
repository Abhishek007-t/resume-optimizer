const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const { analyzeResume } = require("../controllers/aiController");

router.post("/analyze", auth, analyzeResume);

module.exports = router;