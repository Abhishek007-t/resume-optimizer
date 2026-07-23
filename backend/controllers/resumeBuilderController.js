const fs = require("fs");
const Resume = require("../models/Resume");
const geminiService = require("../services/geminiService");
const { recommendTemplate } = require("../utils/templateRecommender");

const EMPTY_STRUCTURE = {
  contactInfo: { name: "", email: "", phone: "", location: "", linkedin: "", github: "" },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  sectionOrder: ["summary", "experience", "projects", "education", "skills", "certifications"],
  template: "jakes",
};

// The set of valid template names has been renamed twice across this
// project's history (modern/classic/minimal -> classic/modern/compact ->
// jakes/awesomecv/moderncv). Mongoose validates the *entire* document on
// every save() regardless of which paths changed, so a resume saved under
// an older name would fail to save at all — even on an unrelated field —
// once the enum tightened. Normalize any unrecognized value back to a valid
// one before every save rather than trying to enumerate every legacy string.
const VALID_TEMPLATES = ["jakes", "awesomecv", "moderncv"];
const normalizeTemplate = (resume) => {
  if (resume.structuredResume && !VALID_TEMPLATES.includes(resume.structuredResume.template)) {
    resume.structuredResume.template = "jakes";
  }
};

const parseResume = async (req, res) => {
  try {
    const { resumeId, force } = req.body;

    if (!resumeId) {
      return res.status(400).json({
        success: false,
        message: "Resume ID is required",
      });
    }

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    normalizeTemplate(resume);

    const alreadyParsed = !force && resume.structuredResume && resume.structuredResume.summary;

    if (!alreadyParsed) {
      const structure = await geminiService.parseResumeStructure(resume.extractedText);
      resume.structuredResume = {
        ...structure,
        template: resume.structuredResume?.template || "jakes",
      };
    }

    if (force || !resume.parsedProjects || resume.parsedProjects.length === 0) {
      resume.parsedProjects = await geminiService.extractProjects(resume.extractedText);
    }

    await resume.save();

    res.status(200).json({
      success: true,
      structuredResume: resume.structuredResume,
      projects: resume.parsedProjects,
      templateRecommendation: recommendTemplate(resume.extractedText),
    });
  } catch (error) {
    console.error("Resume Parse Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to parse resume into structured fields",
      error: error.message,
    });
  }
};

const saveResume = async (req, res) => {
  try {
    const { structuredResume, projects } = req.body;

    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    if (structuredResume) {
      resume.structuredResume = {
        ...EMPTY_STRUCTURE,
        ...resume.structuredResume,
        ...structuredResume,
      };
    }

    if (projects) {
      resume.parsedProjects = projects;
    }

    normalizeTemplate(resume);

    await resume.save();

    res.status(200).json({
      success: true,
      structuredResume: resume.structuredResume,
      projects: resume.parsedProjects,
    });
  } catch (error) {
    console.error("Resume Save Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save resume",
      error: error.message,
    });
  }
};

const improveField = async (req, res) => {
  try {
    const { fieldLabel, currentText, contextHint } = req.body;

    if (!fieldLabel || !currentText || !currentText.trim()) {
      return res.status(400).json({
        success: false,
        message: "fieldLabel and currentText are required",
      });
    }

    // Ownership check even though nothing is persisted here — the resume's
    // content shouldn't be sent to the AI on behalf of another user.
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const suggestion = await geminiService.improveField(fieldLabel, currentText, contextHint);

    res.status(200).json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error("Improve Field Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate an improved version",
      error: error.message,
    });
  }
};

const uploadCertification = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });

    if (!resume) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString("base64");

    const certification = await geminiService.extractCertificationInfo(base64Data, req.file.mimetype);

    fs.unlink(req.file.path, () => {});

    res.status(200).json({
      success: true,
      certification,
    });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error("Certification Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to read that certificate",
      error: error.message,
    });
  }
};

module.exports = {
  parseResume,
  saveResume,
  improveField,
  uploadCertification,
};
