# Setup & Installation Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | Backend and frontend both require it |
| npm | bundled with Node | |
| MongoDB Atlas account | free tier is enough | See "MongoDB gotcha" below before creating your cluster connection string |
| Google Gemini API key | free tier | Get one at [Google AI Studio](https://aistudio.google.com/) |
| Groq API key | free tier, optional but recommended | Get one at [console.groq.com](https://console.groq.com) — used as an automatic fallback when Gemini's quota is exhausted |
| Gmail account with an App Password | free | Used to send password-reset emails — see "Email (forgot password)" below |

## 1. Clone and install

```bash
git clone https://github.com/Abhishek007-t/resume-optimizer.git
cd resume-optimizer

cd backend && npm install
cd ../frontend && npm install
```

## 2. Backend environment variables

Create `backend/.env`:

```env
PORT=5000

NODE_ENV=development

MONGODB_URI=<see gotcha below>

JWT_SECRET=<long random string — used to sign JWTs, see gotcha below>

GEMINI_API_KEY=<from Google AI Studio>

GROQ_API_KEY=<from console.groq.com — optional, leave blank to disable the fallback>

EMAIL_USER=<your Gmail address — optional, leave blank to disable password-reset emails (link is logged to console instead)>

EMAIL_APP_PASSWORD=<16-character Gmail App Password, no spaces — see gotcha below>

FRONTEND_URL=http://localhost:5173
```

### JWT_SECRET — do not use a placeholder

Generate a real random value, don't hand-type one:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
A short or guessable `JWT_SECRET` lets anyone forge a valid login token. This must be a unique, real value in production — never reuse a value from development/version control.

### MongoDB connection string — a real gotcha

The standard `mongodb+srv://...` connection string Atlas gives you by default **fails with `querySrv ECONNREFUSED`** on networks whose DNS resolver doesn't support SRV records (confirmed on multiple real networks during this project's development, including a college ISP — this is not rare). If you hit that error:

1. In Atlas, go to your cluster → **Connect** → **Drivers**.
2. Toggle off "SRV Connection String" (or select an older driver version) to get the non-SRV form.
3. Use the resulting connection string, which looks like:
   ```
   mongodb://<user>:<password>@ac-xxxxxxx-shard-00-00.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-01.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-02.xxxxx.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxxxxx-shard-0&authSource=admin&appName=<your-app-name>
   ```
   (explicit shard hostnames + `:27017` ports, instead of one `+srv` host).

### MongoDB Atlas free tier — no backups

The M0 free tier has **no point-in-time backup/restore** (that's a paid-tier feature). This isn't a hypothetical warning — a destructive script during this project's development wiped an entire collection with no way to restore it from Atlas (see CHANGELOG.md Phase 19). Be deliberate with any `deleteMany`/`updateMany` filter against this database, and if you need real backup coverage, that means upgrading off M0.

### Email (forgot password) — Gmail App Password gotcha

`EMAIL_USER`/`EMAIL_APP_PASSWORD` power `services/emailService.js` (Gmail SMTP via `nodemailer`). If left blank, the app doesn't fail — `forgotPassword` just logs the reset link to the server console instead of emailing it, which is fine for local dev.

To enable real sending:
1. Enable **2-Step Verification** on the Gmail account (required before Google will issue App Passwords).
2. Generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Google displays it as 16 characters in four space-separated groups (e.g. `vbqr ajxd wxtz yqti`) for readability — **the real credential has no spaces.** Paste it into `.env` as the concatenated 16 characters (`vbqrajxdwxtzyqti`), not as displayed. A pasted-with-spaces value fails SMTP auth silently (the app logs the send error but nothing here throws — check backend logs if a reset email doesn't arrive).
4. Verify with a throwaway script if unsure:
   ```js
   require("dotenv").config();
   const nodemailer = require("nodemailer");
   nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD } })
     .verify().then(() => console.log("SMTP OK")).catch(console.error);
   ```

### FRONTEND_URL — required in production

`forgotPassword` builds the reset link as `` `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${token}` ``. The fallback means: if you forget to set `FRONTEND_URL` on your production host, reset emails will silently link to `localhost:5173` — which resolves on nobody's machine but a local dev box. Always set `FRONTEND_URL` to the real deployed frontend origin in production.

### GEMINI_API_KEY — quota reality check

The Gemini free tier on a typical account is capped at **20 requests/day per exact model name** — this is much stricter than commonly-cited documentation suggests, and every AI-powered feature in this app shares that budget. If you're testing heavily, expect to hit `429 RESOURCE_EXHAUSTED` within a single day. This is exactly what `GROQ_API_KEY` mitigates — once set, the backend automatically retries against Groq when Gemini fails for any reason (see `backend/services/geminiService.js`).

## 3. Frontend environment variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## 4. Run in development

```bash
# Terminal 1
cd backend
npm run dev        # nodemon server.js, http://localhost:5000

# Terminal 2
cd frontend
npm run dev        # vite dev server, http://localhost:5173 (default)
```

On first backend start, an `uploads/` directory is created automatically if it doesn't exist (used as transient storage for uploaded PDFs/images — files are deleted immediately after processing, nothing is retained long-term).

## 5. Build for production

```bash
cd frontend
npm run build       # outputs to frontend/dist/
```

The backend has no separate build step (`npm start` runs `server.js` directly via Node).

## 6. Verifying your setup

- Backend: `GET http://localhost:5000/` should return `{"success": true, "message": "Resume Optimizer Backend Running 🚀"}`.
- Frontend: visit the Vite dev URL, sign up a test account, and try **Upload Resume** — this exercises the MongoDB connection and file upload path without spending any AI quota.
- To verify the AI path without a full feature flow, run **Analyze** on the uploaded resume once — this is the cheapest way to confirm `GEMINI_API_KEY` (and `GROQ_API_KEY`, if you intentionally exhaust Gemini) actually works end-to-end.

## 7. Linting / sanity checks

There is no automated test suite (`npm test` in `backend/package.json` is a placeholder). The verification pattern used throughout development was:

```bash
# Backend — syntax check any changed file
node --check path/to/file.js

# Frontend — lint and production build
cd frontend
npx eslint src/
npx vite build
```

Both should be run after any change before considering it done.

## 8. Known operational constraints to plan around

- **Gemini free-tier quota** (20 req/day/model) is the single biggest operational risk — see HLD.md §8 for the full mitigation strategy.
- **No LaTeX compiler in this stack.** The Overleaf export is generated client-side and submitted directly to `overleaf.com/docs` — Overleaf compiles it on their servers. There is no way to locally preview or validate the compiled PDF from this codebase; correctness of the generated `.tex` was verified structurally (escaping rules, brace balancing) rather than by actually compiling it.
- **Multiple Gemini API keys to bypass the per-account quota is explicitly out of scope** for this codebase — see CHANGELOG.md Phase 12 note. If you need more headroom, get a `GROQ_API_KEY` instead.

## 9. Before deploying: set `NODE_ENV=production`

Several security hardening measures in HLD.md §7 are conditional on `NODE_ENV === "production"` and are effectively **no-ops if you forget to set it**:

- **CORS** only restricts to `FRONTEND_URL` in production; otherwise it's wide open.
- **Error responses** only omit the raw `error.message` field in production; otherwise internal error detail is echoed to the client.
- `morgan` logging switches from verbose `"dev"` format to `"combined"` (production-appropriate) format.

Checklist for a real deployment:
- [ ] `NODE_ENV=production` set on the host
- [ ] `JWT_SECRET` is a real generated value, not a dev placeholder
- [ ] `FRONTEND_URL` is the actual deployed frontend origin (see gotcha above)
- [ ] `MONGODB_URI` / `GEMINI_API_KEY` / `GROQ_API_KEY` are production values, not shared with local dev
- [ ] `EMAIL_USER` / `EMAIL_APP_PASSWORD` set if password reset should actually send email
- [ ] `VITE_API_URL` (frontend build) points at the deployed backend origin, not `localhost`
