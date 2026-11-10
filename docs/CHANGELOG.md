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

The project was committed (55 files, ~5,100 insertions) to the `Task01` branch and pushed toward the `Abhishek007-t/resume-optimizer` GitHub repository's `master` branch. First push attempt failed with a `403` (the configured local git credentials — `SujanAmin-247` — lack write access to that repo). Resolved once the repo owner (`Abhishek007-t`) added `SujanAmin-247` as a collaborator; the identical `git push origin Task01:master` command then succeeded.

## Phase 15 — Enterprise Documentation

The user requested a full set of enterprise-level engineering documents: HLD (system context, architecture style, subsystems, tech stack, cross-feature data flow, security model, AI reliability strategy, known limitations), LLD (schemas, module maps, key algorithms, `geminiService` reference, sequence diagrams), a phase-by-phase CHANGELOG (this document — including real bugs, not smoothed over), a SETUP guide (env vars, gotchas, verification steps), and a full API reference. All five were written in `docs/` and verified against the actual running code rather than written from memory, then kept current as later phases (16-18 below) shipped.

## Phase 16 — Interview/Interaction UX Polish

Three usability issues reported together in one message: mic input unreliable across machines, interview questions feeling scripted/non-adaptive, and no drag-and-drop for uploads.

- **Mic diagnostics.** `useSpeechToText` previously surfaced no information when recognition failed. Added an `ERROR_MESSAGES` map for the Web Speech API's real error codes (`not-allowed`, `audio-capture`, `service-not-allowed`, `network`, `no-speech`) plus an `onError` callback wired into `MockInterview.jsx`/`ProjectInterrogator.jsx` as a toast, so a failure on a different machine (no mic permission, no device, unsupported browser) now tells the candidate exactly what's wrong instead of silently doing nothing. `MicButton` on an unsupported browser now renders a disabled button with an explanatory tooltip instead of returning `null` (previously indistinguishable from "broken").
- **Adaptive follow-up questions.** Rather than a second AI call, the existing answer-scoring call was extended: `ANSWER_SCORE_SCHEMA` gained an optional `followUpQuestion` field, and the scoring system instruction now asks the model to decide, as part of the same structured response, whether the candidate's answer warrants a natural follow-up referencing what they specifically said — the same "vague claim, real interviewer would push back" pattern already used in Project Interrogator. `interviewController.submitAnswer` splices a returned follow-up into the live question list immediately after the current question, capped at `MAX_QUESTIONS = 10` so a chain of follow-ups can't run away. Zero additional AI quota cost.
- **Drag-and-drop uploads.** Added to the JD upload zones on Mock Interview and Job Match, and to the Certifications upload card in the Resume Builder — each got local `dragOver` state and `onDragOver`/`onDragLeave`/`onDrop` handlers reusing the existing file-handling logic (refactored into a shared `handleJdFile(file)` on Job Match so drop and manual `<input>` selection share one code path).

## Phase 17 — Forgot Password

The login form had no password-recovery path. Chose Gmail SMTP (via `nodemailer`) over a third-party transactional email API, since the user already has a Gmail account and no existing email-provider relationship to leverage.

- `User` gained `resetPasswordToken`/`resetPasswordExpires`, both `select: false` so a normal `findOne` never returns them. Only the SHA-256 **hash** of the reset token is stored — the raw token exists only in the emailed link and the request that generated it.
- `POST /api/auth/forgot-password` always returns the same generic success message whether or not the email exists, to prevent account enumeration; `POST /api/auth/reset-password` validates the hashed token against a 1-hour expiry before allowing a password change.
- New `services/emailService.js`: if `EMAIL_USER`/`EMAIL_APP_PASSWORD` aren't set, it logs the reset link to the console instead of failing — keeps local dev unblocked without requiring every developer to have Gmail credentials configured.
- New pages `ForgotPassword.jsx`/`ResetPassword.jsx`, a "Forgot Password?" link added to `Login.jsx`. In the same pass, a leftover pre-redesign purple gradient background (`from-bg-dark via-slate-900 to-purple-950/30`, inconsistent with the Phase 13 "Ledger" palette) was found and fixed on `Login.jsx`, `Register.jsx`, and `NotFound.jsx`.

