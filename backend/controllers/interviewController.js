const Resume = require("../models/Resume");
const InterviewSession = require("../models/InterviewSession");
const Analysis = require("../models/Analysis");
const ProjectInterrogation = require("../models/ProjectInterrogation");
const geminiService = require("../services/geminiService");

const ROUND_TYPES = ["HR", "Technical", "Behavioral"];

// Pulls together what the platform already knows this candidate is weak at
// — from Analyze, Job Match, and Project Interrogator — so Mock Interview
// questions actually drill known gaps instead of generating in a vacuum
// every time. Degrades gracefully to an empty hint for first-time users.
const buildWeakAreasHint = async (userId, resumeId, focusProjectTitle) => {
  const [latestAnalysis, latestJobMatch, interrogations] = await Promise.all([
    Analysis.findOne({ user: userId, resumeId, type: "analysis" }).sort({ createdAt: -1 }).lean(),
    Analysis.findOne({ user: userId, resumeId, type: "job-match" }).sort({ createdAt: -1 }).lean(),
    ProjectInterrogation.find({ user: userId, resumeId, status: "completed" }).select("projectTitle weakClaims").lean(),
  ]);

  const lines = [];

  if (latestAnalysis?.weaknesses?.length) {
    lines.push(`Resume weaknesses: ${latestAnalysis.weaknesses.map((w) => w.issue || w).join("; ")}`);
  }
  if (latestAnalysis?.rawAnalysis?.missingKeywords?.length) {
    lines.push(`Missing keywords: ${latestAnalysis.rawAnalysis.missingKeywords.join(", ")}`);
  }
  if (latestJobMatch?.rawAnalysis?.missingSkills?.length) {
    lines.push(`Missing skills for the target role: ${latestJobMatch.rawAnalysis.missingSkills.map((s) => s.skill || s).join(", ")}`);
  }

  const relevantInterrogations = focusProjectTitle
    ? interrogations.filter((i) => i.projectTitle === focusProjectTitle)
    : interrogations;

  relevantInterrogations.forEach((i) => {
    if (i.weakClaims?.length) {
      lines.push(`Unverified/vague claims on project "${i.projectTitle}" (dig into these specifically): ${i.weakClaims.join("; ")}`);
    }
  });

  return lines.join("\n");
};

const startInterview = async (req, res) => {
  try {
    const { resumeId, jobDescription, roundType, focusProjectTitle } = req.body;

    if (!resumeId || !roundType) {
      return res.status(400).json({
        success: false,
        message: "Resume ID and round type are required",
      });
    }

    if (!ROUND_TYPES.includes(roundType)) {
      return res.status(400).json({
        success: false,
        message: `Round type must be one of: ${ROUND_TYPES.join(", ")}`,
      });
    }

    const resume = await Resume.findOne({ _id: resumeId, user: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const weakAreasHint = await buildWeakAreasHint(req.user.id, resume._id, focusProjectTitle);

    const generated = await geminiService.generateInterviewQuestions(
      resume.extractedText,
      jobDescription || "",
      roundType,
      weakAreasHint
    );

    const session = await InterviewSession.create({
      user: req.user.id,
      resumeId: resume._id,
      jobDescription: jobDescription || "",
      roundType,
      questions: generated.map((q) => ({
        question: q.question,
        category: q.category,
        targetSkill: q.targetSkill,
      })),
    });

    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Start Interview Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start the interview",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { questionIndex, answer } = req.body;

    if (questionIndex === undefined || !answer || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message: "questionIndex and answer are required",
      });
    }

    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Interview session not found",
      });
    }

    if (session.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "This session has already ended",
      });
    }

    const question = session.questions[questionIndex];

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "Invalid question index",
      });
    }

    const resume = await Resume.findOne({ _id: session.resumeId, user: req.user.id });
    const result = await geminiService.scoreAnswer(question.question, answer, resume?.extractedText || "");

    question.answer = answer;
    question.score = result.score;
    question.strengths = result.strengths;
    question.gaps = result.gaps;
    question.idealAnswerHint = result.idealAnswerHint;

    // Real interviewers don't just march through a fixed script — they
    // follow up on what you just said. The scoring call itself decides
    // whether this specific answer warrants one (folded into the same
    // request, not a second AI call), and if so it's inserted as the next
    // question. Capped so a run of consecutive "worth probing" answers
    // can't turn a 6-question round into an unbounded one.
    const MAX_QUESTIONS = 10;
    if (result.followUpQuestion && result.followUpQuestion.trim() && session.questions.length < MAX_QUESTIONS) {
      session.questions.splice(Number(questionIndex) + 1, 0, {
        question: result.followUpQuestion.trim(),
        category: "Follow-up",
        targetSkill: question.targetSkill,
      });
    }

    await session.save();

    res.status(200).json({
      success: true,
      question,
      session,
    });
  } catch (error) {
    console.error("Submit Answer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to score the answer",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

const finishInterview = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Interview session not found",
      });
    }

    const answered = session.questions.filter((q) => q.answer && q.answer.trim());

    if (answered.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Answer at least one question before ending the session",
      });
    }

    const report = await geminiService.summarizeInterviewSession(answered);

    session.status = "completed";
    session.overallScore = report.overallScore;
    session.weakestArea = report.weakestArea;
    session.summary = report.summary;
    await session.save();

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Finish Interview Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to summarize the interview",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

const getSession = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Interview session not found",
      });
    }

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch session",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

const listSessions = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ user: req.user.id })
      .select("roundType status overallScore createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch interview history",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

module.exports = {
  startInterview,
  submitAnswer,
  finishInterview,
  getSession,
  listSessions,
};
