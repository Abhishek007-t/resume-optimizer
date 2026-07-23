const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const { getReadiness } = require("../controllers/readinessController");

router.get("/", auth, getReadiness);

module.exports = router;
