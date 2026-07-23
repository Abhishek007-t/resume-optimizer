const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    extractedText: {
    type: String,
    default: ""
},

    parsedProjects: {
      type: [
        {
          title: String,
          link: { type: String, default: "" },
          description: String,
          techStack: [String],
        },
      ],
      default: [],
    },

    // Structured, editable form of the resume used by the Resume Builder.
    // Projects live in `parsedProjects` above (shared with the Project
    // Interrogator) rather than being duplicated here.
    structuredResume: {
      contactInfo: {
        name: String,
        email: String,
        phone: String,
        location: String,
        linkedin: String,
        github: String,
      },
      summary: { type: String, default: "" },
      experience: {
        type: [
          {
            company: String,
            position: String,
            location: { type: String, default: "" },
            duration: String,
            bullets: [String],
          },
        ],
        default: [],
      },
      education: {
        type: [
          {
            school: String,
            degree: String,
            field: String,
            year: String,
          },
        ],
        default: [],
      },
      // Mixed rather than a strict subdocument array: skills used to be a
      // flat [String] before section-order/category support was added, and
      // this lets both old flat arrays and new [{category, items}] entries
      // load without Mongoose stripping older documents on read.
      skills: { type: mongoose.Schema.Types.Mixed, default: [] },
      certifications: { type: [String], default: [] },
      sectionOrder: {
        type: [String],
        default: ["summary", "experience", "projects", "education", "skills", "certifications"],
      },
      // Which LaTeX template buildLatexResume (frontend) renders with —
      // real, recognizable resume templates (Jake's Resume, Awesome-CV,
      // ModernCV Classic), all strictly single-column by design. No
      // sidebar/multi-column option is offered (e.g. Deedy Resume), since
      // that's the exact layout pattern the Parseability checker flags as
      // an ATS-parsing risk.
      template: {
        type: String,
        enum: ["jakes", "awesomecv", "moderncv"],
        default: "jakes",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Resume", resumeSchema);