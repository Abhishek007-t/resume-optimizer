import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { uploadResume, getResumes } from "../services/resumeService";
import { toast } from "react-toastify";

function UploadResume() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const data = await getResumes();
        setResumes(data.resumes || []);
      } catch { /* ignore */ }
      finally { setResumesLoading(false); }
    };
    fetchResumes();
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      setSuccess(false);
    } else {
      toast.warning("Please drop a PDF file");
    }
  };

  const handleFileSelect = (e) => {
    setFile(e.target.files[0]);
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.warning("Please select a PDF file"); return; }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setLoading(true);
      const data = await uploadResume(formData);
      localStorage.setItem("resumeId", data.resume._id);
      toast.success(data.message);
      setSuccess(true);
      // Refresh resumes list
      const updated = await getResumes();
      setResumes(updated.resumes || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Upload Failed");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Upload Resume</h1>
        <p className="text-text-secondary mt-2">Upload your resume in PDF format for AI analysis</p>
      </div>

      <div className="glass-card p-8 mb-8">
        {success ? (
          <div className="text-center py-8 animate-slide-up">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-success mb-2">Upload Successful!</h2>
            <p className="text-text-secondary mb-6">Your resume is ready for analysis</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/analyze" className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold btn-glow transition">
                Analyze Now →
              </Link>
              <button
                onClick={() => { setFile(null); setSuccess(false); }}
                className="px-6 py-3 bg-bg-card hover:bg-bg-card-hover text-text-primary rounded-xl font-semibold border border-border transition"
              >
                Upload Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div
              className={`drop-zone p-12 text-center cursor-pointer ${dragOver ? "drag-over" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-5xl mb-4">📄</div>
              <p className="text-text-primary font-medium mb-2">
                {file ? file.name : "Drag & drop your resume here"}
              </p>
              <p className="text-text-secondary text-sm">
                {file ? formatSize(file.size) : "or click to browse • PDF only • Max 5MB"}
              </p>
              {file && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/30">
                  <span className="text-primary text-sm font-medium">📎 {file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-danger hover:text-danger/80 text-sm"
                  >✕</button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full mt-6 rounded-xl bg-gradient-to-r from-primary to-primary-hover py-3 text-white font-semibold btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></span>
                  Uploading...
                </span>
              ) : "Upload Resume"}
            </button>
          </form>
        )}
      </div>

      {/* Previously uploaded resumes */}
      <h2 className="text-xl font-bold text-text-primary mb-4">Your Resumes</h2>
      {resumesLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="skeleton h-16"></div>)}
        </div>
      ) : resumes.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-secondary">No resumes uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumes.map((resume, idx) => (
            <div key={resume._id} className="glass-card p-4 flex items-center justify-between animate-slide-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-text-primary font-medium text-sm">{resume.originalName}</p>
                  <p className="text-text-secondary text-xs">
                    {new Date(resume.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { localStorage.setItem("resumeId", resume._id); toast.success("Resume selected!"); }}
                className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-lg transition"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadResume;