const Resume = require("../models/Resume");
const Analysis = require("../models/Analysis");
const ProjectInterrogation = require("../models/ProjectInterrogation");
const InterviewSession = require("../models/InterviewSession");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const uploadResume = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const dataBuffer = fs.readFileSync(req.file.path);

    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text;

  
    const resume = await Resume.create({
      user: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      extractedText: extractedText,
    });

    res.status(201).json({
      success: true,
      message: "Resume uploaded successfully",
      preview: extractedText.substring(0, 200),
      resume,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });

  }
};


const getMyResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({
      user: req.user.id,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: resumes.length,
      resumes,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    res.status(200).json({
      success: true,
      resume,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // Clean up everything tied to this resume so nothing stale (a dangling
    // analysis, interview session, or interrogation) survives the delete.
    await Promise.all([
      Analysis.deleteMany({ resumeId: resume._id, user: req.user.id }),
      ProjectInterrogation.deleteMany({ resumeId: resume._id, user: req.user.id }),
      InterviewSession.deleteMany({ resumeId: resume._id, user: req.user.id }),
      Resume.deleteOne({ _id: resume._id }),
    ]);

    fs.unlink(resume.filePath, () => {});

    res.status(200).json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  uploadResume,
  getMyResumes,
  getResumeById,
  deleteResume,
};