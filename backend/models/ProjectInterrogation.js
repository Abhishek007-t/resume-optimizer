const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "model"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    // The synthetic kickoff turn that seeds the AI's first question isn't
    // something the candidate said — hide it from the rendered transcript.
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const projectInterrogationSchema = new mongoose.Schema(
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

    projectTitle: {
      type: String,
      required: true,
    },

    // Snapshot of the project at interrogation time, so later resume edits
    // don't retroactively change what was actually cross-examined.
    projectSnapshot: {
      title: String,
      description: String,
      techStack: [String],
    },

    conversation: {
      type: [messageSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    depthScore: {
      type: Number,
    },

    weakClaims: {
      type: [String],
      default: [],
    },

    strongMoments: {
      type: [String],
      default: [],
    },

    summary: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

projectInterrogationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("ProjectInterrogation", projectInterrogationSchema);
