import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { getResumes } from "../services/resumeService";
import { getAnalysisHistory } from "../services/aiService";
import { listInterrogations } from "../services/projectService";
import {
  parseResumeIntoBuilder,
  saveBuilderResume,
  improveBuilderField,
  uploadCertification,
} from "../services/resumeBuilderService";
import OpenInOverleafButton from "../components/OpenInOverleafButton";
import { normalizeSkillGroups, TEMPLATE_NAMES } from "../utils/latexResume";
import { FileEdit, RefreshCw, Save, ClipboardList, Target, Sparkles, Paperclip, ArrowDown, ArrowLeft, X, Wand2 } from "lucide-react";

// Sections a recommendation can be routed to — keys double as the ref map
// keys used to scroll/highlight the matching card in the editor.
const SECTION_MATCHERS = [
  ["contact", /contact|linkedin|github|phone number|email address/],
  ["summary", /summary|objective/],
  ["experience", /experience|employment|work history/],
  ["projects", /project/],
  ["skills", /\bskills?\b/],
  ["certifications", /certificat/],
  ["education", /education/],
];

const resolveSection = (text) => {
  const t = (text || "").toLowerCase();
  const match = SECTION_MATCHERS.find(([, pattern]) => pattern.test(t));
  return match ? match[0] : null;
};

const SECTION_LABELS = {
  contact: "Contact Info", summary: "Summary", experience: "Experience", projects: "Projects",
  skills: "Skills", certifications: "Certifications", education: "Education",
};

const EMPTY_RESUME = {
  contactInfo: { name: "", email: "", phone: "", location: "", linkedin: "", github: "" },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
  sectionOrder: ["summary", "experience", "projects", "education", "skills", "certifications"],
  template: "jakes",
};

const getDeep = (obj, path) => path.split(".").reduce((cur, key) => (cur == null ? cur : cur[key]), obj);
const setDeep = (obj, path, value) => {
  const keys = path.split(".");
  const clone = JSON.parse(JSON.stringify(obj));
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
  return clone;
};

