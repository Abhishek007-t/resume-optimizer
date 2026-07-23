const express = require("express");
const router = express.Router();

const { matchJob, extractJobDescription } = require("../controllers/jobController");
const authMiddleware = require("../middleware/auth");
const upload = require("../middleware/upload");

// POST /api/job/match
router.post("/match", authMiddleware, matchJob);

// POST /api/job/extract — upload a JD PDF, get back extracted text
router.post("/extract", authMiddleware, upload.single("jobDescriptionFile"), extractJobDescription);

module.exports = router;