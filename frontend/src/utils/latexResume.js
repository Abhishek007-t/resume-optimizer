// A single-pass character map avoids the classic bug of one escape's output
// (e.g. "\textbackslash{}") being re-scanned and re-escaped by a later
// replace() — String.replace with a global regex never re-scans replacement text.
const LATEX_ESCAPES = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export const escapeLatex = (input) => {
  if (input === null || input === undefined) return "";
  const collapsed = String(input).replace(/\s*\n+\s*/g, " ");
  return collapsed.replace(/[\\&%$#_{}~^]/g, (ch) => LATEX_ESCAPES[ch]);
};

const section = (title, body) => (body && body.trim() ? `\\section*{${title}}\n${body}\n` : "");

// \url{} (hyperref/url package) parses the URL itself and handles special
// characters like #, %, _, & internally — running it through escapeLatex
// first would double-escape it into literal backslashes. Only strip the
// characters that would actually break \url{}'s brace matching.
const sanitizeUrl = (url) => String(url || "").replace(/[{}\\]/g, "");

const DEFAULT_SECTION_ORDER = ["summary", "experience", "projects", "education", "skills", "certifications"];

// `skills` moved from a flat [String] to [{category, items}] so grouped
// skills (Languages/Frameworks/Tools) survive the round trip instead of
// collapsing into one undifferentiated line. Resumes parsed before that
// change (or loaded from an old cached document) still have the flat shape,
// so this normalizes either into the same [{category, items}] form.
export const normalizeSkillGroups = (skills) => {
  if (!Array.isArray(skills) || skills.length === 0) return [];
  if (typeof skills[0] === "string") {
    return [{ category: "", items: skills.filter(Boolean) }];
  }
  return skills
    .map((g) => ({ category: g.category || "", items: (g.items || []).filter(Boolean) }))
    .filter((g) => g.items.length > 0);
};

// Three real, recognizable templates — not generic house styles. All
// strictly single-column: Deedy Resume (the other famous option) is
// deliberately not offered because its signature look IS a two-column
// sidebar, which is the exact layout pattern the Parseability checker flags
// as a real ATS-parsing risk (confirmed firsthand earlier in this project).
export const TEMPLATE_NAMES = {
  jakes: "Jake's Resume",
  awesomecv: "Awesome-CV",
  moderncv: "ModernCV Classic",
};

// "jakes" and "awesomecv" both use a plain article class and share the same
// section-content generation below — only document chrome (fonts, header,
// spacing) differs. "moderncv" uses a genuinely different LaTeX class with
// its own macros (\cventry, \cvitem, ...) and is built separately.
const ARTICLE_TEMPLATE_CONFIGS = {
  jakes: {
    docClass: "\\documentclass[11pt,a4paper]{article}",
    margin: "0.75in",
    entrySpace: "8pt",
    extraPackages: "",
    // Small caps + titlerule under each heading is Jake's Resume's most
    // recognizable signature, more so than any specific color choice.
    titleformat: "\\titleformat{\\section}{\\scshape\\raggedright\\large}{}{0em}{}[\\titlerule]\n\\titlespacing{\\section}{0pt}{10pt}{5pt}",
    header: (name, contactLine) => `\\begin{center}
{\\Huge \\scshape ${name}} \\\\[2pt]
\\small ${contactLine}
\\end{center}`,
    contactSeparator: " $|$ ",
  },
  awesomecv: {
    docClass: "\\documentclass[11pt,a4paper]{article}",
    margin: "0.8in",
    entrySpace: "7pt",
    // xcolor is in every default TeX Live install (same guarantee as the
    // other packages here) — used for Awesome-CV's signature bold accent
    // color, matching this app's own steel-teal brand.
    extraPackages: "\\usepackage{xcolor}\n\\definecolor{accent}{RGB}{62,124,116}",
    titleformat: "\\titleformat{\\section}{\\normalfont\\Large\\bfseries\\color{accent}}{}{0em}{}[{\\color{accent}\\titlerule[0.8pt]}]\n\\titlespacing{\\section}{0pt}{12pt}{6pt}",
    header: (name, contactLine) => `{\\Huge \\textbf{\\color{accent}${name}}} \\\\[4pt]
{\\small ${contactLine}}
\\vspace{4pt}\\hrule`,
    contactSeparator: " \\textbullet\\ ",
  },
};

const buildArticleSections = (resume, cfg) => {
  const { contactInfo = {}, summary, experience = [], education = [], skills = [], certifications = [], projects = [], sectionOrder } = resume;

  const contactLine = [contactInfo.email, contactInfo.phone, contactInfo.location, contactInfo.linkedin, contactInfo.github]
    .filter(Boolean)
    .map(escapeLatex)
    .join(cfg.contactSeparator);

  const entryGap = `\n\\vspace{${cfg.entrySpace}}\n\n`;

  const experienceTex = experience.map((exp) => {
    const bullets = (exp.bullets || [])
      .filter((b) => b && b.trim())
      .map((b) => `  \\item ${escapeLatex(b)}`)
      .join("\n");
    const locationTex = exp.location ? ` \\textit{${escapeLatex(exp.location)}}` : "";
    return `\\textbf{${escapeLatex(exp.position)}}${locationTex} \\hfill \\textit{${escapeLatex(exp.duration)}} \\\\
\\textit{${escapeLatex(exp.company)}}
${bullets ? `\\begin{itemize}[leftmargin=*, topsep=2pt, itemsep=1pt]\n${bullets}\n\\end{itemize}` : ""}`;
  }).join(entryGap);

  const projectsTex = projects.map((p) => {
    const stack = p.techStack?.length ? ` \\textit{(${escapeLatex(p.techStack.join(", "))})}` : "";
    const linkTex = p.link ? ` \\textbar\\ \\url{${sanitizeUrl(p.link)}}` : "";
    return `\\textbf{${escapeLatex(p.title)}}${stack}${linkTex} \\\\
${escapeLatex(p.description)}`;
  }).join(entryGap);

  const educationTex = education.map((ed) => {
    const degreeField = ed.field ? `${escapeLatex(ed.degree)}, ${escapeLatex(ed.field)}` : escapeLatex(ed.degree);
    return `\\textbf{${degreeField}} \\hfill \\textit{${escapeLatex(ed.year)}} \\\\
${escapeLatex(ed.school)}`;
  }).join(entryGap);

  const skillsTex = normalizeSkillGroups(skills)
    .map((g) => (g.category
      ? `\\textbf{${escapeLatex(g.category)}:} ${g.items.map(escapeLatex).join(", ")} \\\\`
      : `${g.items.map(escapeLatex).join(", ")} \\\\`))
    .join("\n");

  const certificationsTex = certifications.filter(Boolean).map(escapeLatex).join(", ");

  const sectionBuilders = {
    summary: () => section("Summary", escapeLatex(summary)),
    experience: () => section("Experience", experienceTex),
    projects: () => section("Projects", projectsTex),
    education: () => section("Education", educationTex),
    skills: () => section("Skills", skillsTex),
    certifications: () => section("Certifications", certificationsTex),
  };

  const order = Array.isArray(sectionOrder) && sectionOrder.length > 0
    ? [...sectionOrder, ...DEFAULT_SECTION_ORDER.filter((key) => !sectionOrder.includes(key))]
    : DEFAULT_SECTION_ORDER;

  const sectionsTex = order.filter((key) => sectionBuilders[key]).map((key) => sectionBuilders[key]()).join("\n");

  return { contactLine, sectionsTex };
};

const buildArticleResume = (resume, templateKey) => {
  const cfg = ARTICLE_TEMPLATE_CONFIGS[templateKey] || ARTICLE_TEMPLATE_CONFIGS.jakes;
  const name = escapeLatex(resume.contactInfo?.name || "Your Name");
  const { contactLine, sectionsTex } = buildArticleSections(resume, cfg);

  return `${cfg.docClass}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[margin=${cfg.margin}]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
${cfg.extraPackages}
${cfg.titleformat}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\begin{document}

${cfg.header(name, contactLine)}

${sectionsTex}
\\end{document}
`;
};

// ModernCV Classic — a genuinely different LaTeX class (the real, widely-used
// `moderncv` CTAN package, standard on every TeX Live/Overleaf install), not
// a plain-article style. Uses its own \cventry/\cvitem macros rather than
// the shared section builders above.
const buildModerncvResume = (resume) => {
  const { contactInfo = {}, summary, experience = [], education = [], skills = [], certifications = [], projects = [], sectionOrder } = resume;

  const fullName = (contactInfo.name || "Your Name").trim();
  const spaceIdx = fullName.indexOf(" ");
  const firstName = escapeLatex(spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx));
  const lastName = escapeLatex(spaceIdx === -1 ? "" : fullName.slice(spaceIdx + 1));

  const extraInfo = [contactInfo.linkedin, contactInfo.github].filter(Boolean).map(escapeLatex).join(" \\quad ");

  const experienceTex = experience.map((exp) => {
    const bullets = (exp.bullets || []).filter((b) => b && b.trim()).map((b) => `  \\item ${escapeLatex(b)}`).join("\n");
    const description = bullets ? `\\begin{itemize}[leftmargin=*, topsep=1pt, itemsep=1pt]\n${bullets}\n\\end{itemize}` : "";
    return `\\cventry{${escapeLatex(exp.duration)}}{${escapeLatex(exp.position)}}{${escapeLatex(exp.company)}}{${escapeLatex(exp.location || "")}}{}{${description}}`;
  }).join("\n");

  const projectsTex = projects.map((p) => {
    const stack = p.techStack?.length ? escapeLatex(p.techStack.join(", ")) : "";
    return `\\cventry{}{${escapeLatex(p.title)}}{${stack}}{}{}{${escapeLatex(p.description)}}`;
  }).join("\n");

  const educationTex = education.map((ed) => {
    const degreeField = ed.field ? `${escapeLatex(ed.degree)}, ${escapeLatex(ed.field)}` : escapeLatex(ed.degree);
    return `\\cventry{${escapeLatex(ed.year)}}{${degreeField}}{${escapeLatex(ed.school)}}{}{}{}`;
  }).join("\n");

  const skillsTex = normalizeSkillGroups(skills)
    .map((g) => `\\cvitem{${escapeLatex(g.category)}}{${g.items.map(escapeLatex).join(", ")}}`)
    .join("\n");

  const certificationsTex = certifications.filter(Boolean).length
    ? `\\cvitem{}{${certifications.filter(Boolean).map(escapeLatex).join(", ")}}`
    : "";

  const sectionBuilders = {
    summary: () => (summary && summary.trim() ? `\\section{Summary}\n\\cvitem{}{${escapeLatex(summary)}}\n` : ""),
    experience: () => (experienceTex ? `\\section{Experience}\n${experienceTex}\n` : ""),
    projects: () => (projectsTex ? `\\section{Projects}\n${projectsTex}\n` : ""),
    education: () => (educationTex ? `\\section{Education}\n${educationTex}\n` : ""),
    skills: () => (skillsTex ? `\\section{Skills}\n${skillsTex}\n` : ""),
    certifications: () => (certificationsTex ? `\\section{Certifications}\n${certificationsTex}\n` : ""),
  };

  const order = Array.isArray(sectionOrder) && sectionOrder.length > 0
    ? [...sectionOrder, ...DEFAULT_SECTION_ORDER.filter((key) => !sectionOrder.includes(key))]
    : DEFAULT_SECTION_ORDER;

  const sectionsTex = order.filter((key) => sectionBuilders[key]).map((key) => sectionBuilders[key]()).join("\n");

  return `\\documentclass[11pt,a4paper,sans]{moderncv}
\\moderncvstyle{classic}
\\moderncvcolor{grey}
\\usepackage[scale=0.8]{geometry}
\\usepackage[T1]{fontenc}

\\name{${firstName}}{${lastName}}
${contactInfo.location ? `\\address{${escapeLatex(contactInfo.location)}}{}{}` : ""}
${contactInfo.phone ? `\\phone[mobile]{${escapeLatex(contactInfo.phone)}}` : ""}
${contactInfo.email ? `\\email{${escapeLatex(contactInfo.email)}}` : ""}
${extraInfo ? `\\extrainfo{${extraInfo}}` : ""}

\\begin{document}
\\makecvtitle

${sectionsTex}
\\end{document}
`;
};

// Generates a standalone, ATS-safe LaTeX resume from the same structured
// data the web builder already edits — only uses packages present in every
// default TeX Live install (including Overleaf's), so it compiles as-is.
export function buildLatexResume(resume) {
  const templateKey = TEMPLATE_NAMES[resume.template] ? resume.template : "jakes";
  if (templateKey === "moderncv") return buildModerncvResume(resume);
  return buildArticleResume(resume, templateKey);
}
