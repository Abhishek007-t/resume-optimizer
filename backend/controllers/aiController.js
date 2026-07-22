const Resume = require("../models/Resume");
const Analysis = require("../models/Analysis");
const geminiService = require("../services/geminiService");

const analyzeResume = async (req, res) => {
  try {
    const { resumeId } = req.body;

    if (!resumeId) {
      return res.status(400).json({
        success: false,
        message: "Resume ID is required",
      });
    }

    // Authorization check - only allow user to analyze their own resumes
    const resume = await Resume.findOne({
      _id: resumeId,
      user: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // Call Gemini AI via service
    const result = await geminiService.analyzeResume(resume.extractedText);

    // Save analysis to database
    const savedAnalysis = await Analysis.create({
      user: req.user.id,
      resumeId: resume._id,
      type: "analysis",
      atsScore: result.atsScore || 0,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      improvements: result.improvements || [],
      rawAnalysis: result,
    });

    res.status(200).json({
      success: true,
      analysis: savedAnalysis,
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);

    res.status(500).json({
      success: false,
      message: "AI Analysis Failed",
      error: error.message,
    });
  }
};

module.exports = {
  analyzeResume,
};