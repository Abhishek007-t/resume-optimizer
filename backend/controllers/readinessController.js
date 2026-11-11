const Analysis = require("../models/Analysis");
const InterviewSession = require("../models/InterviewSession");
const ProjectInterrogation = require("../models/ProjectInterrogation");
const geminiService = require("../services/geminiService");

const average = (items, key) =>
  items.length ? items.reduce((sum, item) => sum + (item[key] || 0), 0) / items.length : null;

// Cross-collection "join" done in application code rather than $lookup —
// at this write volume a plain aggregate-per-collection + in-memory merge
// is simpler to read and just as fast as a Mongo-side join would be.
const buildPlatformComposites = async () => {
  const [analysisAvgs, matchAvgs, interviewAvgs, projectAvgs] = await Promise.all([
    Analysis.aggregate([
      { $match: { type: "analysis" } },
      { $group: { _id: "$user", avg: { $avg: "$atsScore" } } },
    ]),
    Analysis.aggregate([
      { $match: { type: "job-match" } },
      { $group: { _id: "$user", avg: { $avg: "$atsScore" } } },
    ]),
    InterviewSession.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$user", avg: { $avg: "$overallScore" } } },
    ]),
    ProjectInterrogation.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$user", avg: { $avg: "$depthScore" } } },
    ]),
  ]);

  const componentsByUser = new Map();
  const addComponents = (rows) => {
    rows.forEach(({ _id, avg }) => {
      const key = _id.toString();
      if (!componentsByUser.has(key)) componentsByUser.set(key, []);
      componentsByUser.get(key).push(avg);
    });
  };
  addComponents(analysisAvgs);
  addComponents(matchAvgs);
  addComponents(interviewAvgs);
  addComponents(projectAvgs);

  return [...componentsByUser.entries()].map(([userId, components]) => ({
    userId,
    composite: components.reduce((a, b) => a + b, 0) / components.length,
  }));
};

const getReadiness = async (req, res) => {
  try {
    const userId = req.user.id;

    const [analyses, matches, interviews, projectInterrogations] = await Promise.all([
      Analysis.find({ user: userId, type: "analysis" }).select("atsScore createdAt").sort({ createdAt: 1 }).lean(),
      Analysis.find({ user: userId, type: "job-match" }).select("atsScore createdAt").sort({ createdAt: 1 }).lean(),
      InterviewSession.find({ user: userId, status: "completed" }).select("overallScore createdAt").sort({ createdAt: 1 }).lean(),
      ProjectInterrogation.find({ user: userId, status: "completed" }).select("depthScore createdAt").sort({ createdAt: 1 }).lean(),
    ]);

    const atsAvg = average(analyses, "atsScore");
    const matchAvg = average(matches, "atsScore");
    const interviewAvg = average(interviews, "overallScore");
    const projectAvg = average(projectInterrogations, "depthScore");

    const components = [atsAvg, matchAvg, interviewAvg, projectAvg].filter((v) => v !== null);
    const compositeScore = components.length
      ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
      : null;

    let percentile = null;
    if (compositeScore !== null) {
      const platformComposites = await buildPlatformComposites();
      if (platformComposites.length > 0) {
        const below = platformComposites.filter((c) => c.composite <= compositeScore).length;
        percentile = Math.round((below / platformComposites.length) * 100);
      }
    }

    const trend = [
      ...analyses.map((a) => ({ date: a.createdAt, type: "analysis", score: a.atsScore })),
      ...matches.map((m) => ({ date: m.createdAt, type: "job-match", score: m.atsScore })),
      ...interviews.map((i) => ({ date: i.createdAt, type: "interview", score: i.overallScore })),
      ...projectInterrogations.map((p) => ({ date: p.createdAt, type: "project-defense", score: p.depthScore })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let narrative = null;
    if (compositeScore !== null) {
      narrative = await geminiService.generateReadinessNarrative({
        atsAvg, matchAvg, interviewAvg, projectAvg, compositeScore, percentile,
        sampleSize: { analyses: analyses.length, jobMatches: matches.length, interviews: interviews.length, projectInterrogations: projectInterrogations.length },
      });
    }

    res.status(200).json({
      success: true,
      compositeScore,
      percentile,
      breakdown: { atsAvg, matchAvg, interviewAvg, projectAvg },
      sampleSize: { analyses: analyses.length, jobMatches: matches.length, interviews: interviews.length, projectInterrogations: projectInterrogations.length },
      trend,
      narrative,
    });
  } catch (error) {
    console.error("Readiness Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compute readiness score",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

module.exports = { getReadiness };
