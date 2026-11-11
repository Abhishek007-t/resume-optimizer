const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  getAnalysisHistory,
  getAnalysisById,
  getDashboardStats,
  deleteAnalysis,
} = require("../controllers/analysisController");

// GET /api/analysis/stats - Dashboard statistics
router.get("/stats", auth, getDashboardStats);

// GET /api/analysis/ - Analysis history
router.get("/", auth, getAnalysisHistory);

// GET /api/analysis/:id - Single analysis
router.get("/:id", auth, getAnalysisById);

// DELETE /api/analysis/:id - Delete analysis
router.delete("/:id", auth, deleteAnalysis);

module.exports = router;
