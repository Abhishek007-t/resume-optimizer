// Suggests which real LaTeX template (see frontend/src/utils/latexResume.js
// — Jake's Resume, Awesome-CV, ModernCV Classic) is the closest structural
// match to the candidate's original resume — pure heuristics on the
// extracted text, no AI call, so it's free and always available.
// Deliberately never recommends a multi-column/sidebar layout (e.g. Deedy
// Resume): that's the exact pattern parseabilityChecker.js flags as an
// ATS-parsing risk, so all three offered templates stay single-column
// regardless of what the original used.

// Only the wide-gap signal is used here (not short-line ratio, which
// parseabilityChecker.js also uses) — short lines alone are far too common
// in normal, sparse single-column resumes (section headers, one-line
// entries) and produced false positives on genuinely single-column text
// during testing. A run of 4+ spaces mid-line is a much more specific
// signature of two side-by-side text blocks merged onto one extracted line.
const WIDE_GAP_PATTERN = / {4,}/;
const WIDE_GAP_LINE_RATIO_THRESHOLD = 0.15;
const DENSE_LINE_COUNT_THRESHOLD = 55;

const recommendTemplate = (extractedText) => {
  const text = extractedText || "";
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length > 5) {
    const wideGapRatio = lines.filter((l) => WIDE_GAP_PATTERN.test(l)).length / lines.length;

    if (wideGapRatio > WIDE_GAP_LINE_RATIO_THRESHOLD) {
      return {
        template: "jakes",
        reason: "Your original resume looks like it uses a multi-column or sidebar layout. We recommend Jake's Resume (single-column) instead — multi-column designs are a common real ATS-parsing risk, so we don't offer one.",
      };
    }
  }

  if (lines.length > DENSE_LINE_COUNT_THRESHOLD) {
    return {
      template: "moderncv",
      reason: "Your original resume is fairly long/dense. ModernCV Classic's default spacing is tighter, so more of it fits per page.",
    };
  }

  return {
    template: "awesomecv",
    reason: "Your original resume looks like a standard single-column layout, with room for a bit more visual identity — Awesome-CV should be a good fit.",
  };
};

module.exports = { recommendTemplate };
