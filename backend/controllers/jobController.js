const fs = require("fs");
const pdfParse = require("pdf-parse");
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

// Extracts text from an uploaded job description PDF — pure text extraction,
// no AI call, so it's free and instant. Nothing is persisted; the extracted
// text is just handed back to fill the job description field.
const extractJobDescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    fs.unlink(req.file.path, () => {});

    if (!pdfData.text || !pdfData.text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Couldn't read any text from that file — it may be a scanned image without selectable text.",
      });
    }

    res.status(200).json({
      success: true,
      jobDescription: pdfData.text.trim(),
    });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error("Job Description Extraction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to read that job description file",
      error: error.message,
    });
  }
};

module.exports = {
  matchJob,
  extractJobDescription,
};