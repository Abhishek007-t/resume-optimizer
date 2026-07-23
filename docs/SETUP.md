# Setup & Installation Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | Backend and frontend both require it |
| npm | bundled with Node | |
| MongoDB Atlas account | free tier is enough | See "MongoDB gotcha" below before creating your cluster connection string |
| Google Gemini API key | free tier | Get one at [Google AI Studio](https://aistudio.google.com/) |
| Groq API key | free tier, optional but recommended | Get one at [console.groq.com](https://console.groq.com) — used as an automatic fallback when Gemini's quota is exhausted |

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

JWT_SECRET=<any long random string — used to sign JWTs>

GEMINI_API_KEY=<from Google AI Studio>

GROQ_API_KEY=<from console.groq.com — optional, leave blank to disable the fallback>
```

### MongoDB connection string — a real gotcha

The standard `mongodb+srv://...` connection string Atlas gives you by default **fails with `querySrv ECONNREFUSED`** on networks whose DNS resolver doesn't support SRV records (confirmed on multiple real networks during this project's development, including a college ISP — this is not rare). If you hit that error:

1. In Atlas, go to your cluster → **Connect** → **Drivers**.
2. Toggle off "SRV Connection String" (or select an older driver version) to get the non-SRV form.
3. Use the resulting connection string, which looks like:
   ```
   mongodb://<user>:<password>@ac-xxxxxxx-shard-00-00.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-01.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-02.xxxxx.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxxxxx-shard-0&authSource=admin&appName=<your-app-name>
   ```
   (explicit shard hostnames + `:27017` ports, instead of one `+srv` host).

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
