const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
  uploadResume,
} = require("../controllers/resumeController");

router.post(
  "/upload",
  auth,
  upload.single("resume"),
  uploadResume
);

module.exports = router;