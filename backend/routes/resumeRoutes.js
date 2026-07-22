const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
  uploadResume,
  getMyResumes,
  getResumeById,
} = require("../controllers/resumeController");

router.get("/", auth, getMyResumes);
router.get("/:id", auth, getResumeById);

router.post(
  "/upload",
  auth,
  upload.single("resume"),
  uploadResume
);

module.exports = router;