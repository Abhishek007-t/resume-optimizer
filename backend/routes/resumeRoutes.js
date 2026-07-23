const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
  uploadResume,
  getMyResumes,
  getResumeById,
  deleteResume,
} = require("../controllers/resumeController");

router.get("/", auth, getMyResumes);
router.get("/:id", auth, getResumeById);
router.delete("/:id", auth, deleteResume);

router.post(
  "/upload",
  auth,
  upload.single("resume"),
  uploadResume
);

module.exports = router;