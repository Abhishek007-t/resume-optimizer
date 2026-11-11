const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const uploadCertificationFile = require("../middleware/uploadCertification");

const {
  parseResume,
  saveResume,
  improveField,
  uploadCertification,
} = require("../controllers/resumeBuilderController");

router.post("/parse", auth, parseResume);
router.put("/:id", auth, saveResume);
router.post("/:id/improve", auth, improveField);
router.post("/:id/certifications/upload", auth, uploadCertificationFile.single("certificate"), uploadCertification);

module.exports = router;
