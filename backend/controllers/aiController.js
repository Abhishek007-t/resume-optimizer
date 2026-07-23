const crypto = require("crypto");
const Resume = require("../models/Resume");
const Analysis = require("../models/Analysis");
const geminiService = require("../services/geminiService");
const { checkParseability } = require("../utils/parseabilityChecker");

// Bump this whenever the scoring rubric/prompt changes meaningfully — it's
// baked into contentHash, so a resume analyzed under an older version of
// the logic is correctly treated as stale and re-scored, rather than the
// cache serving a result computed under outdated criteria.
const SCORING_VERSION = "v2-deterministic-sections";

const analyzeResume = async (req, res) => {
  try {
    const { resumeId, force } = req.body;

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

    const contentHash = crypto
      .createHash("sha256")
      .update(`${resume.extractedText}|${SCORING_VERSION}`)
      .digest("hex");

    // The whole point: an LLM API is not guaranteed to return the same
    // score for the same input twice, even at temperature 0 — that's an
    // inherent property of hosted inference, not a prompt bug. So instead
    // of re-asking (and getting a different answer), unchanged text just
    // returns what was already computed for it. Only a real edit to the
    // resume, or an explicit `force`, triggers a fresh AI call.
    if (!force) {
      const cached = await Analysis.findOne({
        user: req.user.id,
        resumeId: resume._id,
        type: "analysis",
        contentHash,
      }).sort({ createdAt: -1 });

      if (cached) {
        return res.status(200).json({
          success: true,
          analysis: cached,
          cached: true,
        });
      }
    }

    // Call Gemini AI via service
    const result = await geminiService.analyzeResume(resume.extractedText);

    // Deterministic, non-AI check for whether a real rule-based ATS parser
    // could actually read this file — independent of the AI's content judgment.
    const parseability = checkParseability(resume.extractedText);
    result.parseability = parseability;

    // Save analysis to database
    const savedAnalysis = await Analysis.create({
      user: req.user.id,
      resumeId: resume._id,
      type: "analysis",
      atsScore: result.atsScore || 0,
      scoreBreakdown: result.scoreBreakdown,
      parseability,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      improvements: result.improvements || [],
      rawAnalysis: result,
      contentHash,
    });

    res.status(200).json({
      success: true,
      analysis: savedAnalysis,
      cached: false,
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);

    res.status(500).json({
      success: false,
      message: "AI Analysis Failed",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

module.exports = {
  analyzeResume,
};