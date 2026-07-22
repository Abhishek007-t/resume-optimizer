const Analysis = require("../models/Analysis");
const Resume = require("../models/Resume");

// Get analysis history for current user
const getAnalysisHistory = async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("resumeId", "originalName fileName");

    res.status(200).json({
      success: true,
      data: analyses,
    });
  } catch (error) {
    console.error("Get Analysis History Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis history",
    });
  }
};

// Get single analysis by ID
const getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate("resumeId", "originalName fileName");

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Get Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analysis",
    });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Count resumes
    const totalResumes = await Resume.countDocuments({ user: userId });

    // Count analyses
    const totalAnalyses = await Analysis.countDocuments({ user: userId });

    // Calculate average ATS score
    const avgResult = await Analysis.aggregate([
      { $match: { user: new (require("mongoose").Types.ObjectId)(userId) } },
      { $group: { _id: null, averageScore: { $avg: "$atsScore" } } },
    ]);

    const averageScore = avgResult.length > 0
      ? Math.round(avgResult[0].averageScore)
      : 0;

    // Get latest analysis
    const latestAnalysis = await Analysis.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .populate("resumeId", "originalName fileName");

    res.status(200).json({
      success: true,
      data: {
        totalResumes,
        totalAnalyses,
        averageScore,
        latestAnalysis,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
    });
  }
};

// Delete an analysis
const deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Analysis not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Analysis deleted successfully",
    });
  } catch (error) {
    console.error("Delete Analysis Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete analysis",
    });
  }
};

module.exports = {
  getAnalysisHistory,
  getAnalysisById,
  getDashboardStats,
  deleteAnalysis,
};
