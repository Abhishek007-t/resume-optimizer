import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { matchJob, extractJobDescription } from "../services/aiService";
import { getResumes } from "../services/resumeService";
import { toast } from "react-toastify";
import { scoreColor } from "../constants/colors";
import { Paperclip, Target, Pencil, CheckCircle2, XCircle, BookOpen, ThumbsUp, Check, AlertTriangle, Rocket, ClipboardList } from "lucide-react";

function ScoreCircle({ score, label = "Match Score" }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

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
        <text x="50" y="62" textAnchor="middle" fill="#8B92A0" fontSize="8">{label}</text>
      </svg>
    </div>
  );
}

function RecommendationBadge({ recommendation }) {
  const r = (recommendation || "").toLowerCase();
  let color, bg;
  if (r.includes("highly") || r.includes("strong")) { color = "text-success"; bg = "bg-success/15 border-success/30"; }
  else if (r.includes("recommended") || r.includes("good")) { color = "text-primary"; bg = "bg-primary/15 border-primary/30"; }
  else if (r.includes("consider") || r.includes("potential")) { color = "text-warning"; bg = "bg-warning/15 border-warning/30"; }
  else { color = "text-danger"; bg = "bg-danger/15 border-danger/30"; }

  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold border ${color} ${bg}`}>
      {recommendation}
    </span>
  );
}

function JobMatch() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [extractingJd, setExtractingJd] = useState(false);
  const jdFileInputRef = useRef(null);

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

  const handleJdFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setExtractingJd(true);
      const data = await extractJobDescription(file);
      setJobDescription(data.jobDescription);
      toast.success("Job description extracted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't read that file");
    } finally {
      setExtractingJd(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedResume) { toast.warning("Please select a resume"); return; }
    if (!jobDescription.trim()) { toast.warning("Please enter a job description"); return; }

    try {
      setLoading(true);
      const data = await matchJob(selectedResume, jobDescription);
      const raw = data.result?.rawAnalysis || data.result;
      setResult(raw);
    } catch (error) {
      toast.error(error.response?.data?.message || "Job Match Failed");
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
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">AI Job Match</h1>
        <p className="text-text-secondary mt-2">Compare your resume against any job description</p>
      </div>

      {/* Controls */}
      <div className="glass-card p-6 mb-8">
        <div className="space-y-4">
          <div>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-secondary">Job Description</label>
              <button
                type="button"
                onClick={() => jdFileInputRef.current?.click()}
                disabled={extractingJd}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {extractingJd ? "Reading file..." : <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" /> Upload JD (PDF)</span>}
              </button>
              <input
                ref={jdFileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleJdFileChange}
                className="hidden"
              />
            </div>
            <textarea
              rows="8"
              placeholder="Paste the complete job description here, or upload a PDF..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="w-full rounded-xl bg-bg-card border border-border p-4 text-text-primary placeholder-text-secondary/50 resize-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={handleMatch}
            disabled={loading || !selectedResume || !jobDescription.trim()}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                Matching...
              </span>
            ) : <span className="flex items-center justify-center gap-2"><Target className="w-4 h-4" /> Match Resume</span>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-slide-up">
          {/* Score + Summary + Recommendation */}
          <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8">
            <ScoreCircle score={result.matchPercentage || 0} />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-text-primary mb-2">Match Analysis</h2>
              <p className="text-text-secondary mb-3">{result.matchReasoning}</p>
              {result.recommendation && <RecommendationBadge recommendation={result.recommendation} />}
              <div className="mt-4">
                <button
                  onClick={() => {
                    localStorage.setItem("resumeId", selectedResume);
                    navigate("/builder");
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow text-sm inline-flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> Tailor for This Job in the Builder →
                </button>
              </div>
            </div>
          </div>

          {/* Matched Skills */}
          {result.matchedSkills?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-success">
              <h3 className="text-lg font-bold text-success mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Matched Skills</h3>
              <div className="flex flex-wrap gap-2">
                {result.matchedSkills.map((s, i) => (
                  <div key={i} className="tag-found flex items-center gap-1">
                    <span>{s.skill || s}</span>
                    {s.importance && (
                      <span className="text-[10px] opacity-70">({s.importance})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {result.missingSkills?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-danger">
              <h3 className="text-lg font-bold text-danger mb-3 flex items-center gap-2"><XCircle className="w-4 h-4" /> Missing Skills</h3>
              <div className="space-y-2">
                {result.missingSkills.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="tag-missing">{s.skill || s}</span>
                      {s.importance && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityClass(s.importance)}`}>
                          {s.importance}
                        </span>
                      )}
                    </div>
                    {s.canBeLearned && (
                      <span className="text-xs text-success flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Can be learned</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {result.strengths?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-success">
              <h3 className="text-lg font-bold text-success mb-3 flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> Strengths</h3>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-text-primary text-sm">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span>{typeof s === 'string' ? s : s.toString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {result.weaknesses?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-warning">
              <h3 className="text-lg font-bold text-warning mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Gaps</h3>
              <div className="space-y-3">
                {result.weaknesses.map((w, i) => (
                  <div key={i} className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-primary font-medium text-sm">{w.gap || w}</span>
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

          {/* Improvements */}
          {result.improvements?.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-primary">
              <h3 className="text-lg font-bold text-primary mb-3 flex items-center gap-2"><Rocket className="w-4 h-4" /> Suggestions to Improve Match</h3>
              <ul className="space-y-2">
                {result.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2 text-text-primary text-sm">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{typeof imp === 'string' ? imp : imp.suggestion || imp.toString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Final Verdict */}
          {result.finalVerdict && (
            <div className="glass-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
              <h3 className="text-lg font-bold gradient-text mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Final Verdict</h3>
              <p className="text-text-primary">{result.finalVerdict}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default JobMatch;