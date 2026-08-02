const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const connectDB = require("./config/db");
const sanitizeBody = require("./middleware/sanitize");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");
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

// Render proxies all traffic through its load balancer — without trusting the
// proxy's X-Forwarded-For header, every user shares one IP and the rate
// limiter locks everyone out together. 1 hop = Render only.
app.set("trust proxy", 1);

// In production, only the configured frontend origin may call this API —
// wide-open cors() is fine for local dev but not for a deployed backend.
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: process.env.FRONTEND_URL, credentials: true }
  : { origin: true, credentials: true };

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(sanitizeBody);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authLimiter, authRoutes);
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