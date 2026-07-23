# API Reference

Base URL: `http://localhost:5000/api` (dev) — configured via `VITE_API_URL` on the frontend.

**Auth:** every endpoint except `POST /auth/signup` and `POST /auth/login` requires
`Authorization: Bearer <JWT>`. Tokens are issued by `POST /auth/login`, expire after 7 days, and are verified by `middleware/auth.js`, which attaches `req.user = { id, email }`.

**Response envelope:** every endpoint returns `{ success: boolean, ... }`. Errors return `{ success: false, message: string, error?: string }` with an appropriate 4xx/5xx status.

---

## Auth — `/api/auth`

### `POST /signup`
No auth required.
```json
// Request
{ "name": "string", "email": "string", "password": "string (min 6 chars)" }
// 201 Response
{ "success": true, "message": "User registered successfully", "user": { "id", "name", "email" } }
```

### `POST /login`
No auth required.
```json
// Request
{ "email": "string", "password": "string" }
// 200 Response
{ "success": true, "message": "Login Successful", "token": "<JWT>", "user": { "id", "name", "email" } }
```

### `GET /profile`
Auth required.
```json
// 200 Response
{ "success": true, "user": { /* full User doc minus password */ } }
```

---

## Resumes — `/api/resume`

### `GET /`
List the current user's resumes, newest first.
```json
{ "success": true, "count": number, "resumes": [ /* Resume docs */ ] }
```

### `GET /:id`
Single resume (ownership-checked).
```json
{ "success": true, "resume": { /* Resume doc */ } }
```

### `POST /upload`
`multipart/form-data`, field name `resume` (PDF only, 5MB max).
```json
{ "success": true, "message": "Resume uploaded successfully", "preview": "first 200 chars", "resume": { /* Resume doc */ } }
```

### `DELETE /:id`
Deletes the resume file, the Resume document, and **cascades**: also deletes all `Analysis`, `ProjectInterrogation`, and `InterviewSession` documents referencing it.
```json
{ "success": true, "message": "Resume deleted successfully" }
```

---

## Resume Analysis — `/api/ai`

### `POST /analyze`
```json
// Request
{ "resumeId": "string" }
// 200 Response
{
  "success": true,
  "analysis": {
    "atsScore": 0-100,            // sum of scoreBreakdown, computed server-side
    "scoreBreakdown": { "keywordRelevance", "quantifiedImpact", "formattingConsistency", "sectionCompleteness", "clarity" }, // each 0-20
    "parseability": { "score": 0-100, "issues": [{ "type", "severity", "message" }] }, // deterministic, no AI
    "strengths": ["string"],
    "weaknesses": [{ "issue", "impact", "severity": "High|Medium|Low" }],
    "improvements": [{ "section", "suggestion", "example" }],
    "rawAnalysis": { /* full LLM response, includes missingKeywords, formatting, overallFeedback, atsReasoning */ }
  }
}
```

---

## Job Match — `/api/job`

### `POST /match`
```json
// Request
{ "resumeId": "string", "jobDescription": "string" }
// 200 Response
{
  "success": true,
  "result": {
    "atsScore": 0-100,   // = matchPercentage
    "jobDescription": "string",
    "strengths": ["string"],
    "weaknesses": [{ "gap", "severity", "impact" }],
    "improvements": ["string"],
    "rawAnalysis": {
      "matchPercentage", "matchReasoning",
      "matchedSkills": [{ "skill", "importance", "proficiency" }],
      "missingSkills": [{ "skill", "importance", "canBeLearned", "alternative" }],
      "recommendation": "Strong Fit|Potential Fit|Not Recommended",
      "finalVerdict"
    }
  }
}
```

### `POST /extract`
`multipart/form-data`, field name `jobDescriptionFile` (PDF only, 5MB max). No AI call — pure `pdf-parse` extraction.
```json
{ "success": true, "jobDescription": "extracted text" }
```

---

## Analysis History / Dashboard — `/api/analysis`

### `GET /stats`
```json
{ "success": true, "data": { "totalResumes", "totalAnalyses", "averageScore", "latestAnalysis" } }
```

### `GET /`
Last 20 Analysis docs (both types), newest first, `resumeId` populated with `{originalName, fileName}`.
```json
{ "success": true, "data": [ /* Analysis docs */ ] }
```

### `GET /:id`
```json
{ "success": true, "data": { /* single Analysis doc */ } }
```

### `DELETE /:id`
```json
{ "success": true, "message": "Analysis deleted successfully" }
```

---

## Project Interrogator — `/api/projects`

### `POST /extract`
Extracts (or returns cached) projects from a resume's text.
```json
// Request
{ "resumeId": "string" }
// 200 Response
{ "success": true, "projects": [{ "title", "link", "description", "techStack": ["string"] }], "cached": boolean }
```

