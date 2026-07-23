// Deterministic, zero-cost check for whether a real (non-AI, rule-based) ATS
// parser could actually read this resume correctly — as opposed to the
// Gemini-based analysis, which judges text quality on content the model
// already received cleanly. This catches the class of bugs that quality
// judgment can't see: multi-column layouts, broken ligatures/encoding,
// missing standard sections, scanned/image-only PDFs.

const REQUIRED_SECTIONS = [
  { key: "experience", pattern: /\b(experience|employment|work history)\b/i },
  { key: "education", pattern: /\beducation\b/i },
  { key: "skills", pattern: /\bskills\b/i },
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(\+?\d[\d\s-]{8,}\d)/;

const SHORT_LINE_MAX_LEN = 15;
const SHORT_LINE_RATIO_THRESHOLD = 0.45;
const WIDE_GAP_PATTERN = / {4,}/;
const WIDE_GAP_LINE_RATIO_THRESHOLD = 0.15;

const checkParseability = (extractedText) => {
  const issues = [];
  let score = 100;

  const text = extractedText || "";
  const trimmed = text.trim();

  if (trimmed.length < 200) {
    issues.push({
      type: "near-empty-text",
      severity: "High",
      message: "Almost no text could be extracted from this file. It may be a scanned image or a design exported without selectable text — a real ATS would see this as blank.",
    });
    score -= 40;
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length > 5) {
    const shortLines = lines.filter((l) => l.trim().length > 0 && l.trim().length < SHORT_LINE_MAX_LEN);
    const shortRatio = shortLines.length / lines.length;
    if (shortRatio > SHORT_LINE_RATIO_THRESHOLD) {
      issues.push({
        type: "fragmented-lines",
        severity: "Medium",
        message: "A large share of extracted lines are very short fragments. This often happens when a multi-column or sidebar layout gets chopped up by a text parser.",
      });
      score -= 20;
    }

    const wideGapLines = lines.filter((l) => WIDE_GAP_PATTERN.test(l));
    const wideGapRatio = wideGapLines.length / lines.length;
    if (wideGapRatio > WIDE_GAP_LINE_RATIO_THRESHOLD) {
      issues.push({
        type: "column-gap-signature",
        severity: "High",
        message: "Several lines contain large internal gaps, a common signature of two-column content being merged onto one line during extraction. This is a strong sign a real ATS parser would scramble your sections.",
      });
      score -= 25;
    }
  }

  if (/�/.test(text)) {
    issues.push({
      type: "encoding-artifacts",
      severity: "High",
      message: "Unrecognized characters were found in the extracted text, usually caused by a font/encoding issue (e.g. missing font embedding or ligatures like 'fi'/'fl' breaking on export). Words may be silently corrupted for a real parser.",
    });
    score -= 25;
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!section.pattern.test(text)) {
      issues.push({
        type: `missing-section-${section.key}`,
        severity: "Medium",
        message: `No standard "${section.key}" section heading was found. Parsers rely on recognizable section headings to file your content correctly.`,
      });
      score -= 12;
    }
  }

  if (!EMAIL_PATTERN.test(text)) {
    issues.push({
      type: "no-email-detected",
      severity: "High",
      message: "No email address could be detected in the extracted text — contact info may be in an image, icon-based header, or unreadable format.",
    });
    score -= 20;
  }

  if (!PHONE_PATTERN.test(text)) {
    issues.push({
      type: "no-phone-detected",
      severity: "Low",
      message: "No phone number could be detected in the extracted text.",
    });
    score -= 8;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    issues,
  };
};

module.exports = { checkParseability };
