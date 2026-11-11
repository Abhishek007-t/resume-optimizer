# Feature Interconnection Analysis

Deep-dive requested: are the platform's features actually connected into one interview-prep pipeline, or are they six separate tools that happen to share a login? This is an analysis only — nothing here is implemented. Each recommendation ends with a clear ask.

## 1. What's actually disconnected today (verified against the real code, not assumed)

| # | Gap | Evidence | Why it matters |
|---|-----|----------|-----------------|
| 1 | **Job description is asked for twice, remembered by nothing.** Job Match takes a JD, scores it, and saves it on the `Analysis` document (`jobDescription` field) — then never looks at it again. Mock Interview has its *own* separate `jobDescription` input; it does not read the JD you already pasted into Job Match. | `jobController.js:7` vs `interviewController.js:9` — two independent, unconnected inputs for the same piece of data. | This is the exact example you gave. You paste the same JD twice, and neither the Builder nor the Mock Interview tailor themselves to "this specific job" — they only know "this resume, in general." |
| 2 | **Readiness score silently ignores Project Interrogator entirely.** The composite score averages Analyze + Job Match + Mock Interview. `ProjectInterrogation.depthScore` — the one metric that measures "can this person actually defend what they built" — isn't in the aggregation at all. | `readinessController.js:11-43` — `buildPlatformComposites` and `getReadiness` only ever query `Analysis` and `InterviewSession`, never `ProjectInterrogation`. | This is the metric that matters most for your stated concern (vibe-coded projects the candidate can't explain), and it's the one thing the "readiness" number doesn't measure. Someone could have a 90% composite score while every project interrogation shows nothing but vague, undefended claims. |
| 3 | **Mock Interview questions are generated blind to known weaknesses.** `generateInterviewQuestions` gets the resume text, an optional JD, and a round type — nothing about what Analyze already flagged as weak, what Job Match already flagged as a missing skill, or what Project Interrogator already flagged as a shaky claim. | `interviewController.js:34-38` | A real interview coach drills the parts you're already known to be weak at. Right now, Mock Interview re-rolls generic questions every time, with no memory of your prior sessions on the same resume. |
| 4 | **Resume Builder's recommendations only see one data source.** `RecommendationsPanel` pulls the *latest* `Analysis` of type `analysis` — it never looks at Job Match's `missingSkills` (role-specific gaps) or Project Interrogator's `weakClaims` (specific projects whose bullets overstate what was actually defended). | `ResumeBuilder.jsx` `handleLoad` → `getAnalysisHistory().find(a => a.type === "analysis" ...)` | If you ran Job Match against a specific company's JD and it flagged "missing: Docker experience," the Builder never surfaces that — only generic Analyze feedback shows up. |
| 5 | **Project Interrogator and Mock Interview never talk.** A project that scored low on `depthScore` (candidate couldn't defend it under questioning) isn't flagged anywhere in Mock Interview, and Mock Interview can't be told "specifically grill me on Project X." | Cross-referenced `ProjectInterrogation.js` model vs `interviewController.js` — no shared query between them. | The exact "vibe coder can't explain their project" scenario you described is diagnosed by Project Interrogator but never acted on anywhere else in the app. |
| 6 | **Every page selects a resume independently, with no shared "what am I working toward" context.** Six separate `<select>` dropdowns across Analyze/Job Match/Builder/Interrogator/Mock Interview/Readiness, each just picking a resume ID. There's no concept of "I'm prepping for this specific role" that persists across features. | Consistent pattern across all six page components. | The app behaves like six standalone tools sharing a database, not one guided prep flow. |

## 2. Why this matters for the goal you described

You want this to function like a real interview-prep coach: notice a candidate is weak somewhere, and actually act on it elsewhere in the platform — especially for someone who AI-assisted their way through a project and needs to actually understand it well enough to defend it out loud. Right now the one feature that measures that specific risk (Project Interrogator) is a dead end: it produces a real signal (`depthScore`, `weakClaims`) that nothing downstream — not Readiness, not Mock Interview, not the Builder — ever reads again.

## 3. Recommended interconnections, ranked by value vs. effort

### Tier 1 — small, correctness-level fixes (should probably happen regardless)

**3.1 Add Project Interrogator to the Readiness composite.**
Include `ProjectInterrogation.depthScore` as a fourth averaged component in `buildPlatformComposites`/`getReadiness`, same pattern as the existing three. This isn't a new feature, it's fixing a score that currently claims to represent overall readiness while omitting a whole signal it already has.
*Effort: small (one more aggregate query, same shape as the existing three). Risk: low.*

**3.2 Surface Project Interrogator's weak claims in the Builder's recommendations panel.**
If a project has `weakClaims`, show them alongside the Analyze weaknesses already displayed there, with a prompt like "this project's bullet overstates what held up under questioning — consider rewriting it more precisely." Reuses the exact panel/pattern already built.
*Effort: small. Risk: low.*

### Tier 2 — the specific gap you called out (job description continuity)

**3.3 Let a Job Match's JD carry forward.**
When a resume has a recent Job Match, offer to pre-fill that JD into Mock Interview's setup form (and optionally the Builder's context) instead of asking for it a third time. Doesn't need a big new data model — just query the latest `Analysis` of type `job-match` for that resume and offer to reuse its `jobDescription`.
*Effort: small-medium. Risk: low — purely additive, doesn't change existing behavior if declined.*

### Tier 3 — the feedback loop (weak areas actually get drilled)

**3.4 Feed known weak areas into Mock Interview question generation.**
Before generating questions, pull: latest Analyze `weaknesses`/`missingKeywords`, latest Job Match `missingSkills` (if a JD is active), and any `weakClaims` from Project Interrogator sessions on this resume. Pass a compact summary of these into `generateInterviewQuestions` as a "known weak areas — bias questions toward probing these" hint.
*Effort: medium (prompt + one extra data-gathering step, no new schema). Risk: low, degrades gracefully if there's no prior data (first-time users get the current generic behavior).*

**3.5 Let Mock Interview target a specific weak project by name.**
If a project has a low `depthScore`, offer "drill me on [Project X]" as an explicit Mock Interview option, feeding that project's `weakClaims` into the technical round's question generation.
*Effort: medium. Depends on 3.4's plumbing.*

### Tier 4 — bigger structural change (worth naming, not recommending yet)

**3.6 A persistent "target role" concept per resume.**
Instead of every feature independently asking "which resume?", introduce a lightweight notion of "I'm currently prepping this resume for this job" that Job Match, Builder, Mock Interview, and Readiness all read from and write to — so pasting a JD once actually changes the shape of everything downstream, not just one score.
*Effort: large — new model or a meaningful extension of `Resume`, changes to nearly every controller and page. This is the "real" fix to your example, but it's a genuine architecture change, not a small patch. I'd only take this on if 3.3 (the lightweight version) turns out to feel insufficient once you're using it.*

## 4. What I'm not recommending right now

A full rewrite into a single "Application" entity that owns resume + JD + all downstream artifacts. It's the conceptually cleanest fix, but it's a rewrite, not an enhancement, and Tier 1-3 above capture most of the real value (score correctness, weak-area feedback loop, JD continuity) without that risk. Worth revisiting only if the lighter version proves limiting in practice.

## 5. What I need from you

Tell me which tiers to proceed with — they're independent, so you can pick any subset (e.g. "just 3.1 and 3.2" or "everything through Tier 3"). I'd suggest at minimum 3.1 (it's arguably a bug, not a feature), but it's your call.
