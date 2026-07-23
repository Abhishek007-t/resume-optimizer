import { scoreColor } from "../constants/colors";

function ScoreCircle({ score, label = "ATS Score" }) {
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

export default ScoreCircle;
