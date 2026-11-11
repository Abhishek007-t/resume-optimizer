const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
    },

    type: {
      type: String,
      enum: ["analysis", "job-match"],
      default: "analysis",
    },

    atsScore: {
      type: Number,
      required: true,
    },

    scoreBreakdown: {
      type: Object,
    },

    parseability: {
      type: Object,
    },

    strengths: {
      type: [String],
      default: [],
    },

    weaknesses: {
      type: Array,
      default: [],
    },

    improvements: {
      type: Array,
      default: [],
    },

    jobDescription: {
      type: String,
    },

    rawAnalysis: {
      type: Object,
      required: true,
    },

    // sha256(extractedText + scoring algorithm version). Lets a re-analysis
    // of literally unchanged text return the exact same result instead of
    // re-rolling a probabilistic call — LLM APIs don't guarantee identical
    // output for identical input even at temperature 0, so re-asking is
    // exactly why the score fluctuates. Includes the algorithm version so
    // a future rubric/prompt change correctly invalidates old cached scores
    // instead of serving a result computed under outdated logic.
    contentHash: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ resumeId: 1 });
analysisSchema.index({ resumeId: 1, type: 1, contentHash: 1 });

module.exports = mongoose.model("Analysis", analysisSchema);