import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getResumes } from "../services/resumeService";
import { startInterview, submitAnswer, finishInterview } from "../services/interviewService";
import { getAnalysisHistory, extractJobDescription } from "../services/aiService";
import { listInterrogations } from "../services/projectService";
import ScoreCircle from "../components/ScoreCircle";
import MicButton from "../components/MicButton";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { Paperclip, RotateCcw, Mic, ArrowLeft, Check, AlertTriangle, ArrowRight, Flag } from "lucide-react";

const WEAK_PROJECT_THRESHOLD = 60;

const ROUND_TYPES = ["Technical", "HR", "Behavioral"];

function MockInterview() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [resumesLoading, setResumesLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState("");
  const [jdReused, setJdReused] = useState(false);
  const [roundType, setRoundType] = useState("Technical");
  const [starting, setStarting] = useState(false);
  const [weakProjects, setWeakProjects] = useState([]);
  const [focusProjectTitle, setFocusProjectTitle] = useState("");
  const [extractingJd, setExtractingJd] = useState(false);
  const [jdDragOver, setJdDragOver] = useState(false);
  const jdFileInputRef = useRef(null);

  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const baseAnswerRef = useRef("");
  const { isSupported: micSupported, isListening, start: startMic, stop: stopMic } = useSpeechToText({
    onTranscriptChange: (sessionText) => setAnswerDraft((baseAnswerRef.current ? baseAnswerRef.current + " " : "") + sessionText),
    onError: (message) => toast.error(message),
  });

  const handleMicToggle = () => {
    if (isListening) {
      stopMic();
    } else {
      baseAnswerRef.current = answerDraft.trim();
      startMic();
    }
  };

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const data = await getResumes();
        const list = data.resumes || [];
        setResumes(list);
        const saved = localStorage.getItem("resumeId");
        if (saved && list.find((r) => r._id === saved)) setSelectedResume(saved);
        else if (list.length > 0) setSelectedResume(list[0]._id);
      } catch { /* ignore */ }
      finally { setResumesLoading(false); }
    };
    fetchResumes();
  }, []);

  // Reload per-resume context whenever the selected resume changes: reuse
  // the JD from the most recent Job Match run (instead of asking for it a
  // second time), and surface any projects that scored weak under Project
  // Interrogator questioning so they can be specifically targeted.
  useEffect(() => {
    if (!selectedResume) return;

    (async () => {
      try {
        const history = await getAnalysisHistory();
        const latestMatch = (history.data || [])
          .filter((a) => a.type === "job-match" && (a.resumeId?._id || a.resumeId) === selectedResume)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (latestMatch?.jobDescription) {
          setJobDescription(latestMatch.jobDescription);
          setJdReused(true);
        }
      } catch { /* no prior job match — fine, leave JD blank */ }

      try {
        const data = await listInterrogations();
        const weak = (data.interrogations || [])
          .filter((i) => i.status === "completed" && (i.resumeId?._id || i.resumeId) === selectedResume && i.depthScore < WEAK_PROJECT_THRESHOLD)
          .sort((a, b) => a.depthScore - b.depthScore);
        setWeakProjects(weak);
      } catch { setWeakProjects([]); }
    })();
  }, [selectedResume]);

  const handleJdFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast.warning("Please drop a PDF file"); return; }

    try {
      setExtractingJd(true);
      const data = await extractJobDescription(file);
      setJobDescription(data.jobDescription);
      setJdReused(false);
      toast.success("Job description extracted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't read that file");
    } finally {
      setExtractingJd(false);
    }
  };

  const handleJdFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleJdFile(file);
  };

  const handleJdDragOver = (e) => { e.preventDefault(); setJdDragOver(true); };
  const handleJdDragLeave = () => setJdDragOver(false);
  const handleJdDrop = (e) => {
    e.preventDefault();
    setJdDragOver(false);
    handleJdFile(e.dataTransfer.files?.[0]);
  };

  const handleStart = async () => {
    if (!selectedResume) { toast.warning("Please select a resume"); return; }
    try {
      setStarting(true);
      const data = await startInterview(selectedResume, jobDescription, roundType, focusProjectTitle || undefined);
      setSession(data.session);
      setCurrentIndex(0);
      setAnswerDraft("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't start the interview");
    } finally {
      setStarting(false);
    }
  };

  const currentQuestion = session?.questions?.[currentIndex];
  const isAnswered = currentQuestion?.score !== undefined && currentQuestion?.score !== null;
  const isLastQuestion = session && currentIndex === session.questions.length - 1;

  const handleSubmitAnswer = async () => {
    if (!answerDraft.trim()) { toast.warning("Write an answer first"); return; }
    if (isListening) stopMic();
    try {
      setSubmitting(true);
      const data = await submitAnswer(session._id, currentIndex, answerDraft);
      setSession(data.session);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't score that answer");
    } finally {
      setSubmitting(false);
    }
  };

  const goToNext = () => {
    if (isListening) stopMic();
    baseAnswerRef.current = "";
    setCurrentIndex((i) => i + 1);
    setAnswerDraft("");
  };

  const handleFinish = async () => {
    try {
      setFinishing(true);
      const data = await finishInterview(session._id);
      setSession(data.session);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't generate the report");
    } finally {
      setFinishing(false);
    }
  };

  const scoreColor = (score) => (score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-danger");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Mock Interview Simulator</h1>
        <p className="text-text-secondary mt-2">Questions generated from your resume, job description, and known weak spots from your prior activity — scored against a real rubric.</p>
      </div>

      {!session && (
        <div className="glass-card p-6 space-y-5">
          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">Select Resume</label>
            {resumesLoading ? (
              <div className="skeleton h-12 w-full"></div>
            ) : resumes.length === 0 ? (
              <p className="text-text-secondary text-sm">No resumes uploaded. <a href="/upload" className="text-primary hover:underline">Upload one first</a></p>
            ) : (
              <select
                value={selectedResume}
                onChange={(e) => { setSelectedResume(e.target.value); setJdReused(false); setFocusProjectTitle(""); }}
                className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {resumes.map((r) => <option key={r._id} value={r._id}>{r.originalName}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-text-secondary">Round Type</label>
            <div className="flex gap-2">
              {ROUND_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setRoundType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    roundType === t ? "bg-primary text-white" : "bg-bg-card text-text-secondary hover:text-text-primary border border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-secondary">Job Description (optional — tailors the questions)</label>
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
            {jdReused && (
              <p className="text-xs text-primary mb-2 flex items-center gap-1.5"><RotateCcw className="w-3 h-3 shrink-0" /> Reused from your last Job Match run on this resume — edit or clear it if that's stale.</p>
            )}
            <div
              onDragOver={handleJdDragOver}
              onDragLeave={handleJdDragLeave}
              onDrop={handleJdDrop}
              className={`rounded-xl transition ${jdDragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
            >
              <textarea
                value={jobDescription}
                onChange={(e) => { setJobDescription(e.target.value); setJdReused(false); }}
                rows={4}
                placeholder="Paste a job description, drop a PDF, or upload one..."
                className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          {weakProjects.length > 0 && (
            <div>
              <label className="block mb-2 text-sm font-medium text-text-secondary">
                Focus on a project you struggled to defend (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {weakProjects.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => setFocusProjectTitle((cur) => (cur === p.projectTitle ? "" : p.projectTitle))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                      focusProjectTitle === p.projectTitle
                        ? "bg-danger/20 text-danger border-danger/40"
                        : "bg-bg-card text-text-secondary hover:text-text-primary border-border"
                    }`}
                  >
                    {p.projectTitle} <span className="text-[10px] opacity-70">(depth: {p.depthScore})</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-1.5">Project Interrogator flagged these as weakly defended — questions will dig into the same claims again.</p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={starting || !selectedResume}
            className="w-full px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                Generating questions...
              </span>
            ) : <span className="flex items-center justify-center gap-2"><Mic className="w-4 h-4" /> Start Interview</span>}
          </button>
        </div>
      )}

      {session && session.status === "active" && currentQuestion && (
        <div className="space-y-6 animate-slide-up">
          <div className="glass-card p-4 flex items-center justify-between">
            <span className="text-sm text-text-secondary">Question {currentIndex + 1} of {session.questions.length}</span>
            <button onClick={() => setSession(null)} className="text-sm text-text-secondary hover:text-text-primary transition flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> New session</button>
          </div>

          <div className="glass-card p-6">
            <div className="flex gap-2 mb-3">
              <span className="tag-found">{currentQuestion.category}</span>
              <span className="text-[10px] text-text-secondary self-center">targets: {currentQuestion.targetSkill}</span>
            </div>
            <p className="text-lg text-text-primary font-medium mb-4">{currentQuestion.question}</p>

            <div className="flex gap-2 items-start">
              <textarea
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
                rows={5}
                disabled={isAnswered}
                placeholder="Type your answer, or use the mic to speak it..."
                className="flex-1 rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-70"
              />
              {!isAnswered && (
                <MicButton isListening={isListening} isSupported={micSupported} onClick={handleMicToggle} className="mt-1" />
              )}
            </div>
            {isListening && <p className="text-xs text-danger mt-1.5 animate-pulse">● Listening — speak your answer</p>}

            {!isAnswered && (
              <button
                onClick={handleSubmitAnswer}
                disabled={submitting}
                className="mt-3 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 text-sm"
              >
                {submitting ? "Scoring..." : "Submit Answer"}
              </button>
            )}

            {isAnswered && (
              <div className="mt-5 space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${scoreColor(currentQuestion.score)}`}>{currentQuestion.score}</span>
                  <span className="text-text-secondary text-sm">/ 100</span>
                </div>

                {currentQuestion.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-success uppercase tracking-wide mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {currentQuestion.strengths.map((s, i) => <li key={i} className="text-sm text-text-primary flex items-start gap-1.5"><Check className="w-4 h-4 text-success mt-0.5 shrink-0" /> {s}</li>)}
                    </ul>
                  </div>
                )}

                {currentQuestion.gaps?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-warning uppercase tracking-wide mb-1">Gaps</p>
                    <ul className="space-y-1">
                      {currentQuestion.gaps.map((g, i) => <li key={i} className="text-sm text-text-primary flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" /> {g}</li>)}
                    </ul>
                  </div>
                )}

                {currentQuestion.idealAnswerHint && (
                  <p className="text-xs text-text-secondary italic border-l-2 border-primary/30 pl-3">{currentQuestion.idealAnswerHint}</p>
                )}

                <div className="flex gap-3 pt-2">
                  {!isLastQuestion && (
                    <button onClick={goToNext} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow text-sm flex items-center gap-1.5">
                      Next Question <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleFinish}
                    disabled={finishing}
                    className="px-6 py-2.5 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary font-medium disabled:opacity-50 text-sm flex items-center gap-1.5"
                  >
                    {isLastQuestion && !finishing && <Flag className="w-4 h-4" />}
                    {finishing ? "Grading session..." : isLastQuestion ? "Finish & Get Report" : "End Early & Get Report"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {session && session.status === "completed" && (
        <div className="space-y-6 animate-slide-up">
          <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8">
            <ScoreCircle score={session.overallScore || 0} label="Overall Score" />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-text-primary mb-2">Session Report</h2>
              <p className="text-text-secondary mb-2">{session.summary}</p>
              {session.weakestArea && (
                <p className="text-sm text-warning">Weakest area: <span className="font-medium">{session.weakestArea}</span></p>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Question Breakdown</h3>
            <div className="space-y-4">
              {session.questions.filter((q) => q.answer).map((q, i) => (
                <div key={i} className="p-4 rounded-lg bg-bg-card border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{q.question}</span>
                    <span className={`text-sm font-bold ${scoreColor(q.score)}`}>{q.score}/100</span>
                  </div>
                  <span className="tag-found text-[10px]">{q.category}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setSession(null)}
            className="w-full px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow"
          >
            Start Another Session
          </button>
        </div>
      )}
    </div>
  );
}

export default MockInterview;