### `GET /interrogate`
List the user's interrogation sessions.
```json
{ "success": true, "interrogations": [{ "_id", "resumeId", "projectTitle", "status", "depthScore", "weakClaims", "createdAt" }] }
```

### `POST /interrogate/start`
```json
// Request
{ "resumeId": "string", "projectTitle": "string" }  // project must already be in resume.parsedProjects
// 201 Response
{ "success": true, "interrogation": { /* ProjectInterrogation doc, conversation has 2 turns: hidden kickoff + first question */ } }
```

### `GET /interrogate/:id`
```json
{ "success": true, "interrogation": { /* full ProjectInterrogation doc */ } }
```

### `POST /interrogate/:id/reply`
```json
// Request
{ "message": "candidate's answer" }
// 200 Response
{ "success": true, "interrogation": { /* updated doc, conversation grows by 2 turns */ } }
```

### `POST /interrogate/:id/finish`
Grades the session — sets `depthScore`, `weakClaims`, `strongMoments`, `summary`, `status: "completed"`.
```json
{ "success": true, "interrogation": { /* completed doc */ } }
```

---

## Resume Builder — `/api/builder`

### `POST /parse`
```json
// Request
{ "resumeId": "string", "force": false }  // force=true re-runs AI extraction even if cached
// 200 Response
{
  "success": true,
  "structuredResume": { /* see Resume model, structuredResume.* */ },
  "projects": [{ "title", "link", "description", "techStack" }],
  "templateRecommendation": { "template": "jakes|awesomecv|moderncv", "reason": "string" }  // deterministic, no AI
}
```

### `PUT /:id`
Save edits made in the Builder.
```json
// Request
{ "structuredResume": { /* partial or full */ }, "projects": [ /* optional */ ] }
// 200 Response
{ "success": true, "structuredResume": { ... }, "projects": [ ... ] }
```

### `POST /:id/improve`
AI rewrite suggestion for a single field (summary, a bullet, a project description).
```json
// Request
{ "fieldLabel": "e.g. 'experience bullet point'", "currentText": "string", "contextHint": "optional string" }
// 200 Response
{ "success": true, "suggestion": { "improved": "string", "whatChanged": "one sentence" } }
```

### `POST /:id/certifications/upload`
`multipart/form-data`, field name `certificate` (PDF or image, 5MB max). Multimodal — reads the actual certificate content.
```json
{ "success": true, "certification": { "name", "issuer", "date", "displayText": "resume-ready one-liner" } }
```

---

## Mock Interview — `/api/interview`

### `GET /`
```json
{ "success": true, "sessions": [{ "_id", "roundType", "status", "overallScore", "createdAt" }] }
```

### `POST /start`
```json
// Request
{ "resumeId": "string", "jobDescription": "optional string", "roundType": "HR|Technical|Behavioral", "focusProjectTitle": "optional string" }
// 201 Response
{ "success": true, "session": { /* InterviewSession, 6 questions, none answered yet */ } }
```
Questions are generated with a server-computed hint biasing toward the candidate's known weak areas (latest Analyze weaknesses, latest Job Match missing skills, Project Interrogator weak claims — optionally scoped to `focusProjectTitle`). See LLD.md §3.6.

### `GET /:id`
```json
{ "success": true, "session": { /* full InterviewSession doc */ } }
```

### `POST /:id/answer`
```json
// Request
{ "questionIndex": 0, "answer": "string" }
// 200 Response
{ "success": true, "question": { /* scored question */ }, "session": { /* updated doc */ } }
```

### `POST /:id/finish`
Requires at least one answered question. Grades the whole session.
```json
{ "success": true, "session": { "status": "completed", "overallScore", "weakestArea", "summary", "questions": [...] } }
```

---

## Placement Readiness — `/api/readiness`

### `GET /`
```json
{
  "success": true,
  "compositeScore": 0-100,       // null if no activity yet
  "percentile": 0-100,           // null if no activity yet; noisy at low user counts
  "breakdown": { "atsAvg", "matchAvg", "interviewAvg", "projectAvg" },  // each null or 0-100
  "sampleSize": { "analyses", "jobMatches", "interviews", "projectInterrogations" },
  "trend": [{ "date", "type": "analysis|job-match|interview|project-defense", "score" }],
  "narrative": "AI-written 2-3 sentence insight, or null"
}
```

---

## File Upload Constraints (all upload endpoints)

| Endpoint | Field name | Accepted types | Max size |
|---|---|---|---|
| `POST /resume/upload` | `resume` | `application/pdf` | 5MB |
| `POST /job/extract` | `jobDescriptionFile` | `application/pdf` | 5MB |
| `POST /builder/:id/certifications/upload` | `certificate` | `application/pdf`, `image/png`, `image/jpeg` | 5MB |

All uploaded files are deleted from disk (`fs.unlink`) immediately after processing, in both success and error paths — nothing is retained beyond the request lifecycle.