function ResumeBuilder() {
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [resumesLoading, setResumesLoading] = useState(true);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [resume, setResume] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [jobMatchRecommendations, setJobMatchRecommendations] = useState(null);
  const [weakProjectClaims, setWeakProjectClaims] = useState([]);
  const [templateRecommendation, setTemplateRecommendation] = useState(null);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState(null);
  const [reparsing, setReparsing] = useState(false);

  const contactRef = useRef(null);
  const summaryRef = useRef(null);
  const experienceRef = useRef(null);
  const projectsRef = useRef(null);
  const skillsRef = useRef(null);
  const certificationsRef = useRef(null);
  const educationRef = useRef(null);
  // Used only inside event handlers (never read during render), so a plain
  // object here is fine — the JSX below binds each ref variable directly.
  const sectionRefs = {
    contact: contactRef, summary: summaryRef, experience: experienceRef, projects: projectsRef,
    skills: skillsRef, certifications: certificationsRef, education: educationRef,
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

  const applyLoadedResume = (data) => {
    setResume({
      ...EMPTY_RESUME,
      ...data.structuredResume,
      contactInfo: { ...EMPTY_RESUME.contactInfo, ...data.structuredResume.contactInfo },
      // Older cached parses stored skills as a flat [String]; normalize to
      // [{category, items}] once here so the rest of the UI only ever deals
      // with one shape.
      skills: normalizeSkillGroups(data.structuredResume.skills),
      sectionOrder: data.structuredResume.sectionOrder?.length ? data.structuredResume.sectionOrder : EMPTY_RESUME.sectionOrder,
      projects: data.projects || [],
    });
    setTemplateRecommendation(data.templateRecommendation || null);
    setRecommendationDismissed(false);
  };

  const handleLoad = async () => {
    if (!selectedResume) { toast.warning("Please select a resume"); return; }
    try {
      setLoadingBuilder(true);
      const data = await parseResumeIntoBuilder(selectedResume);
      applyLoadedResume(data);

      try {
        const history = await getAnalysisHistory();
        const forThisResume = (history.data || []).filter(
          (a) => (a.resumeId?._id || a.resumeId) === selectedResume
        );
        setRecommendations(forThisResume.find((a) => a.type === "analysis") || null);
        setJobMatchRecommendations(forThisResume.find((a) => a.type === "job-match") || null);
      } catch { setRecommendations(null); setJobMatchRecommendations(null); }

      try {
        const interrogationsRes = await listInterrogations();
        const weak = (interrogationsRes.interrogations || []).filter(
          (i) => i.status === "completed" && (i.resumeId?._id || i.resumeId) === selectedResume && i.weakClaims?.length > 0
        );
        setWeakProjectClaims(weak);
      } catch { setWeakProjectClaims([]); }
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load resume into the builder");
    } finally {
      setLoadingBuilder(false);
    }
  };

  const handleReparse = async () => {
    const confirmed = window.confirm("Re-parse from the original PDF? This discards any unsaved edits and re-runs AI extraction (uses AI quota).");
    if (!confirmed) return;
    try {
      setReparsing(true);
      const data = await parseResumeIntoBuilder(selectedResume, true);
      applyLoadedResume(data);
      toast.success("Re-parsed from the original resume");
    } catch (error) {
      toast.error(error.response?.data?.message || "Re-parse failed");
    } finally {
      setReparsing(false);
    }
  };

  const updateField = (path, value) => setResume((prev) => setDeep(prev, path, value));

  const handleSave = async () => {
    try {
      setSaving(true);
      const { projects, ...structuredResume } = resume;
      await saveBuilderResume(selectedResume, structuredResume, projects);
      toast.success("Saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const requestImprovement = async (path, label, contextHint) => {
    const currentText = getDeep(resume, path);
    if (!currentText || !currentText.trim()) { toast.warning("Write something first"); return; }
    setSuggestion({ path, loading: true });
    try {
      const data = await improveBuilderField(selectedResume, label, currentText, contextHint);
      setSuggestion({ path, improved: data.suggestion.improved, whatChanged: data.suggestion.whatChanged, loading: false });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't generate a suggestion");
      setSuggestion(null);
    }
  };

  const acceptSuggestion = () => {
    updateField(suggestion.path, suggestion.improved);
    setSuggestion(null);
    toast.success("Applied");
  };

  const dismissSuggestion = () => setSuggestion(null);

  const jumpToSection = (section) => {
    sectionRefs[section]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSection(section);
    setTimeout(() => setHighlightedSection((cur) => (cur === section ? null : cur)), 2000);
  };

  const applyRecommendationToSummary = (hint) => {
    jumpToSection("summary");
    requestImprovement("summary", "professional summary", hint);
  };

  const handleCertificateUpload = async (file) => {
    try {
      setUploadingCert(true);
      const data = await uploadCertification(selectedResume, file);
      updateField("certifications", [...resume.certifications, data.certification.displayText]);
      toast.success("Certificate added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't read that certificate");
    } finally {
      setUploadingCert(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Resume Builder</h1>
        <p className="text-text-secondary mt-2">Edit structured fields, apply AI suggestions inline, then open the compiled result in Overleaf.</p>
      </div>

      {!resume && (
        <div className="glass-card p-6 max-w-2xl mx-auto">
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
                  onChange={(e) => setSelectedResume(e.target.value)}
                  className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {resumes.map((r) => <option key={r._id} value={r._id}>{r.originalName}</option>)}
                </select>
              )}
            </div>
            <button
              onClick={handleLoad}
              disabled={loadingBuilder || !selectedResume}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loadingBuilder ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                  Loading...
                </span>
              ) : <span className="flex items-center gap-2"><FileEdit className="w-4 h-4" /> Open in Builder</span>}
            </button>
          </div>
        </div>
      )}

      {resume && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => { setResume(null); setRecommendations(null); setJobMatchRecommendations(null); setWeakProjectClaims([]); setTemplateRecommendation(null); }} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg transition flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Choose different resume
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleReparse}
                disabled={reparsing}
                title="Re-run AI extraction from the original PDF — picks up section order, skill categories, project links, etc. for resumes parsed before those were tracked"
                className="px-4 py-2 rounded-xl bg-bg-card text-text-secondary hover:text-text-primary border border-border font-medium disabled:opacity-50 text-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> {reparsing ? "Re-parsing..." : "Re-parse"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold btn-glow disabled:opacity-50 text-sm flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
              </button>
              <OpenInOverleafButton resume={resume} />
            </div>
          </div>

          <div className="glass-card p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">Overleaf Template</span>
            <div className="flex gap-2">
              {Object.entries(TEMPLATE_NAMES).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => updateField("template", key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    (resume.template || "jakes") === key
                      ? "bg-primary text-white"
                      : "bg-bg-card text-text-secondary hover:text-text-primary border border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-secondary">All single-column — no sidebar option, for real ATS-parsing safety.</span>
          </div>

          {templateRecommendation && !recommendationDismissed && (resume.template || "jakes") !== templateRecommendation.template && (
            <div className="glass-card p-4 border-l-4 border-primary flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-primary flex items-start gap-2">
                <Wand2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>Recommended: <strong>{TEMPLATE_NAMES[templateRecommendation.template]}</strong> — {templateRecommendation.reason}</span>
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { updateField("template", templateRecommendation.template); setRecommendationDismissed(true); }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-primary/20 text-primary font-medium hover:bg-primary/30"
                >
                  Use this
                </button>
                <button
                  onClick={() => setRecommendationDismissed(true)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-bg-card text-text-secondary hover:text-text-primary"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {(recommendations || jobMatchRecommendations || weakProjectClaims.length > 0) && (
            <RecommendationsPanel
              analysis={recommendations}
              jobMatch={jobMatchRecommendations}
              weakProjectClaims={weakProjectClaims}
              onJumpTo={jumpToSection}
              onApplyToSummary={applyRecommendationToSummary}
            />
          )}

          <div ref={contactRef} className={`rounded-2xl transition ${highlightedSection === "contact" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <ContactCard resume={resume} updateField={updateField} />
          </div>

          <div ref={summaryRef} className={`rounded-2xl transition ${highlightedSection === "summary" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <FieldCard title="Summary">
              <ImprovableTextarea
                value={resume.summary}
                onChange={(v) => updateField("summary", v)}
                onImprove={() => requestImprovement("summary", "professional summary")}
                suggestion={suggestion?.path === "summary" ? suggestion : null}
                onAccept={acceptSuggestion}
                onDismiss={dismissSuggestion}
                rows={4}
              />
            </FieldCard>
          </div>

          <div ref={experienceRef} className={`rounded-2xl transition ${highlightedSection === "experience" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <ExperienceCard
              resume={resume} updateField={updateField} setResume={setResume}
              suggestion={suggestion} requestImprovement={requestImprovement}
              acceptSuggestion={acceptSuggestion} dismissSuggestion={dismissSuggestion}
            />
          </div>

          <div ref={projectsRef} className={`rounded-2xl transition ${highlightedSection === "projects" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <ProjectsCard
              resume={resume} updateField={updateField} setResume={setResume}
              suggestion={suggestion} requestImprovement={requestImprovement}
              acceptSuggestion={acceptSuggestion} dismissSuggestion={dismissSuggestion}
            />
          </div>

          <div ref={educationRef} className={`rounded-2xl transition ${highlightedSection === "education" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <EducationCard resume={resume} setResume={setResume} />
          </div>

          <div ref={skillsRef} className={`rounded-2xl transition ${highlightedSection === "skills" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <SkillsCard groups={resume.skills} setResume={setResume} />
          </div>

          <div ref={certificationsRef} className={`rounded-2xl transition ${highlightedSection === "certifications" ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-dark" : ""}`}>
            <TagListCard
              title="Certifications"
              items={resume.certifications}
              onChange={(v) => updateField("certifications", v)}
              placeholder="Add a certification and press Enter, or upload a certificate"
              onFileUpload={handleCertificateUpload}
              uploading={uploadingCert}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationsPanel({ analysis, jobMatch, weakProjectClaims = [], onJumpTo, onApplyToSummary }) {
  const severityClass = (severity) => {
    const s = (severity || "").toLowerCase();
    if (s === "high") return "severity-high";
    if (s === "medium") return "severity-medium";
    return "severity-low";
  };

  return (
    <details className="glass-card p-5 border-l-4 border-primary" open>
      <summary className="cursor-pointer text-sm font-bold text-primary uppercase tracking-wide">
        <span className="inline-flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Recommendations{analysis ? ` (Quality score: ${analysis.atsScore})` : ""}</span>
      </summary>
      <div className="mt-4 space-y-4">
        {analysis?.weaknesses?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-danger uppercase tracking-wide mb-2">Weaknesses</p>
            <div className="space-y-2">
              {analysis.weaknesses.map((w, i) => (
                <RecommendationItem
                  key={i}
                  badge={w.severity && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${severityClass(w.severity)}`}>{w.severity}</span>}
                  text={w.issue || w}
                  matchText={`${w.issue || ""} ${w.impact || ""}`}
                  onJumpTo={onJumpTo}
                  onApplyToSummary={onApplyToSummary}
                />
              ))}
            </div>
          </div>
        )}
        {analysis?.improvements?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Improvements</p>
            <div className="space-y-2">
              {analysis.improvements.map((imp, i) => (
                <RecommendationItem
                  key={i}
                  badge={imp.section && <span className="inline-block text-[10px] font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5 shrink-0 mt-0.5">{imp.section}</span>}
                  text={imp.suggestion || imp}
                  matchText={`${imp.section || ""} ${imp.suggestion || ""}`}
                  applyHint={imp.example || imp.suggestion}
                  onJumpTo={onJumpTo}
                  onApplyToSummary={onApplyToSummary}
                />
              ))}
            </div>
          </div>
        )}
        {jobMatch && (
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 shrink-0" /> Gaps for &quot;{(jobMatch.jobDescription || "").slice(0, 60)}{jobMatch.jobDescription?.length > 60 ? "…" : ""}&quot; (Match: {jobMatch.atsScore}%)
            </p>
            <div className="space-y-2">
              {(jobMatch.rawAnalysis?.missingSkills || []).map((s, i) => (
                <RecommendationItem
                  key={`skill-${i}`}
                  badge={s.importance && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${severityClass(s.importance)}`}>{s.importance}</span>}
                  text={`Missing: ${s.skill || s}`}
                  matchText="skills"
                  onJumpTo={onJumpTo}
                  onApplyToSummary={onApplyToSummary}
                />
              ))}
              {(jobMatch.weaknesses || []).map((w, i) => (
                <RecommendationItem
                  key={`weak-${i}`}
                  badge={w.severity && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${severityClass(w.severity)}`}>{w.severity}</span>}
                  text={w.gap || w}
                  matchText={`${w.gap || ""} ${w.impact || ""}`}
                  onJumpTo={onJumpTo}
                  onApplyToSummary={onApplyToSummary}
                />
              ))}
              {(jobMatch.improvements || []).map((imp, i) => (
                <RecommendationItem
                  key={`imp-${i}`}
                  text={typeof imp === "string" ? imp : imp.suggestion || imp}
                  matchText={typeof imp === "string" ? imp : imp.suggestion || ""}
                  onJumpTo={onJumpTo}
                  onApplyToSummary={onApplyToSummary}
                />
              ))}
            </div>
          </div>
        )}
        {weakProjectClaims.length > 0 && (
          <div>
            <p className="text-xs font-bold text-danger uppercase tracking-wide mb-2">Project Claims to Reconsider</p>
            <p className="text-xs text-text-secondary mb-2">These didn&apos;t hold up under Project Interrogator questioning — the bullet may be overstating what you can actually defend.</p>
            <div className="space-y-3">
              {weakProjectClaims.map((interrogation) => (
                <div key={interrogation._id}>
                  <p className="text-xs font-medium text-text-primary mb-1">{interrogation.projectTitle}</p>
                  <div className="space-y-2">
                    {interrogation.weakClaims.map((claim, i) => (
                      <RecommendationItem
                        key={i}
                        badge={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 severity-high">Unverified</span>}
                        text={claim}
                        matchText="projects"
                        onJumpTo={onJumpTo}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function RecommendationItem({ badge, text, matchText, applyHint, onJumpTo, onApplyToSummary }) {
  const section = resolveSection(matchText);

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex items-start gap-2">
        {badge}
        <span className="text-text-primary">{text}</span>
      </div>
      {section === "summary" && onApplyToSummary && (
        <button
          onClick={() => onApplyToSummary(applyHint || text)}
          className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-success/10 text-success font-medium hover:bg-success/20 transition flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" /> Apply to Summary
        </button>
      )}
      {section && section !== "summary" && onJumpTo && (
        <button
          onClick={() => onJumpTo(section)}
          className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition flex items-center gap-1"
        >
          <ArrowDown className="w-3 h-3" /> Jump to {SECTION_LABELS[section]}
        </button>
      )}
    </div>
  );
}

function FieldCard({ title, action, children }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ImprovableTextarea({ value, onChange, onImprove, suggestion, onAccept, onDismiss, rows = 3 }) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-xl bg-bg-card border border-border px-4 py-3 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
      />
      <button
        onClick={onImprove}
        disabled={suggestion?.loading}
        className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50 inline-flex items-center gap-1"
      >
        <Sparkles className="w-3 h-3" /> {suggestion?.loading ? "Thinking..." : "Improve with AI"}
      </button>

      {suggestion && !suggestion.loading && suggestion.improved && (
        <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/30">
          <p className="text-[11px] text-success font-medium mb-1">{suggestion.whatChanged}</p>
          <p className="text-sm text-text-primary mb-3">{suggestion.improved}</p>
          <div className="flex gap-2">
            <button onClick={onAccept} className="px-3 py-1.5 text-xs rounded-lg bg-success/20 text-success font-medium hover:bg-success/30">Accept</button>
            <button onClick={onDismiss} className="px-3 py-1.5 text-xs rounded-lg bg-bg-card text-text-secondary hover:text-text-primary">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactCard({ resume, updateField }) {
  const fields = [
    ["name", "Full Name"], ["email", "Email"], ["phone", "Phone"],
    ["location", "Location"], ["linkedin", "LinkedIn"], ["github", "GitHub"],
  ];
  return (
    <FieldCard title="Contact Info">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([key, label]) => (
          <input
            key={key}
            placeholder={label}
            value={resume.contactInfo[key] || ""}
            onChange={(e) => updateField(`contactInfo.${key}`, e.target.value)}
            className="rounded-lg bg-bg-card border border-border px-3 py-2 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        ))}
      </div>
    </FieldCard>
  );
}

function ExperienceCard({ resume, updateField, setResume, suggestion, requestImprovement, acceptSuggestion, dismissSuggestion }) {
  const addEntry = () => setResume((prev) => ({ ...prev, experience: [...prev.experience, { company: "", position: "", location: "", duration: "", bullets: [""] }] }));
  const removeEntry = (i) => setResume((prev) => ({ ...prev, experience: prev.experience.filter((_, idx) => idx !== i) }));
  const addBullet = (i) => setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.experience[i].bullets.push(""); return c; });
  const removeBullet = (i, bi) => setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.experience[i].bullets = c.experience[i].bullets.filter((_, idx) => idx !== bi); return c; });

  return (
    <FieldCard title="Experience" action={<button onClick={addEntry} className="text-xs text-primary hover:underline">+ Add role</button>}>
      <div className="space-y-5">
        {resume.experience.map((exp, i) => (
          <div key={i} className="p-3 rounded-lg bg-bg-card border border-border space-y-2">
            <div className="flex justify-end">
              <button onClick={() => removeEntry(i)} className="text-xs text-danger hover:underline">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Position" value={exp.position} onChange={(e) => updateField(`experience.${i}.position`, e.target.value)}
                className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
              <input placeholder="Company" value={exp.company} onChange={(e) => updateField(`experience.${i}.company`, e.target.value)}
                className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Duration (e.g. Jan 2025 - Present)" value={exp.duration} onChange={(e) => updateField(`experience.${i}.duration`, e.target.value)}
                className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
              <input placeholder="Location (optional)" value={exp.location || ""} onChange={(e) => updateField(`experience.${i}.location`, e.target.value)}
                className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
            </div>

            <div className="space-y-2 pt-1">
              {exp.bullets.map((b, bi) => {
                const path = `experience.${i}.bullets.${bi}`;
                return (
                  <div key={bi} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <ImprovableTextarea
                        value={b}
                        onChange={(v) => updateField(path, v)}
                        onImprove={() => requestImprovement(path, "experience bullet point", `Role: ${exp.position} at ${exp.company}`)}
                        suggestion={suggestion?.path === path ? suggestion : null}
                        onAccept={acceptSuggestion}
                        onDismiss={dismissSuggestion}
                        rows={2}
                      />
                    </div>
                    <button onClick={() => removeBullet(i, bi)} className="text-danger mt-2"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button onClick={() => addBullet(i)} className="text-xs text-primary hover:underline">+ Add bullet</button>
            </div>
          </div>
        ))}
        {resume.experience.length === 0 && <p className="text-text-secondary text-sm">No experience entries yet.</p>}
      </div>
    </FieldCard>
  );
}

function ProjectsCard({ resume, updateField, setResume, suggestion, requestImprovement, acceptSuggestion, dismissSuggestion }) {
  const addProject = () => setResume((prev) => ({ ...prev, projects: [...prev.projects, { title: "", link: "", description: "", techStack: [] }] }));
  const removeProject = (i) => setResume((prev) => ({ ...prev, projects: prev.projects.filter((_, idx) => idx !== i) }));

  return (
    <FieldCard title="Projects" action={<button onClick={addProject} className="text-xs text-primary hover:underline">+ Add project</button>}>
      <div className="space-y-5">
        {resume.projects.map((p, i) => {
          const descPath = `projects.${i}.description`;
          return (
            <div key={i} className="p-3 rounded-lg bg-bg-card border border-border space-y-2">
              <div className="flex justify-end">
                <button onClick={() => removeProject(i)} className="text-xs text-danger hover:underline">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Project title" value={p.title} onChange={(e) => updateField(`projects.${i}.title`, e.target.value)}
                  className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary font-medium" />
                <input placeholder="Link (GitHub/demo, optional)" value={p.link || ""} onChange={(e) => updateField(`projects.${i}.link`, e.target.value)}
                  className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
              </div>
              <ImprovableTextarea
                value={p.description}
                onChange={(v) => updateField(descPath, v)}
                onImprove={() => requestImprovement(descPath, "project description", `Project: ${p.title}`)}
                suggestion={suggestion?.path === descPath ? suggestion : null}
                onAccept={acceptSuggestion}
                onDismiss={dismissSuggestion}
                rows={3}
              />
              <input
                placeholder="Tech stack, comma separated"
                value={(p.techStack || []).join(", ")}
                onChange={(e) => updateField(`projects.${i}.techStack`, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary"
              />
            </div>
          );
        })}
        {resume.projects.length === 0 && <p className="text-text-secondary text-sm">No projects yet.</p>}
      </div>
    </FieldCard>
  );
}

function EducationCard({ resume, setResume }) {
  const update = (i, field, value) => setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.education[i][field] = value; return c; });
  const addEntry = () => setResume((prev) => ({ ...prev, education: [...prev.education, { school: "", degree: "", field: "", year: "" }] }));
  const removeEntry = (i) => setResume((prev) => ({ ...prev, education: prev.education.filter((_, idx) => idx !== i) }));

  return (
    <FieldCard title="Education" action={<button onClick={addEntry} className="text-xs text-primary hover:underline">+ Add</button>}>
      <div className="space-y-3">
        {resume.education.map((ed, i) => (
          <div key={i} className="p-3 rounded-lg bg-bg-card border border-border space-y-2">
            <div className="flex justify-end">
              <button onClick={() => removeEntry(i)} className="text-xs text-danger hover:underline">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Degree" value={ed.degree} onChange={(e) => update(i, "degree", e.target.value)} className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
              <input placeholder="Field of study" value={ed.field} onChange={(e) => update(i, "field", e.target.value)} className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="School" value={ed.school} onChange={(e) => update(i, "school", e.target.value)} className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
              <input placeholder="Year" value={ed.year} onChange={(e) => update(i, "year", e.target.value)} className="rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary" />
            </div>
          </div>
        ))}
        {resume.education.length === 0 && <p className="text-text-secondary text-sm">No education entries yet.</p>}
      </div>
    </FieldCard>
  );
}

function SkillsCard({ groups, setResume }) {
  const [drafts, setDrafts] = useState({});

  const addGroup = () => setResume((prev) => ({ ...prev, skills: [...prev.skills, { category: "", items: [] }] }));
  const removeGroup = (gi) => setResume((prev) => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== gi) }));
  const updateCategory = (gi, value) => setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.skills[gi].category = value; return c; });
  const removeSkill = (gi, ii) => setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.skills[gi].items = c.skills[gi].items.filter((_, idx) => idx !== ii); return c; });

  const addSkill = (gi) => {
    const draft = (drafts[gi] || "").trim();
    if (!draft) return;
    setResume((prev) => { const c = JSON.parse(JSON.stringify(prev)); c.skills[gi].items.push(draft); return c; });
    setDrafts((d) => ({ ...d, [gi]: "" }));
  };

  return (
    <FieldCard title="Skills" action={<button onClick={addGroup} className="text-xs text-primary hover:underline">+ Add group</button>}>
      <div className="space-y-4">
        {groups.map((g, gi) => (
          <div key={gi} className="p-3 rounded-lg bg-bg-card border border-border space-y-2">
            <div className="flex items-center gap-2">
              <input
                placeholder="Category (e.g. Languages) — optional"
                value={g.category}
                onChange={(e) => updateCategory(gi, e.target.value)}
                className="flex-1 rounded-lg bg-bg-dark border border-border px-3 py-2 text-sm text-text-primary font-medium"
              />
              <button onClick={() => removeGroup(gi)} className="text-xs text-danger hover:underline shrink-0">Remove group</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((skill, ii) => (
                <span key={ii} className="tag-found flex items-center gap-1.5">
                  {skill}
                  <button onClick={() => removeSkill(gi, ii)} className="text-[10px] opacity-70 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <input
              value={drafts[gi] || ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [gi]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(gi); } }}
              placeholder="Add a skill and press Enter"
              className="w-full rounded-lg bg-bg-card border border-border px-3 py-2 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ))}
        {groups.length === 0 && <p className="text-text-secondary text-sm">No skills yet.</p>}
      </div>
    </FieldCard>
  );
}

function TagListCard({ title, items, onChange, placeholder, onFileUpload, uploading }) {
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const addTag = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  const removeTag = (i) => onChange(items.filter((_, idx) => idx !== i));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) onFileUpload(file);
    e.target.value = "";
  };

  const handleDragOver = (e) => { if (onFileUpload) { e.preventDefault(); setDragOver(true); } };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    if (!onFileUpload) return;
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileUpload(file);
  };

  return (
    <FieldCard
      title={title}
      action={onFileUpload && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Paperclip className="w-3 h-3" /> {uploading ? "Reading certificate..." : "Upload certificate"}
        </button>
      )}
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg transition ${dragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
      >
        {onFileUpload && (
          <p className="text-[11px] text-text-secondary mb-2">Drop a certificate image/PDF here, or use the button above.</p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {items.map((t, i) => (
            <span key={i} className="tag-found flex items-center gap-1.5">
              {t}
              <button onClick={() => removeTag(i)} className="text-[10px] opacity-70 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="w-full rounded-lg bg-bg-card border border-border px-3 py-2 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {onFileUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </FieldCard>
  );
}

export default ResumeBuilder;
