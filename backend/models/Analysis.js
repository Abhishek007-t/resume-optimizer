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
  },
  {
    timestamps: true,
  }
);

analysisSchema.index({ user: 1, createdAt: -1 });
analysisSchema.index({ resumeId: 1 });

module.exports = mongoose.model("Analysis", analysisSchema);