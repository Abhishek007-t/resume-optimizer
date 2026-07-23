# Resume Optimizer → Placement Platform: Extension Strategy

**Prepared for**: MCA candidate, Resume Optimizer (MERN + Gemini)
**Date**: 2026-07-22
**Constraint**: ~4 weeks to campus placement season

A repo-grounded audit of what's already built, plus ten AI-native features — scored, ranked, and sequenced against a one-month runway to campus placements. None of these are interview-question banks or plain CRUD — every idea reuses data your app already collects (resume text, match scores, analysis history) and makes the AI do something code alone can't.

---

## Table of Contents

1. [Where the project actually stands](#where-the-project-actually-stands)
2. [The lens used to pick ideas](#the-lens-used-to-pick-ideas)
3. [The ten features](#the-ten-features)
4. [Comparison matrix](#comparison-matrix)
5. [Final ranking](#final-ranking)
6. [The recommendation](#the-recommendation)

---

## Where the project actually stands

Read straight from the repo, not the docs' aspirational phase list — the project is further along than `docs/Resume_Optimizer_Phases.md` claims. Dashboard, AnalyzeResume, and JobMatch pages are already wired to live endpoints.

| Layer | What's built | Evidence |
|---|---|---|
| Auth | JWT signup/login, protected routes, profile endpoint | `authController.js`, `middleware/auth.js` |
| Ingestion | Multer upload, PDF/DOCX/TXT parsed to plain text on the Resume document | `resumeController.js`, `Resume.js` (`extractedText`) |
| AI analysis | Gemini-backed ATS score, strengths/weaknesses, keyword gaps, structured JSON out | `aiController.js`, `geminiService.js` |
| Job matching | Resume-vs-JD match score, matched/missing skills, HR-style recommendation | `jobController.js` |
| History | Unified `Analysis` model typed `analysis`\|`job-match`, indexed by user + date | `Analysis.js` |
| Frontend | Dashboard, Upload, Analyze, JobMatch, Login/Register pages, service-layer API client | `frontend/src/pages`, `frontend/src/services` |
| Cost discipline | Explicit rule: don't spend Gemini calls on anything plain code can do; cache results | `docs/Rules.md`, `docs/Free_AI_Strategy.md` |

---

## The lens used to pick ideas

Every idea had to clear four bars before making the list — otherwise it's just another CRUD screen or question bank with an AI badge stapled on.

- **Reuses your data** — built on `Resume.extractedText`, match scores, or analysis history already stored, not a bolted-on side app.
- **AI does something code can't** — judgment, generation, or multi-turn reasoning, not string matching wearing a chatbot costume.
- **Survives an interview grilling** — you can defend the architecture, the prompt design, and the data model out loud, unscripted.
- **Shippable in weeks, not a semester** — placements start next month, so scope had to fit inside the existing stack with no new infra.

---

## The ten features

Ranked best → weakest fit (see [Final ranking](#final-ranking) for the scoring).

### 1. Project Interrogator — *Flagship*

*An AI panel that cross-examines the projects already sitting in your resume.*

| | |
|---|---|
| **Problem** | 60–70% of a campus technical round is "walk me through this project." Most students freeze or give vague, unmeasured answers because they've never had to defend their own resume claims under follow-up pressure. |
| **Why existing tools fall short** | Question banks (your friend's project included) hand out generic DSA/HR questions with zero idea what's on your resume. Pramp/InterviewBit pair you with strangers reading a script — nobody probes the specific "optimized the API by 40%" line you wrote and never measured. |
| **What makes it unique** | It reads the actual project text already stored in `Resume.extractedText` and asks the same escalating follow-ups a real panel would. No interview-prep site or resume tool interrogates your specific, self-written claims. |
| **User workflow** | Pick a resume → AI extracts distinct projects → open an interrogation chat per project → answer in text → AI fires 2–3 escalating follow-ups per claim → session ends with a "weak claims" report flagging vague/unquantified statements. |
| **Frontend** | New `ProjectInterrogator.jsx` — chat-style thread, project picker, weak-claims report reusing the existing score-card visual pattern from AnalyzeResume. |
| **Backend architecture** | `projectController.js` + routes; extend `geminiService.js` with `extractProjects()` (one-shot, cached) and `interrogate()` (multi-turn, passes conversation history + source text each call). |
| **MongoDB collections** | Extend **Resume**: `parsedProjects: [{title, description, techStack}]`. New **projectInterrogations**: `{user, resumeId, projectTitle, conversation: [{role, text, ts}], weakClaims: [String], depthScore, createdAt}`. |
| **AI prompt / workflow** | Stage 1 (one-shot): extract projects as structured JSON, cache on the Resume doc. Stage 2 (multi-turn): system prompt — *"You are a strict but fair technical panelist. Ask ONE pointed follow-up probing for numbers, tradeoffs, or the student's specific contribution. If the last answer was vague, say so and ask again before moving on."* |
| **APIs / third-party services** | None beyond the Gemini integration already in place. Zero new cost. |
| **Difficulty** | Intermediate–Advanced — multi-turn context management and structured extraction, both realistic on the current stack. |
| **Resume impact** | *"Built a multi-turn AI interviewer (Node.js + Gemini) that parses resume project claims and generates adaptive, panel-style follow-up questioning to surface unquantified statements."* |
| **Interview discussion points** | How do you maintain conversation context across turns without re-sending the whole resume every call? How do you detect a "vague" answer — LLM judgment vs a programmatic rule? How do you stop the AI from asking follow-ups unrelated to the actual project text? |
| **Future improvements** | Voice mode via the Web Speech API; three interviewer personas (HR / tech lead / architect); feed weak claims straight into the Resume Tailoring engine (#5) to auto-suggest fixes. |

---

### 2. Resume-Grounded Mock Interview Simulator — *Flagship*

*Interview questions generated live from your actual resume + the actual JD, scored against a rubric.*

| | |
|---|---|
| **Problem** | Students rehearse answers in isolation with no real-time feedback on structure, relevance, or fit to the specific role they're applying for. Peer mock interviews are inconsistent and unscored. |
| **Why existing tools fall short** | Pramp/InterviewBit are generic and not tied to a specific JD or resume. A static question bank is a list, not a coach — it never tells you if your answer was actually good. |
| **What makes it unique** | Every question is generated from the same resume+JD pairing the Job Match feature already stores, and every answer is scored against a rubric — relevance, structure, quantification — instead of a generic "good job." |
| **User workflow** | Choose resume + a saved JD → pick round type (HR / Technical / Behavioral) → AI generates 5–8 tailored questions → answer via text or mic → per-answer feedback → end-of-session report highlighting weakest areas. |
| **Frontend** | `MockInterview.jsx` — question stream, text/mic input via the browser's SpeechRecognition API, live feedback cards, session summary reusing the existing score-display pattern. |
| **Backend architecture** | `interviewController.js` + routes; geminiService additions `generateQuestions(resumeText, jd, roundType)` and `scoreAnswer(question, answer, context)`. |
| **MongoDB collections** | New **interviewSessions**: `{user, resumeId, jobDescription, roundType, qa: [{question, answer, score, feedback}], overallScore, createdAt}` — indexed on user + createdAt. |
| **AI prompt / workflow** | Generation prompt constrained to a JSON array of `{question, category, targetSkill}`. Scoring prompt is rubric-based JSON `{score, strengths, gaps, idealAnswerHint}` — same "structured JSON only" discipline already in `aiController.js`. |
| **APIs / third-party services** | Web Speech API for optional voice input — browser-native, free, no key. Gemini for generation/scoring. No new paid dependency. |
| **Difficulty** | Advanced — speech integration, rubric consistency, multi-question session state. |
| **Resume impact** | *"Designed an AI mock-interview engine that generates job-description-specific questions and rubric-based answer scoring using Gemini and the Web Speech API."* |
| **Interview discussion points** | How do you keep scoring consistent across runs (temperature, rubric anchoring)? How would you rate-limit this against your 30-RPM free Gemini quota during peak placement week? How do you stop a student from gaming the score with copy-pasted "ideal" answers? |
| **Future improvements** | Tone/pace analysis from audio; company-specific interviewer personas; auto-feed weak project claims from #1 into the question generator. |

---

### 3. Placement Readiness Index — *Flagship*

*One honest composite score, trended over time, benchmarked against peers — computed, not another AI call.*

| | |
|---|---|
| **Problem** | Students see an ATS score here, a match score there, and no single honest signal of "am I actually ready" versus everyone else applying for the same roles. |
| **Why existing tools fall short** | Every resume tool shows a single-resume score in isolation. Nobody aggregates a student's full activity — resume quality, match history, interview practice — into one trend, benchmarked. |
| **What makes it unique** | Computed server-side from data already collected (`Analysis.atsScore` history, job-match scores, and interview data once #2 exists), plus anonymized percentile ranking. This is an analytics/systems feature, not "call Gemini again" — a different kind of technical depth to show off. |
| **User workflow** | Dashboard auto-computes score on login → trend chart over time → percentile badge ("Top 30% of active users this week") → breakdown of what's dragging the score down. |
| **Frontend** | `ReadinessDashboard.jsx` — gauge/radial score, trend sparkline reusing Dashboard.jsx patterns, per-category breakdown cards. |
| **Backend architecture** | `readinessController.js` running a MongoDB aggregation pipeline across **analyses** (and later interview/application data), plus a percentile-ranking query across all users. |
| **MongoDB collections** | Computed **readinessSnapshots**: `{user, atsAvg, matchAvg, interviewAvg, compositeScore, percentile, computedAt}` — reads from existing **analyses**, no data duplication. |
| **AI prompt / workflow** | Mostly non-AI: aggregation math computes the score. One optional Gemini call turns the numbers into a narrative: *"Your resume quality is strong, but job-match scores sit 20 points below platform average for SDE roles — that's your biggest lever this week."* |
| **APIs / third-party services** | None new — pure MongoDB aggregation, one narrative Gemini call per view at most. Matches the existing cost-discipline in `Free_AI_Strategy.md`. |
| **Difficulty** | Intermediate — aggregation pipelines and percentile math; strong for showing backend/data depth beyond "wrap an LLM call." |
| **Resume impact** | *"Built a composite 'Placement Readiness Index' using MongoDB aggregation pipelines across resume, job-match, and interview data, with percentile benchmarking across users."* |
| **Interview discussion points** | How do you compute a percentile efficiently at scale — pre-aggregated or on-the-fly? How do you keep the composite meaningful for a student with incomplete data? How would you stop someone gaming the score with low-effort repeated analyses? |
| **Future improvements** | Weight sub-scores by target role type; cohort percentiles by branch/college; a predictive "shortlist likelihood" model once real outcome data exists. |

---

### 4. Application Tracker with Rejection Diagnostics — *High-impact*

*Not a Kanban board — a funnel that explains why you keep getting rejected at the same stage.*

| | |
|---|---|
| **Problem** | Students apply to 30–50+ companies each season and lose track of stage, timelines, and — critically — why they keep getting rejected at the same point. |
| **Why existing tools fall short** | Spreadsheets, Notion, Huntr log status but give zero insight into "why." They don't know your resume's match-score history to correlate against outcomes. |
| **What makes it unique** | Because match scores are already computed and stored per resume+JD, the tracker can correlate outcome against the match score and missing-skills list at the time of applying — turning a log into a diagnostic, not a CRUD list. |
| **User workflow** | Add application (company, role, JD, linked resume version) → auto-links to that resume's match score/missing skills → update stage as it progresses → after 5+ data points, AI generates a pattern summary. |
| **Frontend** | `ApplicationTracker.jsx` — kanban board (Applied / OA / Interview / Offer / Rejected), funnel chart, "why am I stuck" insight panel. |
| **Backend architecture** | `applicationController.js` + routes; a diagnostics endpoint aggregating applications joined with stored match scores, then one Gemini call to narrate the pattern. |
| **MongoDB collections** | New **applications**: `{user, company, role, jobDescription, resumeId, matchScoreAtApply, missingSkillsAtApply, stage, stageHistory: [{stage, date}], notes, createdAt}`. |
| **AI prompt / workflow** | Single narrative prompt fed a JSON summary of `{stage, matchScore, missingSkills}` tuples: *"Identify the strongest correlating pattern behind these rejections in 2–3 sentences, plus one concrete fix."* |
| **APIs / third-party services** | None new. |
| **Difficulty** | Intermediate — mostly schema design and aggregation with a thin AI layer; the fastest build of the top five. |
| **Resume impact** | *"Built an application-tracking module correlating job-match scores and missing-skill data against real outcomes to auto-diagnose rejection patterns across a placement season."* |
| **Interview discussion points** | How do you snapshot `matchScoreAtApply` so later resume edits don't retroactively rewrite history? What's your minimum sample size before trusting a "pattern"? How would you visualize a funnel with drop-off rates? |
| **Future improvements** | Gmail API parsing to auto-detect rejection/OA emails and update stage; benchmark your funnel against anonymized peer funnels. |

---

### 5. AI Resume Tailoring Engine — *High-impact*

*Closes the loop your Job Match feature already opened — rewrites, then proves the improvement with a real re-score.*

| | |
|---|---|
| **Problem** | A one-size-fits-all resume underperforms against ATS keyword filters per JD, but manually rewriting for 40+ applications isn't realistic — the exact problem the project's own PRD names. |
| **Why existing tools fall short** | Generic resume builders (Novoresume, Rezi) tailor style and formatting, not content-to-JD keyword alignment with proof it worked. |
| **What makes it unique** | Takes the exact missing-skills output `jobController.js` already computes and asks Gemini to rewrite/reorder *existing* bullets — never fabricate — to close specific gaps, then re-runs the existing match scorer to prove the delta with a real number. |
| **User workflow** | Run a job match → "Tailor this resume" → AI rewrites relevant bullets/summary → before/after diff view → approve or edit → download tailored PDF → system auto re-scores to show the improvement. |
| **Frontend** | `TailorResume.jsx` — side-by-side diff viewer, per-bullet approve/reject toggle, "regenerate as PDF" action. |
| **Backend architecture** | `tailorController.js` calling a constrained Gemini prompt, then reusing `jobController.compareResumeToJob()` to compute the after-score; PDF export via pdf-lib or Puppeteer. |
| **MongoDB collections** | Extend **Resume**: `variants: [{jobDescriptionRef, tailoredText, matchScoreBefore, matchScoreAfter, approvedByUser, generatedAt}]`. |
| **AI prompt / workflow** | Strict system instruction: *"Rewrite ONLY using facts present in the source resume. Do not invent skills, employers, or metrics. Reorder and rephrase existing bullets to surface these missing keywords where truthfully applicable. Return JSON {revisedSummary, revisedBullets: [{original, revised, changed}]}."* |
| **APIs / third-party services** | pdf-lib or Puppeteer for PDF export (free, no key). Gemini for the rewrite. No new paid service. |
| **Difficulty** | Intermediate–Advanced — the anti-fabrication guardrails are the hard, interesting part. |
| **Resume impact** | *"Built an AI resume-tailoring pipeline that rewrites content per job description under strict anti-fabrication constraints, with automatic before/after ATS match-score verification."* |
| **Interview discussion points** | How do you technically stop the LLM from fabricating experience — prompt constraints vs output validation? How would you detect if the AI invented something not in the source text? Why re-run your own scorer instead of trusting the LLM's self-reported improvement? |
| **Future improvements** | Keyword-to-bullet mapping visualization; batch tailoring across multiple JDs; only surface claims that survived cross-examination in #1. |

---

### 6. Recruiter 6-Second Scan Simulator — *Solid*

*A rule-based attention heatmap of how a rushed recruiter actually skims your resume, plus a one-call AI roast.*

| | |
|---|---|
| **Problem** | Research on resume screening shows a ~6–8 second skim before a keep/reject snap judgment. Students never see their resume the way a tired recruiter actually sees it. |
| **Why existing tools fall short** | ATS checkers tell you if a machine can parse your resume. Nothing shows the human skim pattern — what a rushed reader's eyes actually catch first in a cluttered layout. |
| **What makes it unique** | A deterministic heuristic model — whitespace ratio, section order, bullet-length variance, keyword density in the top third, all plain JS, zero API cost — paired with one Gemini call for a blunt, human-style summary. Genuinely fun, shareable, and a strong live demo. |
| **User workflow** | Pick a resume → system renders a heatmap overlay (darker = higher attention weight) → "what a recruiter noticed in 6 seconds" list → optional AI roast toggle. |
| **Frontend** | `ScanHeatmap.jsx` — Canvas-rendered heatmap over parsed resume blocks, roast-mode toggle, shareable result card. |
| **Backend architecture** | `scanController.js` running the pure-JS heuristic scorer against `Resume.extractedText`, plus one optional Gemini call for the roast. |
| **MongoDB collections** | Extend **Resume**: `scanHeatmap: {sections: [{name, attentionWeight}], sixSecondSummary, roastText, computedAt}` — cached, recomputed only on change. |
| **AI prompt / workflow** | Heuristic scoring is rule-based, deliberately not AI. One Gemini call: *"In under 60 words, bluntly describe what a rushed recruiter would notice and ignore in the first 6 seconds, given this section-attention data."* Keeping the model itself deterministic is the interesting engineering choice. |
| **APIs / third-party services** | Canvas API (browser-native) for rendering. Gemini for the roast text only — near-zero API cost per use. |
| **Difficulty** | Intermediate — the heuristic model design is the real problem, not the AI call. |
| **Resume impact** | *"Designed a rule-based resume attention heuristic rendered as an interactive skim heatmap, paired with a lightweight AI summary layer — kept AI usage to one low-cost call per analysis."* |
| **Interview discussion points** | How did you design the attention-weighting heuristic — what signals, how validated? Why keep this rule-based instead of full-AI — what's the cost/latency/explainability tradeoff? How would you validate the heuristic against real recruiter behavior? |
| **Future improvements** | Calibrate weights against real eye-tracking study data; A/B different layouts and re-score; browser-extension version for LinkedIn profiles. |

---

### 7. Company-Specific Prep Roadmap Generator — *Solid*

*Crowdsourced hiring-pattern data crossed with your personal resume gap analysis — not another generic syllabus.*

| | |
|---|---|
| **Problem** | "Prepare for Company X" advice online is generic; students don't know what that company, for that role, actually tests, or how their own resume stacks up against that bar. |
| **Why existing tools fall short** | Static syllabus/question-bank sites hand every student the same 500 questions regardless of target company or their current resume gaps — zero personalization. |
| **What makes it unique** | Cross-references a lightweight, crowdsourced company profile (seeded from your placement cell/seniors) against the student's specific gap analysis, reusing jobController's existing logic, to generate a personalized week-by-week plan. |
| **User workflow** | Select target company from a seeded list (or add one) → view historical round structure → AI compares resume against typical requirements → prioritized, dated roadmap with checkboxes. |
| **Frontend** | `CompanyPrep.jsx` — company profile view, gap-analysis summary, checklist roadmap with progress tracking. |
| **Backend architecture** | `companyController.js` (CRUD for seeded/crowdsourced data) and `prepPlanController.js` (generates/saves the personalized plan). |
| **MongoDB collections** | **companies**: `{name, commonRoles, roundsStructure, reportedQuestions, avgCTC, contributedBy}`. **prepPlans**: `{user, companyId, resumeGapSummary, roadmapSteps: [{task, dueBy, done}], generatedAt}`. |
| **AI prompt / workflow** | *"Given this student's resume gaps and this company's typical requirements, generate a prioritized 3-week prep roadmap as JSON steps with rationale for ordering."* |
| **APIs / third-party services** | None — company data is manually/crowdsourced-seeded (a Google Form → import script) rather than scraped, avoiding ToS risk entirely. |
| **Difficulty** | Intermediate — mostly data modeling and seeding, moderate AI orchestration. |
| **Resume impact** | *"Built a company-specific prep engine cross-referencing crowdsourced hiring-pattern data with individual resume gap analysis to auto-generate prioritized study roadmaps."* |
| **Interview discussion points** | How do you keep crowdsourced company data trustworthy — moderation or verification? How do you handle the cold-start problem with too few companies seeded? How is this actually different from a static syllabus site? |
| **Future improvements** | Let seniors verify/upvote reported questions; expand crowdsourcing across colleges. |

---

### 8. Resume-Grounded STAR Behavioral Coach — *Solid*

*Behavioral questions generated from your own achievement bullets, scored for STAR completeness.*

| | |
|---|---|
| **Problem** | Behavioral rounds ("tell me about a time you...") trip up technical students who can code but can't structure a compelling story about their own experience. |
| **Why existing tools fall short** | Generic STAR-method explainers and question banks teach the framework but never coach your specific answer or flag when you're being vague. |
| **What makes it unique** | Auto-generates behavioral questions from the student's own resume achievement bullets — not a generic bank — and scores the answer against STAR completeness and quantification. |
| **User workflow** | System extracts achievement-style bullets from the resume → picks one → asks a matching behavioral question → student answers → AI scores S/T/A/R completeness, flags missing metrics, suggests a rewritten structure. |
| **Frontend** | `BehavioralCoach.jsx` — question tied to the source bullet, answer box, STAR completeness meter. |
| **Backend architecture** | `behavioralController.js`; geminiService additions `extractAchievements()` and `scoreSTAR()`. |
| **MongoDB collections** | **behavioralSessions**: `{user, resumeId, sourceBullet, question, answer, starScores: {s,t,a,r}, feedback, createdAt}`. |
| **AI prompt / workflow** | Scoring prompt returns JSON `{situation, task, action, result, missingMetrics, feedback}` scored 0–1 per dimension. |
| **APIs / third-party services** | None beyond Gemini. |
| **Difficulty** | Intermediate — architecturally close to #2, meaning natural code reuse but thinner net-new differentiation. |
| **Resume impact** | *"Built a STAR-framework behavioral answer coach that auto-generates questions from a candidate's own resume achievements and scores answer completeness."* |
| **Interview discussion points** | How do you programmatically detect "quantification" in free text? How do you stop the AI being overly generous with scores? How does this differ architecturally from the mock interview feature? |
| **Future improvements** | Voice delivery scoring — pace, filler words; track answer quality across versions over time. |

---

### 9. Offer Evaluation & Negotiation Copilot — *Situational*

*Parses your real CTC breakdown and drafts a negotiation email grounded in your actual numbers.*

| | |
|---|---|
| **Problem** | First-time offer holders, especially MCA freshers, don't know if a CTC breakdown is fair or how to ask for more without sounding entitled or risking the offer. |
| **Why existing tools fall short** | Generic salary-negotiation articles aren't India-fresher-specific and aren't grounded in the student's actual offer numbers. |
| **What makes it unique** | Parses the actual offer letter/CTC breakup the student pastes in and drafts a specific, professional negotiation email using their real numbers and role — not a generic template. |
| **User workflow** | Paste/upload offer details → AI breaks down fixed vs variable vs joining bonus → flags anything atypical → drafts 2–3 tone options for a negotiation email → student edits and sends. |
| **Frontend** | `OfferAnalyzer.jsx` — breakdown table, email draft preview with tone selector. |
| **Backend architecture** | `offerController.js`; one Gemini call for breakdown + drafting. |
| **MongoDB collections** | **offers**: `{user, company, role, location, ctcBreakup, marketNote, draftEmails, createdAt}`. |
| **AI prompt / workflow** | *"Given this CTC breakdown for a fresher SDE role in [location], summarize fixed vs variable, note anything atypical, and draft a polite negotiation email in three tones — direct, cautious, gratitude-first."* |
| **APIs / third-party services** | None — deliberately no live salary-benchmark API (cost/reliability risk); uses a small manually seeded reference table, stated as an honest limitation. |
| **Difficulty** | Beginner–Intermediate — mostly a prompt plus a form; the lightest technical depth of the ten, best as a small companion, not a flagship. |
| **Resume impact** | *"Added an AI-assisted offer-evaluation tool using structured CTC parsing and tone-controlled negotiation email generation."* |
| **Interview discussion points** | How do you handle CTC breakdowns given as free text — parsing robustness? Why not integrate a live salary API — what tradeoff did you make? |
| **Future improvements** | Real market-benchmark integration; multi-offer side-by-side comparison. |

---

### 10. AI Skill-Gap & Learning Roadmap Generator — *Situational*

*A personalized, time-boxed gap list against a target role — the most CRUD-adjacent of the ten.*

| | |
|---|---|
| **Problem** | Students know they're "not ready" for a target role but don't know exactly which skills to prioritize in the limited weeks left before placements. |
| **Why existing tools fall short** | Generic roadmap.sh-style learning paths are role-generic, not personalized to the student's actual current resume — everyone gets the same path. |
| **What makes it unique** | Compares the student's actual parsed skills against a target-role profile to produce a personalized, prioritized, time-boxed gap list linking only to free resources — consistent with the project's existing $0 philosophy. |
| **User workflow** | Pick target role → AI compares resume skills vs role requirements → prioritized gap list with time estimates → checklist with progress tracking. |
| **Frontend** | `SkillRoadmap.jsx` — gap list, progress checklist, timeline view. |
| **Backend architecture** | `roadmapController.js`; one Gemini call comparing resume skills JSON against a seeded role-requirement JSON. |
| **MongoDB collections** | **learningRoadmaps**: `{user, targetRole, gapSkills: [{skill, priority, estWeeks, resource}], progress, createdAt}`; seed collection **roleProfiles**. |
| **AI prompt / workflow** | *"Given current skills and target role requirements, return a prioritized JSON gap list with estimated weeks to close each gap and one free resource per skill."* |
| **APIs / third-party services** | None new. |
| **Difficulty** | Beginner–Intermediate — closest in spirit to a smart to-do list, which is exactly why it ranks last despite being genuinely useful. |
| **Resume impact** | *"Built a personalized skill-gap roadmap generator comparing parsed resume skills against target-role requirements with prioritized, time-boxed learning plans."* |
| **Interview discussion points** | How do you keep role-requirement profiles current without manual upkeep? How is this meaningfully different from a static roadmap site? |
| **Future improvements** | Auto-verify claimed skills via linked GitHub activity; tie into Project Interrogator (#1) to test claimed skills directly. |

---

## Comparison matrix

Each criterion scored 1–5. *Dev speed* is inverted on purpose — 5 means fast to ship given the existing stack, not slow.

| Feature | Originality | Technical complexity | Resume value | Recruiter impression | Real-world usefulness | Dev speed | Average |
|---|---|---|---|---|---|---|---|
| 1. Project Interrogator | 5 | 4 | 5 | 5 | 5 | 4 | **4.67** |
| 2. Mock Interview Simulator | 4 | 5 | 5 | 5 | 5 | 3 | **4.50** |
| 3. Placement Readiness Index | 5 | 4 | 4 | 4 | 4 | 4 | **4.17** |
| 4. Application Tracker | 4 | 3 | 3 | 3 | 5 | 5 | **3.83** |
| 5. Resume Tailoring Engine | 3 | 4 | 4 | 4 | 5 | 3 | **3.83** |
| 6. Scan Simulator | 5 | 3 | 3 | 4 | 3 | 4 | **3.67** |
| 7. Company Prep Roadmap | 4 | 3 | 3 | 4 | 4 | 3 | **3.50** |
| 8. STAR Behavioral Coach | 3 | 3 | 3 | 3 | 4 | 4 | **3.33** |
| 9. Offer Negotiation Copilot | 4 | 2 | 2 | 3 | 3 | 5 | **3.17** |
| 10. Skill-Gap Roadmap | 2 | 3 | 3 | 2 | 4 | 4 | **3.00** |

---

## Final ranking

Matches the raw average closely — where it diverges, urgency (the one-month runway) broke the tie in favor of dev speed and resume defensibility.

1. **Project Interrogator** (4.67 avg) — Highest score on every axis that matters for a live campus interview: it's the one feature that directly rehearses the single most common failure mode — vague answers about your own projects — and it's nearly free to build on what already exists.
2. **Mock Interview Simulator** (4.50 avg) — The broadest, most "impressive in a demo" feature, but the speech integration and rubric-scoring work push the build past a single week — the reason it sits second, not first.
3. **Placement Readiness Index** (4.17 avg) — The strongest signal of product/systems thinking rather than "another LLM wrapper" — aggregation and percentile logic are genuinely good interview material, and it's cheap to build since it mostly reads data already stored.
4. **Application Tracker + Rejection Diagnostics** (3.83 avg) — The most immediately useful during the actual placement season — you'll want this for yourself regardless of resume value — and the fastest of the top five to ship.
5. **Resume Tailoring Engine** (3.83 avg) — Loses a point on originality — tailored-resume generators already exist commercially — but the anti-fabrication guardrail design is a genuinely strong, defensible engineering story.
6. **Recruiter 6-Second Scan Simulator** (3.67 avg) — The best "wow, that's different" demo moment of the set, but usefulness is more novelty than daily utility — a great secondary feature, not a spine to build the platform around.
7. **Company-Specific Prep Roadmap** (3.50 avg) — Held back by the cold-start problem — it's only as good as the company data you can seed in the time available, which is the one thing outside your direct control.
8. **STAR Behavioral Coach** (3.33 avg) — Solid and genuinely useful, but architecturally close enough to the Mock Interview Simulator that building both back-to-back yields diminishing differentiation for the resume line.
9. **Offer Negotiation Copilot** (3.17 avg) — Narrow usefulness window — only relevant once you already have an offer — and the thinnest technical surface of the ten. Fine as a late add-on, not worth prioritizing now.
10. **Skill-Gap Roadmap Generator** (3.00 avg) — The most useful-but-generic idea on the list — closest in shape to a smart to-do list, and the easiest for a recruiter to mentally file as "yet another roadmap app."

---

## The recommendation

**Build two, not ten.** With one month on the clock, feature-sprawl is the actual risk — a platform with three finished, demo-ready AI features beats one with eight half-built ones, in every interview.

**Ship Project Interrogator first. Mock Interview Simulator second. Readiness Index if the week remains.**

All three read from data already stored (`extractedText`, match scores, analysis history), so none require new infrastructure — just new controllers, one new Gemini prompt pattern each, and a chat-style UI built once and reused across #1 and #2.

| Week | Focus |
|---|---|
| **Week 1** | Project Interrogator — `extractProjects()` one-shot parse, `interrogate()` multi-turn loop, chat UI, weak-claims report. Highest originality-to-effort ratio on the list. |
| **Week 2** | Mock Interview Simulator MVP — text-only first, skip voice. Question generation + rubric scoring + session history. |
| **Week 3** | Placement Readiness Index — aggregation pipeline over existing Analysis data plus the new interview sessions. Mostly backend; strong systems-thinking talking point for interviews. |
| **Week 4** | Polish: add Web Speech API voice mode to the interview simulator as a stretch goal, deploy, record a 2-minute demo video, rewrite resume bullets and README against what's actually shipped. |

---

*Grounded in a direct read of this repository's `backend/`, `frontend/`, and `docs/` as of 2026-07-22 — not the aspirational phase plan alone.*
