const Resume = require("../models/Resume");
const ProjectInterrogation = require("../models/ProjectInterrogation");
const geminiService = require("../services/geminiService");

const extractProjects = async (req, res) => {
  try {
    const { resumeId } = req.body;

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

    if (resume.parsedProjects && resume.parsedProjects.length > 0) {
      return res.status(200).json({
        success: true,
        projects: resume.parsedProjects,
        cached: true,
      });
    }

    const projects = await geminiService.extractProjects(resume.extractedText);
    resume.parsedProjects = projects;
    await resume.save();

    res.status(200).json({
      success: true,
      projects,
      cached: false,
    });
  } catch (error) {
    console.error("Project Extraction Error:", error);
    res.status(500).json({
      success: false,
      message: "Project extraction failed",
      error: error.message,
    });
  }
};

const startInterrogation = async (req, res) => {
  try {
    const { resumeId, projectTitle } = req.body;

    if (!resumeId || !projectTitle) {
      return res.status(400).json({
        success: false,
        message: "Resume ID and project title are required",
      });
    }

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const project = (resume.parsedProjects || []).find(
      (p) => p.title === projectTitle
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found on this resume. Extract projects first.",
      });
    }

    const kickoffMessage = geminiService.buildKickoffMessage(project);
    const firstQuestion = await geminiService.startInterrogation(project);

    const interrogation = await ProjectInterrogation.create({
      user: req.user.id,
      resumeId: resume._id,
      projectTitle: project.title,
      projectSnapshot: project,
      conversation: [
        { role: "user", text: kickoffMessage, hidden: true },
        { role: "model", text: firstQuestion, hidden: false },
      ],
    });

    res.status(201).json({
      success: true,
      interrogation,
    });
  } catch (error) {
    console.error("Start Interrogation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start interrogation",
      error: error.message,
    });
  }
};

const reply = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Answer text is required",
      });
    }

    const interrogation = await ProjectInterrogation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!interrogation) {
      return res.status(404).json({
        success: false,
        message: "Interrogation session not found",
      });
    }

    if (interrogation.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "This session has already ended",
      });
    }

    const history = interrogation.conversation.map(({ role, text }) => ({ role, text }));
    const aiReply = await geminiService.continueInterrogation(history, message);

    interrogation.conversation.push({ role: "user", text: message });
    interrogation.conversation.push({ role: "model", text: aiReply });
    await interrogation.save();

    res.status(200).json({
      success: true,
      interrogation,
    });
  } catch (error) {
    console.error("Interrogation Reply Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to continue interrogation",
      error: error.message,
    });
  }
};

const finish = async (req, res) => {
  try {
    const interrogation = await ProjectInterrogation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!interrogation) {
      return res.status(404).json({
        success: false,
        message: "Interrogation session not found",
      });
    }

    const visibleConversation = interrogation.conversation
      .filter((m) => !m.hidden)
      .map(({ role, text }) => ({ role, text }));

    const report = await geminiService.summarizeInterrogation(
      interrogation.projectSnapshot,
      visibleConversation
    );

    interrogation.status = "completed";
    interrogation.depthScore = report.depthScore;
    interrogation.weakClaims = report.weakClaims;
    interrogation.strongMoments = report.strongMoments;
    interrogation.summary = report.summary;
    await interrogation.save();

    res.status(200).json({
      success: true,
      interrogation,
    });
  } catch (error) {
    console.error("Finish Interrogation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to summarize interrogation",
      error: error.message,
    });
  }
};

const getInterrogation = async (req, res) => {
  try {
    const interrogation = await ProjectInterrogation.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!interrogation) {
      return res.status(404).json({
        success: false,
        message: "Interrogation session not found",
      });
    }

    res.status(200).json({
      success: true,
      interrogation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch interrogation",
      error: error.message,
    });
  }
};

const listInterrogations = async (req, res) => {
  try {
    const interrogations = await ProjectInterrogation.find({ user: req.user.id })
      .select("resumeId projectTitle status depthScore weakClaims createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      interrogations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch interrogation history",
      error: error.message,
    });
  }
};

module.exports = {
  extractProjects,
  startInterrogation,
  reply,
  finish,
  getInterrogation,
  listInterrogations,
};
