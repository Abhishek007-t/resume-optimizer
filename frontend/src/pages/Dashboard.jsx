import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardStats, getAnalysisHistory } from "../services/aiService";
import { getResumes } from "../services/resumeService";

function ScoreBadge({ score }) {
  const color = score >= 70 ? "text-success bg-success/15 border-success/30"
    : score >= 50 ? "text-warning bg-warning/15 border-warning/30"
    : "text-danger bg-danger/15 border-danger/30";
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${color}`}>
      {score}%
    </span>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes, resumesRes] = await Promise.allSettled([
          getDashboardStats(),
          getAnalysisHistory(),
          getResumes(),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (historyRes.status === "fulfilled") setAnalyses(historyRes.value.data || []);
        if (resumesRes.status === "fulfilled") setResumes(resumesRes.value.resumes || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28"></div>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {[1,2,3].map(i => <div key={i} className="skeleton h-36"></div>)}
        </div>
        <div className="skeleton h-64"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">
          Welcome back, <span className="gradient-text">{user?.name || "User"}</span>
        </h1>
        <p className="text-text-secondary mt-2">Here&apos;s your resume optimization overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="stat-card">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-text-secondary text-sm">Total Resumes</p>
          <p className="text-2xl font-bold text-text-primary">{stats?.totalResumes || 0}</p>
        </div>
        <div className="stat-card">
          <div className="text-3xl mb-2">🤖</div>
          <p className="text-text-secondary text-sm">Total Analyses</p>
          <p className="text-2xl font-bold text-text-primary">{stats?.totalAnalyses || 0}</p>
        </div>
        <div className="stat-card">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-text-secondary text-sm">Average Score</p>
          <p className={`text-2xl font-bold ${
            (stats?.averageScore || 0) >= 70 ? "text-success" : (stats?.averageScore || 0) >= 50 ? "text-warning" : "text-danger"
          }`}>{stats?.averageScore || 0}%</p>
        </div>
        <div className="stat-card">
          <div className="text-3xl mb-2">🎯</div>
          <p className="text-text-secondary text-sm">Latest Score</p>
          <p className={`text-2xl font-bold ${
            (stats?.latestAnalysis?.atsScore || 0) >= 70 ? "text-success" : (stats?.latestAnalysis?.atsScore || 0) >= 50 ? "text-warning" : "text-danger"
          }`}>{stats?.latestAnalysis?.atsScore || "—"}{stats?.latestAnalysis ? "%" : ""}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-xl font-bold text-text-primary mb-4">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Link to="/upload" className="glass-card p-6 hover:bg-bg-card-hover transition-all group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📄</div>
          <h3 className="text-lg font-bold text-text-primary">Upload Resume</h3>
          <p className="text-text-secondary text-sm mt-1">Upload a PDF resume for AI analysis</p>
        </Link>
        <Link to="/analyze" className="glass-card p-6 hover:bg-bg-card-hover transition-all group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🤖</div>
          <h3 className="text-lg font-bold text-text-primary">Analyze Resume</h3>
          <p className="text-text-secondary text-sm mt-1">Get ATS score and improvement tips</p>
        </Link>
        <Link to="/job-match" className="glass-card p-6 hover:bg-bg-card-hover transition-all group">
          <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎯</div>
          <h3 className="text-lg font-bold text-text-primary">Job Match</h3>
          <p className="text-text-secondary text-sm mt-1">Compare resume vs job description</p>
        </Link>
      </div>

      {/* Recent Analyses */}
      <h2 className="text-xl font-bold text-text-primary mb-4">Recent Analyses</h2>
      {analyses.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-text-secondary">No analyses yet. Upload a resume and run your first analysis!</p>
          <Link to="/upload" className="inline-block mt-4 px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition">
            Get Started
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.slice(0, 10).map((analysis, idx) => (
            <div key={analysis._id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex items-center gap-3">
                <div className="text-2xl">{analysis.type === "job-match" ? "🎯" : "🤖"}</div>
                <div>
                  <p className="text-text-primary font-medium text-sm">
                    {analysis.resumeId?.originalName || "Resume"}
                  </p>
                  <p className="text-text-secondary text-xs">
                    {new Date(analysis.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  analysis.type === "job-match"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-secondary/15 text-secondary border border-secondary/30"
                }`}>
                  {analysis.type === "job-match" ? "Job Match" : "Analysis"}
                </span>
                <ScoreBadge score={analysis.atsScore} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;