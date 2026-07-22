import { useState, useEffect } from "react";
import { analyzeResume } from "../services/aiService";
import { getResumes } from "../services/resumeService";
import { toast } from "react-toastify";

function ScoreCircle({ score, label = "ATS Score" }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#00D4AA" : score >= 50 ? "#FFB347" : "#FF6B6B";

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 100 100">
        <circle className="score-circle-bg" cx="50" cy="50" r={radius} />
        <circle
          className="score-circle-fill"
          cx="50" cy="50" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ animation: "scoreFill 1.5s ease-out" }}
        />
        <text x="50" y="46" textAnchor="middle" fill={color} fontSize="22" fontWeight="800">{score}</text>
        <text x="50" y="62" textAnchor="middle" fill="#a0a0b0" fontSize="8">{label}</text>
      </svg>
    </div>
  );
}

function AnalyzeResume() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resumesLoading, setResumesLoading] = useState(true);

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const data = await getResumes();
        const list = data.resumes || [];
        setResumes(list);
        const saved = localStorage.getItem("resumeId");
        if (saved && list.find(r => r._id === saved)) {
          setSelectedResume(saved);
        } else if (list.length > 0) {
          setSelectedResume(list[0]._id);
        }
      } catch { /* ignore */ }
      finally { setResumesLoading(false); }
    };
    fetchResumes();
  }, []);

  const handleAnalyze = async () => {
    if (!selectedResume) { toast.warning("Please select a resume"); return; }
    try {
      setLoading(true);
      const data = await analyzeResume(selectedResume);
      // The analysis could be in data.analysis.rawAnalysis or data.analysis itself
      const raw = data.analysis?.rawAnalysis || data.analysis;
      setAnalysis(raw);
    } catch (error) {
      toast.error(error.response?.data?.message || "Analysis Failed");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity) => {
    const s = (severity || "").toLowerCase();
    if (s === "high") return "severity-high";
    if (s === "medium") return "severity-medium";
    return "severity-low";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">AI Resume Analysis</h1>
        <p className="text-text-secondary mt-2">Get your ATS score and actionable improvement suggestions</p>
      </div>

      {/* Controls */}
      <div className="glass-card p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block mb-2 text-sm font-medium text-text-secondary">Select Resume</label>
            {resumesLoading ? (
              <div className="skeleton h-12 w-full"></div>
            ) : resumes.length === 0 ? (
              <p className="text-text-secondary text-sm">No resumes uploaded. <a href="/upload" className="text-primary hover:underline">Upload one first</a></p>
            ) : (
              <select
                value={selectedResume}
                onChange={(e) => setSelectedResume(e.target.value)}
                className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {resumes.map(r => (
                  <option key={r._id} value={r._id}>{r.originalName}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedResume}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                Analyzing...
              </span>
            ) : "🤖 Analyze Resume"}
          </button>
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-6 animate-slide-up">
          {/* Score + Summary */}
          <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8">
            <ScoreCircle score={analysis.atsScore || 0} />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-text-primary mb-2">ATS Score Analysis</h2>
              <p className="text-text-secondary">{analysis.atsReasoning}</p>
            </div>
          </div>

          {/* Strengths */}
          {analysis.strengths?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-success">
              <h3 className="text-lg font-bold text-success mb-3">💪 Strengths</h3>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-text-primary text-sm">
                    <span className="text-success mt-0.5">✓</span>
                    <span>{typeof s === 'string' ? s : s.toString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {analysis.weaknesses?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-danger">
              <h3 className="text-lg font-bold text-danger mb-3">⚠️ Weaknesses</h3>
              <div className="space-y-3">
                {analysis.weaknesses.map((w, i) => (
                  <div key={i} className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-primary font-medium text-sm">{w.issue || w}</span>
                      {w.severity && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityClass(w.severity)}`}>
                          {w.severity}
                        </span>
                      )}
                    </div>
                    {w.impact && <p className="text-text-secondary text-xs">{w.impact}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Keywords */}
          {analysis.missingKeywords?.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-text-primary mb-3">🔑 Missing Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.missingKeywords.map((kw, i) => (
                  <span key={i} className="tag-missing">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {analysis.improvements?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-primary">
              <h3 className="text-lg font-bold text-primary mb-3">🚀 Improvements</h3>
              <div className="space-y-4">
                {analysis.improvements.map((imp, i) => (
                  <div key={i} className="bg-bg-card rounded-lg p-4">
                    {imp.section && (
                      <span className="inline-block text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1 mb-2">
                        {imp.section}
                      </span>
                    )}
                    <p className="text-text-primary text-sm">{imp.suggestion || imp}</p>
                    {imp.example && (
                      <p className="text-text-secondary text-xs mt-2 italic border-l-2 border-primary/30 pl-3">
                        Example: {imp.example}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formatting */}
          {analysis.formatting && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-text-primary mb-3">📝 Formatting</h3>
              <div className={`flex items-center gap-2 mb-2 ${analysis.formatting.issueFound ? "text-warning" : "text-success"}`}>
                <span>{analysis.formatting.issueFound ? "⚠️ Issues Found" : "✅ No Issues"}</span>
              </div>
              <p className="text-text-secondary text-sm">{analysis.formatting.feedback}</p>
            </div>
          )}

          {/* Overall Feedback */}
          {analysis.overallFeedback && (
            <div className="glass-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
              <h3 className="text-lg font-bold gradient-text mb-3">📋 Overall Feedback</h3>
              <p className="text-text-primary">{analysis.overallFeedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalyzeResume;