const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    category: { type: String, default: "" },
    targetSkill: { type: String, default: "" },

    answer: { type: String, default: "" },
    score: { type: Number },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    idealAnswerHint: { type: String, default: "" },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
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

    jobDescription: {
      type: String,
      default: "",
    },

    roundType: {
      type: String,
      enum: ["HR", "Technical", "Behavioral"],
      required: true,
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    overallScore: {
      type: Number,
    },

    weakestArea: {
      type: String,
    },

    summary: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

interviewSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
