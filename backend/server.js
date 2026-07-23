const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const aiRoutes = require("./routes/aiRoutes");
const jobRoutes = require("./routes/jobRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const projectRoutes = require("./routes/projectRoutes");
const resumeBuilderRoutes = require("./routes/resumeBuilderRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const readinessRoutes = require("./routes/readinessRoutes");

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/builder", resumeBuilderRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/readiness", readinessRoutes);

// Static files
app.use("/uploads", express.static("uploads"));

// Home Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Resume Optimizer Backend Running 🚀",
  });
});

// Port
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});