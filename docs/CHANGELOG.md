# Project History / Changelog

A detailed, chronological account of how this project evolved from a basic resume-analysis tool into a full AI-powered placement-preparation platform. Organized by phase, with real bugs found and fixed called out explicitly (not smoothed over) — this is meant to be a genuine engineering record, not marketing copy.

---

## Baseline (pre-existing project)

Before this engagement, the project was a MERN "Resume Optimizer" with:
- Auth (signup/login/JWT)
- PDF resume upload + `pdf-parse` text extraction
- A single hardcoded-prompt Gemini call for resume analysis
- Basic Job Match (resume vs. pasted job description)
- A dashboard showing analysis history

Two stale draft files (`docs/aiController.js`, `docs/jobController.js`) were found to contain a real security bug (no ownership filter on `Resume.findById`, meaning one user could potentially read another's resume by guessing an ID) and an incorrect SDK call shape. They were unused dead code and were deleted.

## Phase 1 — AI Integration Hardening

**Trigger:** the existing AI integration was flagged as fragile — a single hardcoded prompt with no error handling, no structured output, and no retry logic.

**Delivered (scoped to "baseline fix only," explicitly chosen over bigger options like embeddings/RAG or a full provider-abstraction layer at the time):**
- Structured JSON output via Gemini's native `responseSchema`/`Type` enum, replacing manual prompt-engineering-for-JSON.
- Real multi-turn chat sessions (`ai.chats.create`) for conversational features, with history reseeded from MongoDB per request (stateless HTTP).
- Retry-with-exponential-backoff for transient errors (429/500/502/503/504) — added after hitting real `503 UNAVAILABLE` errors from Gemini during testing.

**Model selection saga** (a real, multi-day debugging thread): `gemini-3.5-flash` → transient 503s → added retry logic → later `gemini-flash-latest` (an alias) worked well through extensive testing, then hit `429 RESOURCE_EXHAUSTED, limit: 20` (its resolved target, `gemini-3.6-flash`, was quota-exhausted). `gemini-2.0-flash` → `429, limit: 0` (fully blocked for this account). `gemini-2.5-flash` → `404, no longer available to new users`. `gemini-3.5-flash-lite` → **worked**, became the model in use.

This surfaced the project's standing operational constraint: the Gemini free tier on this account caps at **20 requests/day per exact model name** — far stricter than the project's original stale documentation claimed (1500/day).

## Phase 2 — Week 1: Project Interrogator

An AI "panelist" that cross-examines one project from the candidate's resume, targeting vague/unquantified claims ("optimized", "built a scalable system") the way a real interviewer would — directly addressing the risk of AI-assisted ("vibe-coded") projects a candidate can't actually explain.

- New model `ProjectInterrogation`, new controller/routes, new frontend page with a 3-phase flow (select resume → extract projects → interrogation chat).
- `depthScore`, `weakClaims`, `strongMoments` computed at session end via a dedicated grading prompt.

## Phase 3 — Week 2: Mock Interview Simulator + Voice Input

- New model `InterviewSession`, HR/Technical/Behavioral rounds, per-answer scoring against strengths/gaps/an ideal-answer hint, and an end-of-session report.
- **Voice input** added to both Mock Interview and Project Interrogator via a `useSpeechToText` hook wrapping the browser's Web Speech API — free, no backend involvement, gracefully renders nothing on unsupported browsers (Firefox/Safari).

## Phase 4 — Week 3: Placement Readiness Index

A composite score aggregating performance across the platform. Initially averaged three components (Analysis, Job Match, Mock Interview) with a percentile rank (computed via a cross-user aggregate) and an AI-written narrative insight. Later extended (Phase 9) to include Project Interrogator as a fourth component — see below, this was a real correctness bug, not just a feature addition.

## Phase 5 — Infrastructure Firefighting

Two real, environment-level bugs surfaced during Week 1-3 testing, both fixed:

1. **MongoDB SRV DNS failure.** `mongodb+srv://` connection strings failed with `querySrv ECONNREFUSED` — confirmed on both the sandboxed dev environment *and* the user's real network/college ISP (a genuine, common issue on networks whose DNS resolver doesn't support SRV records). Fixed by switching to the non-SRV connection string format (explicit shard hostnames + `:27017` ports, obtained via Atlas's "Drivers" dialog with the SRV toggle off).
2. **PDF test-fixture generation** was attempted by hand-constructing a minimal valid PDF binary; this hit repeated `bad XRef entry` errors from `pdf-parse`/pdf.js despite byte-perfect offset verification. Abandoned as disproportionate effort; test data was inserted directly into MongoDB instead, bypassing the unrelated, already-trusted PDF-parsing code path.

## Phase 6 — Resume Builder + Overleaf Integration (multiple iterations)

This feature went through the most redesign of anything in the project.

**v1:** A visual, template-based builder (Modern/Classic/Minimal React templates, live HTML/CSS preview, browser print-to-PDF export) plus AI-powered field editing ("Improve with AI") and a resume-structure parser.

**v2 — real LaTeX/Overleaf export added.** The user personally uses Overleaf and wanted parity with what classmates' other tools offered. Implemented client-side LaTeX generation (`buildLatexResume`) submitted directly to Overleaf's documented `POST /docs` endpoint via a hidden form (`snip` field) — no backend involvement, no file hosting.

**Bug found and fixed — LaTeX ligature corruption.** The generated `.tex` had no `\usepackage[T1]{fontenc}`, so LaTeX fell back to OT1 encoding, under which ligatures (`fi`, `fl`, `ffi`) get embedded without a reliable ToUnicode mapping — meaning a PDF text extractor (like `pdf-parse`, which is what the ATS analysis actually runs on) would silently mangle words like "certification," "specific," "efficient." Fixed by adding `fontenc=T1` + `lmodern`.

**Bug found and fixed — trailing comma in Skills/Certifications.** An empty string entry in the skills/certifications array produced `"C++, React, "` in the compiled output. Fixed with `.filter(Boolean)` before joining. Found by actually executing `buildLatexResume` against edge-case input rather than trusting the code.

**Real structural bug found and fixed — content-losing rebuild.** The user reported that analyzing a PDF, rebuilding it through the Builder, and re-analyzing showed a *lower* ATS score. Root-caused via direct comparison: `parseResumeStructure`'s schema had **no field for section order, skill categories, project links, or experience location** — that information was destroyed the moment a resume was parsed, before ever reaching the Builder or Overleaf. Fixed by:
- Adding `sectionOrder` to the schema (AI reports the original's actual top-to-bottom order; `buildLatexResume` honors it, falling back to a sane default for any section missing from a stale/partial list).
- Changing `skills` from flat `[String]` to `[{category, items}]` so grouped skills ("Languages/Frameworks/Tools") survive.
- Adding `link` to project extraction and `location` to experience entries.
- Backward-compatibility handled via `normalizeSkillGroups` (detects flat-vs-grouped shape at read time) and a `Mixed` Mongoose type for `skills` (so old documents don't fail to load).
- A **🔄 Re-parse** button added, since already-cached parses wouldn't automatically pick up the new schema fields without an explicit re-run (and re-running costs AI quota, so it's opt-in, not automatic).

**Bug found and fixed — UI scroll/layout.** The preview pane was fixed at 794px width inside a `overflow-x-auto` container within a `sticky` column — on any column narrower than 794px (the common case) this forced a horizontal scrollbar, and per CSS spec, setting only `overflow-x: auto` implicitly computes `overflow-y: auto` too, creating an unintended nested scroll region. Fixed with a `ScaledPreview` component (`ResizeObserver` + CSS `transform: scale()`) — later removed entirely (see Phase 6b, "Overleaf-only").

**Phase 6b — "Overleaf-only."** The user decided the Builder should have exactly one export method, not two competing ones. Removed the entire visual HTML/React template system (`ModernTemplate`/`ClassicTemplate`/`MinimalTemplate`, `ScaledPreview`, print CSS, the `setTemplate` API endpoint) — deleted, not deprecated. The Builder became a single-column editor with Save + Open-in-Overleaf as the only actions.

**Phase 6c — Certification upload.** Multimodal certificate reading (image/PDF → structured `{name, issuer, date, displayText}`) added via a new multer middleware and `generateStructuredJSONFromParts` (Gemini's `Part.inlineData` API), wired into the Certifications section of the Builder.

**Phase 6d — Recommendations bridge.** "Fix These in the Builder" button added to the Analyze page; the Builder began pulling and displaying the latest analysis's weaknesses/improvements alongside the editable fields, with jump-to-section and one-click-apply-to-Summary actions.

**Phase 6e — Real named templates.** The user clarified they wanted the Overleaf export to offer genuinely well-known, real resume templates (not generic in-house names), with a recommendation based on the original resume's structure. Rebuilt around three real templates — **Jake's Resume** (the most widely-used minimal SWE template), **Awesome-CV** (single-column variant), **ModernCV Classic** (using LaTeX's actual `moderncv` package, a structurally different class with its own macros) — plus a deterministic `templateRecommender.js` heuristic.

**Bug found and fixed — template recommender false positive.** The recommender initially reused the parseability checker's short-line-ratio signal to detect multi-column layouts; testing against a synthetic clean single-column resume showed it false-positived (short lines are extremely common in normal, sparse resumes — section headers, one-line entries). Re-verified against the user's actual real resume text after the fix. Fixed by relying only on the more specific "wide mid-line gap" signal.

**Bug found and fixed — Mongoose full-document validation.** After the second template-enum rename (`modern/classic/minimal` → `classic/modern/compact` → `jakes/awesomecv/moderncv`), a resume saved under an older enum value crashed `parseResume` with a `ValidationError` on save — even when the save wasn't touching the `template` field — because Mongoose validates the **entire document** on every `.save()`, not just modified paths. Fixed with a `normalizeTemplate()` helper applied before every save in `resumeBuilderController.js`, correcting any unrecognized legacy value back to a valid default rather than trying to enumerate every string that ever existed.

**Deliberately never offered:** a multi-column/sidebar template (e.g., mimicking Deedy Resume). This is a permanent design constraint, not an oversight — see Phase 7.

## Phase 7 — Realism / ATS-Accuracy Pass

Triggered by the user asking how real-world ATS/resume-analysis actually works, and pushing on whether this project was "AI-generated slop" or genuinely useful.

- **Rubric-based ATS scoring.** `analyzeResume` was changed from one holistic 0-100 judgment to five independent 0-20 sub-scores, summed **in code** (not trusted to the LLM's own arithmetic) — a direct fix for an observed real bug: the same resume scoring 68/70/72 across repeated runs. Combined with lowering `temperature` from 0.3 to 0.1 on both `analyzeResume` and `matchJob`.
- **Parseability Checker** added — a deterministic, zero-AI-cost heuristic (see LLD §3.3) that catches the class of risk an AI content-judgment call structurally cannot see: multi-column layout signatures, encoding artifacts, missing sections, missing contact info. This is the piece that makes the "no multi-column templates, ever" constraint evidence-based rather than arbitrary — it directly caught the same failure pattern the earlier ModernTemplate/LaTeX-ligature bugs represented.
- The old undifferentiated "ATS Score" label was split into three honestly-labeled signals: **Resume Quality** (AI, generic), **Parseability** (deterministic, structural), **Job Match** (AI, job-specific).

## Phase 8 — Resume Deletion

`DELETE /api/resume/:id` added with cascading cleanup — deleting a resume also deletes its associated Analysis, ProjectInterrogation, and InterviewSession records, so nothing stale is left referencing a resume that no longer exists.

## Phase 9 — Cross-Feature Interconnection

A deep audit (`docs/Feature_Interconnection_Analysis.md`) found the platform's eight features were largely disconnected — six standalone tools sharing a login, not one guided pipeline. Concretely fixed:

1. **Readiness composite bug** — the score averaged Analysis + Job Match + Mock Interview but silently **excluded Project Interrogator's depth score entirely**, meaning a candidate could show a high readiness score while every project interrogation showed nothing but vague, undefended claims. Fixed by adding it as a fourth aggregated component.
2. Builder's recommendations panel extended to also surface Project Interrogator's `weakClaims` (not just generic Analyze feedback).
3. Job Match's job description now carries forward automatically into Mock Interview's setup (visibly marked "reused," editable) instead of being re-pasted from scratch.
4. Mock Interview question generation now pulls known weak areas from Analyze, Job Match, and Project Interrogator before generating questions, biasing at least half the set toward them (`buildWeakAreasHint`, see LLD §3.6).
5. Weak projects (low `depthScore`) can be explicitly targeted by name in Mock Interview's setup ("Focus on this project").
6. Job Match results got their own "Tailor for This Job in the Builder" bridge (mirroring Analyze's), and the Builder now surfaces Job Match's missing-skills/gaps as a distinct, job-specific recommendation section alongside the generic Analyze ones.

## Phase 10 — Job Description Upload

`POST /api/job/extract` added — reuses the same `pdf-parse` pipeline as resume upload (no AI call, free, instant) to let a JD be uploaded as a PDF instead of pasted, on both the Job Match and Mock Interview pages.

## Phase 11 — Fresher-Calibrated Interrogation

The user pointed out placements are for college freshers, not senior engineers, and asked the Project Interrogator to (a) calibrate its expectations accordingly and (b) ensure follow-up questions genuinely build on what the candidate just said rather than generic vague-claim-hunting. Both the live-questioning system instruction and the end-of-session grading instruction were rewritten to explicitly frame the candidate as a fresher and require each question to reference a specific claim from the previous answer.

## Phase 12 — Groq Fallback (AI Resilience)

Triggered by a direct conversation about the quota constraint being an existential risk for a placement-critical tool. A second, independent free-tier provider (Groq, OpenAI-compatible REST API) was added as an automatic fallback: if Gemini fails for any reason, the identical request is retried against Groq before an error surfaces to the user. Scoped deliberately to the core `generateStructuredJSON` primitive (covering most features); multimodal certificate reading and the live interrogation chat remain Gemini-only by explicit scope decision.

*(Note: a later request to build automated rotation across 10 separately-created Gemini API keys, to circumvent the per-account quota, was declined — see HLD §9 / project ethics note. The Groq fallback above is the legitimate resilience mechanism that shipped instead.)*

## Phase 13 — UI/UX Redesign

The user flagged the UI as looking generically "AI-generated." A concrete, evidence-based audit of the theme file confirmed the diagnosis: indigo/purple-to-teal gradient, near-black background, Inter-only typography, heavy glassmorphism, emoji-as-icons throughout — essentially the full checklist of common AI-generated-design tells.

Delivered (direction chosen: "serious/professional," fitting a tool used to prep for real corporate placements):
- New **"Ledger" palette** — cool graphite background, muted steel-teal primary, warm bronze secondary, desaturated semantic colors. Zero purple, zero neon-bright teal.
- **Typography pairing** — Newsreader (serif) for all headings, Inter kept for body text.
- **Icon system** — `lucide-react` installed, ~50 emoji-as-icon instances replaced across 10 files with real SVG icons.
- **Toned-down glassmorphism** — reduced blur/opacity/corner-radius across `.glass-card`/`.stat-card`.
- A stray inconsistency (Navbar using raw Tailwind `slate` colors instead of the app's own theme tokens) was found and fixed in the same pass.

## Phase 14 — Version Control

The project was committed (55 files, ~5,100 insertions) to the `Task01` branch and pushed toward the `Abhishek007-t/resume-optimizer` GitHub repository's `master` branch. First push attempt failed with a `403` (the configured local git credentials — `SujanAmin-247` — lack write access to that repo); resolution is pending a collaborator-access or credential change on the user's end.
