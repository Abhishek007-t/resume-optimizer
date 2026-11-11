// Mirrors the palette defined in src/index.css (@theme block). JS-side score
// coloring (SVG circles, sparklines) can't read CSS custom properties inside
// inline SVG stroke attributes, so those specific values are kept here as
// the single source of truth to avoid drift between the two.
export const COLORS = {
  primary: "#3E7C74",
  secondary: "#B8935A",
  success: "#4F9B72",
  warning: "#C2914A",
  danger: "#B5555A",
};

export const scoreColor = (score) => (score >= 70 ? COLORS.success : score >= 50 ? COLORS.warning : COLORS.danger);