**Bug found and fixed — App Password pasted with spaces.** After configuring `.env`, no reset email arrived. Root cause: Google's UI displays a 16-character Gmail App Password in four space-separated groups for readability (`vbqr ajxd wxtz yqti`), but the literal credential is the 16 characters concatenated with no spaces — the pasted value with spaces silently failed SMTP auth. Fixed by stripping the spaces; verified in two stages — a standalone `nodemailer.createTransport(...).verify()` call succeeded, then a real end-to-end send through the actual `emailService.js` code path succeeded and was received.

**Not a bug — cross-device `localhost` confusion.** After the email fix, the user reported "site can't be reached" clicking the reset link. Confirmed this was expected: the link (`http://localhost:5173/...`) was opened on a phone, not the machine running the Vite dev server — `localhost` is inherently machine-scoped. This resolves automatically once `FRONTEND_URL` is a real deployed domain in production, with one caveat documented in SETUP.md: the code's fallback (`process.env.FRONTEND_URL || "http://localhost:5173"`) will silently reproduce the identical failure if `FRONTEND_URL` is left unset on the deployment host.

## Phase 18 — Pre-Deployment Security & Scalability Audit

Triggered directly by the user: "before deploying this project i want to know is this deployment ready... one thing i noticed by changing url i was able go to other pages... make it suitable to be deployed." A real, exploitable bug was found alongside the broader hardening pass:

