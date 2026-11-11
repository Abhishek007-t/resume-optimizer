import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getReadiness } from "../services/readinessService";
import ScoreCircle from "../components/ScoreCircle";
import Sparkline from "../components/Sparkline";

function MetricRow({ label, avg, count, points, color }) {
  return (
    <div className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">{label}</p>
        {avg !== null ? (
          <p className="text-2xl font-bold" style={{ color }}>
            {Math.round(avg)}
            <span className="text-sm text-text-secondary font-normal"> / 100 avg · {count} {count === 1 ? "entry" : "entries"}</span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">No data yet</p>
        )}
      </div>
      {points.length > 1 && <Sparkline points={points} color={color} />}
    </div>
  );
}

function ReadinessDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReadiness = async () => {
      try {
        const res = await getReadiness();
        setData(res);
      } catch (error) {
        toast.error(error.response?.data?.message || "Couldn't load your readiness data");
      } finally {
        setLoading(false);
      }
    };
    fetchReadiness();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (!data || data.compositeScore === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center animate-fade-in">
        <h1 className="text-3xl font-bold text-text-primary mb-3">Placement Readiness Index</h1>
        <p className="text-text-secondary">
          Run a resume analysis, a job match, or a mock interview first — your readiness score builds from that activity.
        </p>
      </div>
    );
  }

  const analysisPoints = data.trend.filter((t) => t.type === "analysis");
  const matchPoints = data.trend.filter((t) => t.type === "job-match");
  const interviewPoints = data.trend.filter((t) => t.type === "interview");
  const projectPoints = data.trend.filter((t) => t.type === "project-defense");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Placement Readiness Index</h1>
        <p className="text-text-secondary mt-2">One composite signal, built from everything you've done in the app so far.</p>
      </div>

      <div className="glass-card p-8 flex flex-col md:flex-row items-center gap-8 mb-6">
        <ScoreCircle score={data.compositeScore} label="Readiness" />
        <div className="flex-1 text-center md:text-left">
          {data.percentile !== null && (
            <p className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
              Top {Math.max(1, 100 - data.percentile)}% of active users
            </p>
          )}
          {data.narrative && <p className="text-text-secondary">{data.narrative}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <MetricRow label="Resume Quality Score" avg={data.breakdown.atsAvg} count={data.sampleSize.analyses} points={analysisPoints} color="#3E7C74" />
        <MetricRow label="Job Match Score" avg={data.breakdown.matchAvg} count={data.sampleSize.jobMatches} points={matchPoints} color="#B8935A" />
        <MetricRow label="Mock Interview Score" avg={data.breakdown.interviewAvg} count={data.sampleSize.interviews} points={interviewPoints} color="#5E7A9E" />
        <MetricRow label="Project Defense (Depth Score)" avg={data.breakdown.projectAvg} count={data.sampleSize.projectInterrogations} points={projectPoints} color="#A9677A" />
      </div>
    </div>
  );
}

export default ReadinessDashboard;
