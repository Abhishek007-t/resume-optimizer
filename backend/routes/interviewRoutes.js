const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  startInterview,
  submitAnswer,
  finishInterview,
  getSession,
  listSessions,
} = require("../controllers/interviewController");

router.get("/", auth, listSessions);
router.post("/start", auth, startInterview);
router.get("/:id", auth, getSession);
router.post("/:id/answer", auth, submitAnswer);
router.post("/:id/finish", auth, finishInterview);

module.exports = router;
