const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  extractProjects,
  startInterrogation,
  reply,
  finish,
  getInterrogation,
  listInterrogations,
} = require("../controllers/projectController");

router.post("/extract", auth, extractProjects);

router.get("/interrogate", auth, listInterrogations);
router.post("/interrogate/start", auth, startInterrogation);
router.get("/interrogate/:id", auth, getInterrogation);
router.post("/interrogate/:id/reply", auth, reply);
router.post("/interrogate/:id/finish", auth, finish);

module.exports = router;
