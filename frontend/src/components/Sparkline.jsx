// Dependency-free trend line — same hand-rolled SVG approach as ScoreCircle,
// avoids pulling in a charting library for a handful of points.
function Sparkline({ points, color, width = 220, height = 48 }) {
  if (!points || points.length === 0) return null;

  const padding = 5;
  const scores = points.map((p) => p.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((p.score - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

export default Sparkline;
