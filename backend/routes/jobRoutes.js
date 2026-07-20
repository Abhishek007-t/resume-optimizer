const express = require("express");
const router = express.Router();

const { matchJob } = require("../controllers/jobController");
const authMiddleware = require("../middleware/auth");

// POST /api/job/match
router.post("/match", authMiddleware, matchJob);

module.exports = router;