- **Client-side auth bypass (real bug, found and fixed).** `AuthContext` seeded `user` state from `localStorage` on mount for optimistic UI. Its token-validation effect had an early-return path (no token present) that failed to clear that stale `user` state, so `isAuthenticated: !!user` stayed `true` off a leftover local blob alone, with no server-side check involved — explaining exactly what the user observed (navigating directly by URL rendered protected pages instead of redirecting to Login). Fixed by clearing state (`clearAuth()`, `setUser(null)`) in that branch, and by hardening `isAuthenticated` to require both `user` *and* a live token as defense-in-depth. Confirmed this never exposed real data: every API call still required a valid JWT verified server-side in `middleware/auth.js`, so the bug could only render an empty/broken page shell before the first API call 401'd — a real UX/routing bug, not a data breach.
- **NoSQL injection.** Sending `{"email": {"$gt": ""}}` as a JSON body value (instead of a string) lets MongoDB interpret it as a query operator rather than a literal to match. `express-mongo-sanitize` was tried first and found **incompatible with Express 5** — reproduced with a minimal test Express app: it throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter` on any request with a query string, because it tries to reassign `req.query`, which Express 5 exposes as a getter-only property. Replaced with a hand-rolled `middleware/sanitize.js` scoped to `req.body` only, verified directly: the attack payload was neutralized, legitimate nested Builder-style payloads were preserved untouched, and query-string requests no longer crashed.
- **Rate limiting** (`express-rate-limit`) added: 10 req/15min on auth endpoints (login/signup/forgot-password — brute-force and inbox-bombing targets), 300 req/15min baseline across the rest of the API.
- **Input validation** (`express-validator`) added for signup/login/forgot-password/reset-password — real email-format and password-length checks, not presence-only checks.
- **Error-message leakage closed.** All 19 occurrences of `error: error.message` across 6 controllers changed to `error: process.env.NODE_ENV === "production" ? undefined : error.message` — production responses no longer echo raw internal error text, while `console.error` still logs full detail server-side.
- **CORS restricted** to `FRONTEND_URL` only when `NODE_ENV === "production"`, permissive otherwise — noted this only takes effect if `NODE_ENV` is actually set on the deployment host.
- **Weak `JWT_SECRET` replaced** with a freshly generated 128-character random value (`crypto.randomBytes(64).toString('hex')`) — the placeholder in use during development was weak enough to forge tokens with.
- Clarified for the user (not a code change): client-side route guards are a UX convenience, not a security boundary — the real enforcement is server-side JWT verification on every protected endpoint, which is why "switching pages via URL" was a real but non-data-exposing bug.

## Phase 19 — Resume Analysis Score Stability

The user reported the Analysis feature scoring the same resume differently on consecutive runs (58, then 63 after a refresh) and explicitly rejected an initial partial fix (removing `sectionCompleteness` from the LLM's rubric, `temperature` lowered to 0) as insufficient — "no still fluctuating... this time i want it to be correct."

- **Root cause explained plainly:** hosted LLM APIs do not guarantee identical output for identical input even at `temperature: 0` — floating-point non-associativity under batched/distributed inference is inherent to the technology, not a fixable prompting issue. Continuing to tune the prompt could not have closed this gap.
- **Definitive fix: content-hash caching.** `Analysis` gained `contentHash = sha256(extractedText + '|' + SCORING_VERSION)`. `POST /api/ai/analyze` now checks for an existing cached result under the same hash before calling the AI at all, returning it as-is (`cached: true`) unless the caller passes `force: true`. `SCORING_VERSION` is folded into the hash specifically so a future rubric change correctly invalidates old cached scores rather than serving stale-methodology results. Verified end-to-end against the real server and database: two identical `POST /api/ai/analyze` calls on the same resume returned the same `Analysis._id` and the same `atsScore` (47) both times, with the second call ~5x faster (0.74s vs 3.8s) — proof no second AI call occurred.
- `sectionCompleteness` was fully removed from the LLM's rubric and made 100% deterministic (`scoreSectionCompleteness` in `parseabilityChecker.js`, regex-based), narrowing the LLM's judgment to four dimensions and eliminating one whole axis of possible drift even before caching is considered. See LLD §3.5.

**Incident — accidental deletion of all `Analysis` documents.** While cleaning up disposable test data created to verify the caching fix, a cleanup script used an overly broad Mongoose filter (`{ rawAnalysis: { $exists: true }, resumeId: { $exists: true } }`) — both fields are `required: true` on every `Analysis` document, so the filter matched and deleted **every** Analysis record in the database, not just the test one, wiping Resume Quality and Job Match history for all real user accounts. Discovered immediately (self-verified via `Analysis.countDocuments({}) === 0` right after running the script) and disclosed to the user in full without minimizing. All other collections were confirmed unaffected (Users, Resumes, ProjectInterrogations, InterviewSessions all intact). MongoDB Atlas's free tier (M0) has no point-in-time backup/restore, so the records themselves are not recoverable — but since the underlying Resume documents were untouched, Analysis/Job Match history simply regenerates the next time a user re-runs those features (now benefiting from the caching fix above). See HLD §9 for the standing lesson this left about destructive Mongo operations on this database.

## Phase 20 — Project Interrogator: Fresher-Level Difficulty & Topic Rotation

**Trigger:** hands-on testing as a fresher showed two problems. Questions were too hard (production-level topics such as route timeouts and exact API error fields, often built on a wrong premise from the previous answer), and the panelist kept drilling into one concept for many turns instead of covering the project. Root cause: the system instruction required every question to build on the candidate's last answer and never told the model to change topic.

**Delivered:**
- Topic rotation is now enforced by the server, not left to the model. `backend/services/interrogationGuide.js` (no AI imports, so it is unit-testable) defines 6 topics (big picture, own role, a tech choice, how a main feature works, a bug they fixed, testing/next steps). Each gets one opening question plus at most one simple follow-up (`QUESTIONS_PER_TOPIC = 2`), after which the next topic starts. After all 12 questions the panelist stops and points the candidate to "End & Grade".
- The current step (`buildInterviewerGuide`) is computed from the number of questions already asked and placed in the **system instruction**, rebuilt per request. The stored transcript only ever contains the candidate's plain answers and the panelist's replies.
- System instruction rewritten for freshers: simple English, no trick premises or chained "what if" scenarios, no production-level concerns unless the candidate raised them. Every reply is an honest one-sentence reaction plus one question: vague answers are named as vague, and "I don't know" gets a "A good answer would mention…" hint instead of more pressure.
- Safety nets in `generatePanelistReply`: bracketed notes are stripped from replies; a mid-interview reply with no question, or one that tries to end the interview, is regenerated once; if that also fails, a ready-made question for the current topic is appended so the interview can never stall.
- Frontend shows "Topic X of 6 · Question N" so the candidate can see the interview will move on.

**Testing (first automated tests in the project):**
- `npm test` (backend): 14 offline unit tests with Node's built-in `node:test` for topic rotation, wrap-up, note stripping, and reply validation. No API calls.
- `npm run test:interrogation-live` (backend): `scripts/simulateInterrogation.js` runs one full session against the real Gemini chat with scripted fresher answers (including a vague answer and an "I don't know"), checks every reply automatically, and prints the transcript. About 13-15 Gemini requests per run.
- Bugs the live runs found and fixed along the way: (1) when the step was appended to the candidate's message, the model wrote its own fake "[Interviewer guide: …]" notes into replies (visible in the UI), followed them instead of the real plan, and ended the interview at question 10; moving the step to the system instruction fixed it. (2) The model said "Good, that's clear." to every answer, including vague ones, by copying the prompt's example phrase. (3) Some replies contained no question. (4) A "Question 12 of 12" counter made the model wrap up one question early, so the counter was removed.
- Known minor behavior: the topic 1 follow-up often drifts to "why Gemini and Groq" and a regenerated reply can revisit an earlier topic. The questions stay fresher-level, so this was left as is.

## Phase 21 — Mock Interview: Fresher-Level Difficulty & Topic Variety

**Trigger:** the same problems found in the Project Interrogator (Phase 20) applied here. A baseline live test with a sample resume and weak-areas hint showed: (1) HR, Behavioral and Technical rounds all opened with the same three questions about the candidate's weak spots (cache hit rate, concurrent duplicate requests, exact Gemini error codes), because the prompt told the model to aim at least half of every round at weak spots; (2) the Technical round asked for latency/throughput numbers and system-design/concurrency questions; (3) follow-ups could be added to follow-ups, so one concept ran three or more questions in a row.

**Delivered:**
- New `backend/services/interviewRules.js` (no AI imports, unit-tested) holding the rules enforced in code:
  - `shouldAddFollowUp`: at most one follow-up per main question (a follow-up is never followed up), none after a non-answer scoring 20 or less (the model was re-asking the same question after "I don't know"), and the existing 10-question cap.
  - `spreadByCategory`: reorders the generated set so no two questions of the same category are next to each other. A run showed two caching questions placed back to back, which with a follow-up each made four caching questions in a row.
  - `usesWeakAreas`: weak spots only steer the Technical round; HR and Behavioral stay on their own subject.
- Question generation prompt rewritten for freshers: no system design, scaling, concurrency, production metrics or exact error codes; every question on a different topic; the Technical round uses a fixed mix (2 project, 2 tech stack, 2 CS fundamentals); HR has no technical questions; Behavioral uses student situations. Weak spots now drive at most 2 of the 6 questions, on different features.
- Answer scoring calibrated to what a well-prepared fresher can say (clear and specific: 75-95; generic: 50-74; vague: 25-49; no real answer: 0-20). Follow-ups must be simple and fresher-level. The session summary also judges at fresher level and ends with one thing to practice next.

**Testing:**
- `npm test` now runs 24 offline unit tests (10 new for the mock interview rules).
- `npm run test:mock-interview-live` (`scripts/simulateMockInterview.js`) generates all three round types, then plays a full Technical round where a simulated fresher gives good, vague and "I don't know" answers, scores each, applies the follow-up rule exactly as the controller does, and summarizes. About 20-25 Gemini requests per run. Final run: PASS, with good answers averaging 87, vague 60 and "I don't know" 15, and no concept running longer than 2 questions.
- Known minor behavior: the generator can still write two questions on the same weak feature (they are now separated and asked from different angles), and Behavioral questions may assume teammates on a solo project.
