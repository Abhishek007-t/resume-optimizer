const Resume = require("../models/Resume");
const Analysis = require("../models/Analysis");
const geminiService = require("../services/geminiService");

const matchJob = async (req, res) => {
  try {
    const { resumeId, jobDescription } = req.body;

    if (!resumeId || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Resume ID and Job Description are required",
      });
    }

    // Authorization check
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
    const result = await geminiService.matchJob(
      resume.extractedText,
      jobDescription
    );

    // Save job match to database
    const savedAnalysis = await Analysis.create({
      user: req.user.id,
      resumeId: resume._id,
      type: "job-match",
      atsScore: result.matchPercentage || 0,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      improvements: result.improvements || [],
      jobDescription: jobDescription,
      rawAnalysis: result,
    });

    res.status(200).json({
      success: true,
      result: savedAnalysis,
    });
  } catch (error) {
    console.error("Job Match Error:", error);

    res.status(500).json({
      success: false,
      message: "Job Matching Failed",
      error: error.message,
    });
  }
};

module.exports = {
  matchJob,
};