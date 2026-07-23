import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getResumes } from "../services/resumeService";
import {
  extractProjects,
  startInterrogation,
  replyToInterrogation,
  finishInterrogation,
} from "../services/projectService";
import ScoreCircle from "../components/ScoreCircle";
import MicButton from "../components/MicButton";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { Search, Mic, ArrowLeft, ThumbsUp, Check, AlertTriangle, X, Circle } from "lucide-react";

function ProjectInterrogator() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [resumesLoading, setResumesLoading] = useState(true);

  const [projects, setProjects] = useState([]);
  const [extracting, setExtracting] = useState(false);

  const [interrogation, setInterrogation] = useState(null);
  const [starting, setStarting] = useState(null); // holds the project title being started
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const bottomRef = useRef(null);
  const baseMessageRef = useRef("");
  const { isSupported: micSupported, isListening, start: startMic, stop: stopMic } = useSpeechToText({
    onTranscriptChange: (sessionText) => setMessage((baseMessageRef.current ? baseMessageRef.current + " " : "") + sessionText),
    onError: (message) => toast.error(message),
  });

  const handleMicToggle = () => {
    if (isListening) {
      stopMic();
    } else {
      baseMessageRef.current = message.trim();
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
        if (saved && list.find((r) => r._id === saved)) {
          setSelectedResume(saved);
        } else if (list.length > 0) {
          setSelectedResume(list[0]._id);
        }
      } catch { /* ignore */ }
      finally { setResumesLoading(false); }
    };
    fetchResumes();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interrogation?.conversation?.length]);

  const handleFindProjects = async () => {
    if (!selectedResume) { toast.warning("Please select a resume"); return; }
    try {
      setExtracting(true);
      setProjects([]);
      setInterrogation(null);
      const data = await extractProjects(selectedResume);
      if (!data.projects || data.projects.length === 0) {
        toast.info("No distinct projects found in this resume's text.");
      }
      setProjects(data.projects || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't extract projects");
    } finally {
      setExtracting(false);
    }
  };

  const handleStart = async (projectTitle) => {
    try {
      setStarting(projectTitle);
      const data = await startInterrogation(selectedResume, projectTitle);
      setInterrogation(data.interrogation);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't start the interrogation");
    } finally {
      setStarting(null);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !interrogation) return;
    if (isListening) stopMic();
    const outgoing = message.trim();
    setMessage("");
    baseMessageRef.current = "";
    try {
      setSending(true);
      const data = await replyToInterrogation(interrogation._id, outgoing);
      setInterrogation(data.interrogation);
    } catch (error) {
      toast.error(error.response?.data?.message || "The panelist didn't respond");
      setMessage(outgoing);
    } finally {
      setSending(false);
    }
  };

  const handleFinish = async () => {
    if (!interrogation) return;
    try {
      setFinishing(true);
      const data = await finishInterrogation(interrogation._id);
      setInterrogation(data.interrogation);
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't generate the report");
    } finally {
      setFinishing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const visibleConversation = (interrogation?.conversation || []).filter((m) => !m.hidden);
  const isCompleted = interrogation?.status === "completed";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Project Interrogator</h1>
        <p className="text-text-secondary mt-2">
          An AI panelist cross-examines a project from your resume — the way a real interviewer would.
        </p>
      </div>

      {/* Step 1: pick a resume, find its projects */}
      {!interrogation && (
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block mb-2 text-sm font-medium text-text-secondary">Select Resume</label>
              {resumesLoading ? (
                <div className="skeleton h-12 w-full"></div>
              ) : resumes.length === 0 ? (
                <p className="text-text-secondary text-sm">
                  No resumes uploaded. <a href="/upload" className="text-primary hover:underline">Upload one first</a>
                </p>
              ) : (
                <select
                  value={selectedResume}
                  onChange={(e) => { setSelectedResume(e.target.value); setProjects([]); }}
                  className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {resumes.map((r) => (
                    <option key={r._id} value={r._id}>{r.originalName}</option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={handleFindProjects}
              disabled={extracting || !selectedResume}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {extracting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                  Reading resume...
                </span>
              ) : <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Find My Projects</span>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: pick a project to interrogate */}
      {!interrogation && projects.length > 0 && (
        <div className="space-y-4 animate-slide-up">
          {projects.map((p, i) => (
            <div key={i} className="glass-card p-6 border-l-4 border-primary">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{p.title}</h3>
                  <p className="text-text-secondary text-sm mt-1">{p.description}</p>
                  {p.techStack?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {p.techStack.map((t, ti) => (
                        <span key={ti} className="tag-found">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleStart(p.title)}
                  disabled={starting !== null}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {starting === p.title ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                      Starting...
                    </span>
                  ) : <span className="flex items-center gap-2"><Mic className="w-4 h-4" /> Interrogate This</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 3: chat thread */}
      {interrogation && (
        <div className="space-y-6 animate-slide-up">
          <div className="glass-card p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{interrogation.projectTitle}</h2>
              <p className="text-xs text-text-secondary">
                {isCompleted ? "Session completed" : "Session in progress"}
              </p>
            </div>
            <button
              onClick={() => { setInterrogation(null); setProjects([]); }}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> New session
            </button>
          </div>

          <div className="glass-card p-6">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {visibleConversation.map((turn, i) => (
                <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                      turn.role === "user"
                        ? "bg-primary/20 border border-primary/30 text-text-primary"
                        : "bg-bg-card border border-border text-text-primary"
                    }`}
                  >
                    {turn.role !== "user" && (
                      <p className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">Panelist</p>
                    )}
                    <p>{turn.text}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-bg-card border border-border rounded-xl px-4 py-3 text-sm text-text-secondary">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin-slow"></span>
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {!isCompleted && (
              <div className="mt-4 pt-4 border-t border-border">
                {isListening && <p className="text-xs text-danger mb-1.5 animate-pulse flex items-center gap-1.5"><Circle className="w-2 h-2 fill-current" /> Listening — speak your answer</p>}
                <div className="flex gap-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Answer the panelist's question, or use the mic..."
                    rows={2}
                    className="flex-1 rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                  <MicButton isListening={isListening} isSupported={micSupported} onClick={handleMicToggle} />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Send
                    </button>
                    <button
                      onClick={handleFinish}
                      disabled={sending || finishing || visibleConversation.length < 2}
                      className="px-5 py-2 rounded-xl bg-bg-card border border-border text-text-secondary hover:text-text-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                      {finishing ? "Grading..." : "End & Grade"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Report */}
          {isCompleted && (
            <div className="space-y-6 animate-slide-up">
              <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8">
                <ScoreCircle score={interrogation.depthScore || 0} label="Depth Score" />
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl font-bold text-text-primary mb-2">How You Held Up</h2>
                  <p className="text-text-secondary">{interrogation.summary}</p>
                </div>
              </div>

              {interrogation.strongMoments?.length > 0 && (
                <div className="glass-card p-6 border-l-4 border-success">
                  <h3 className="text-lg font-bold text-success mb-3 flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> Strong Moments</h3>
                  <ul className="space-y-2">
                    {interrogation.strongMoments.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-text-primary text-sm">
                        <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {interrogation.weakClaims?.length > 0 && (
                <div className="glass-card p-6 border-l-4 border-danger">
                  <h3 className="text-lg font-bold text-danger mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Claims Still Worth Fixing</h3>
                  <ul className="space-y-2">
                    {interrogation.weakClaims.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-text-primary text-sm">
                        <X className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectInterrogator;
