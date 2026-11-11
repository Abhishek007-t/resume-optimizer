// Live end-to-end check of the Project Interrogator against the real Gemini
// chat API. It runs one full session with scripted fresher-style answers,
// automatically checks every panelist reply, and prints the transcript.
//
// Usage (from backend/):  npm run test:interrogation-live
// Cost: about 13 Gemini requests per run (the chat path has no Groq
// fallback), and the free tier is roughly 20 requests/day, so don't run it
// in a loop. No database or HTTP server is needed.
//
// It mirrors projectController.js exactly: the kickoff turn is stored as a
// hidden user message, only the candidate's plain answer is stored, and the
// history passed to continueInterrogation is the stored conversation.
require('dotenv').config();
const ai = require('../config/gemini');
const geminiService = require('../services/geminiService');
const { TOTAL_QUESTIONS, stripLeakedNotes } = require('../services/interrogationGuide');

// Record every raw model reply before the service cleans or retries it, so
// the report can show regenerations and stripped notes. Wraps the same
// client instance geminiService uses.
let rawAttempts = [];
const originalCreate = ai.chats.create.bind(ai.chats);
ai.chats.create = (options) => {
    const chat = originalCreate(options);
    const originalSend = chat.sendMessage.bind(chat);
    chat.sendMessage = async (params) => {
        const response = await originalSend(params);
        rawAttempts.push(response.text || '');
        return response;
    };
    return chat;
};

const PAUSE_MS = Number(process.env.SIM_PAUSE_MS || 5000); // stay under the per-minute limit
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const project = {
    title: 'AI-Powered Career Readiness Platform',
    description: 'Full-stack AI platform guiding candidates through resume optimization, ATS analysis, job matching, mock interviews with voice input, and career readiness scoring. Integrated Google Gemini and Groq LLMs with content-hash caching (SHA-256 of extracted text + scoring version) stored in MongoDB so unchanged resumes return cached results. Secured the API with JWT validation, NoSQL injection protection, rate limiting, and input sanitization.',
    techStack: ['React.js', 'Node.js', 'Express', 'MongoDB', 'Google Gemini', 'Groq LLM', 'JWT']
};

// One answer per question, in topic order (2 per topic). Deliberately mixed:
// clear answers, a vague one, an "I don't know", and one that mentions a
// production-level term, to check the panelist stays at fresher level.
// Answers are fixed, so they won't always match the exact question asked;
// that also checks the panelist copes with off-target answers.
const answers = [
    { kind: 'good', text: 'It is a web app for college students preparing for placements. You upload your resume, get an ATS score with suggestions, match it to a job description, practice mock interviews, and see one readiness score. I built it because my friends and I had no simple tool to check our resumes.' },
    { kind: 'good', text: 'Mainly final-year students. They use it before placement season to fix their resume and practice answering questions.' },
    { kind: 'good', text: 'I built it alone, so I did the whole backend in Express and MongoDB and the React frontend. The part I spent most time on was the AI analysis and the caching.' },
    { kind: 'good', text: 'I wrote the prompts, the service file that calls Gemini, the routes and controllers, and the React pages like the dashboard and mock interview.' },
    { kind: 'good', text: 'I chose MongoDB because resume analysis results have different shapes for each feature, and storing them as JSON documents was easier than designing SQL tables.' },
    { kind: 'good', text: 'Mongoose. I used schemas for users, resumes and analyses, and I added an index on resumeId and contentHash to make the cache lookup fast.' },
    { kind: 'good', text: 'For ATS analysis, the user clicks Analyze. The backend loads the resume text, makes a SHA-256 hash of the text plus a scoring version, and checks MongoDB. If a saved result exists it returns it, otherwise it calls Gemini, saves the result with the hash, and the frontend shows the score.' },
    { kind: 'vague', text: 'It sort of just works, the AI gives the score and then it is shown.' },
    { kind: 'good', text: 'Gemini kept giving 503 errors and later the free quota of 20 requests a day ran out. I added retries with backoff and then a fallback to Groq when Gemini fails.' },
    { kind: 'dontknow', text: "I don't know, I'm not sure about that part." },
    { kind: 'good', text: 'I tested it manually by uploading my own resume many times, and I wrote a test for the interview topic logic. Next I would add timeouts on the AI calls and cache job matching too.' },
    { kind: 'good', text: 'I would let users compare two versions of their resume side by side to see which scores better.' }
];

const ASKS_SOMETHING = /\?|\b(walk me through|tell me|explain|describe)\b/i;
const PRAISE = /\b(that's clear|great answer|good answer(?! would)|well explained|perfect|excellent)\b/i;

const HARD_TERMS = /\b(circuit breaker|distributed|load balanc\w*|microservice\w*|throughput|race condition|concurren\w*|sharding|replica\w*|quotaId|retryDelay|horizontal\w*|kubernetes)\b/i;

// previousAnswer is the candidate answer this reply is responding to.
const checkReply = (text, index, previousAnswer) => {
    const problems = [];
    if (index !== TOTAL_QUESTIONS && !ASKS_SOMETHING.test(text)) problems.push('no question asked');
    if (previousAnswer && previousAnswer.kind !== 'good' && PRAISE.test(text)) {
        problems.push(`praised a ${previousAnswer.kind === 'vague' ? 'vague' : '"I don\'t know"'} answer`);
    }
    if (previousAnswer && previousAnswer.kind === 'dontknow' && !/good answer would/i.test(text)) {
        problems.push('no hint after "I don\'t know"');
    }
    const words = text.trim().split(/\s+/).length;
    const questionMarks = (text.match(/\?/g) || []).length;
    const isWrapUp = index === TOTAL_QUESTIONS;

    if (/interviewer guide|current step|\[\s*(interviewer|note)/i.test(text)) problems.push('leaked the hidden guide');
    if (!isWrapUp && /feedback report|click "?end|thank you for walking me|wraps up|out of time/i.test(text)) {
        problems.push('ended the interview early');
    }
    if (isWrapUp) {
        if (questionMarks > 0) problems.push('asked a question after all topics were covered');
        if (!/end\s*&\s*grade/i.test(text)) problems.push('wrap-up did not point to "End & Grade"');
    } else {
        if (questionMarks > 1) problems.push(`asked ${questionMarks} questions in one turn`);
        if (words > 70) problems.push(`too long (${words} words)`);
    }
    const hard = text.match(HARD_TERMS);
    if (hard) problems.push(`production-level term: "${hard[0]}"`);
    return problems;
};

const run = async () => {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set in backend/.env');
        process.exit(1);
    }

    const conversation = [
        { role: 'user', text: geminiService.buildKickoffMessage(project), hidden: true }
    ];
    const replies = [];
    const attemptsPerTurn = [];

    rawAttempts = [];
    const first = await geminiService.startInterrogation(project);
    conversation.push({ role: 'model', text: first });
    replies.push(first);
    attemptsPerTurn.push(rawAttempts);

    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        await sleep(PAUSE_MS);
        rawAttempts = [];
        const history = conversation.map(({ role, text }) => ({ role, text }));
        const reply = await geminiService.continueInterrogation(history, answers[i].text);
        conversation.push({ role: 'user', text: answers[i].text });
        conversation.push({ role: 'model', text: reply });
        replies.push(reply);
        attemptsPerTurn.push(rawAttempts);
    }

    let failures = 0;
    console.log(`\n=== Transcript: ${project.title} ===\n`);
    replies.forEach((reply, i) => {
        const label = i === TOTAL_QUESTIONS ? 'Wrap-up' : `Q${i + 1} (topic ${Math.floor(i / 2) + 1}, ${i % 2 === 0 ? 'opening' : 'follow-up'})`;
        const problems = checkReply(reply, i, answers[i - 1]);
        failures += problems.length;
        console.log(`${label}: ${reply.trim()}`);
        // Informational only: the service's safety nets handled these.
        const attempts = attemptsPerTurn[i];
        if (attempts.some((raw) => stripLeakedNotes(raw) !== raw.trim())) console.log('  · model wrote a bracketed note; stripped before saving');
        if (attempts.length > 1) console.log(`  · regenerated (${attempts.length} attempts); first attempt: ${attempts[0].trim()}`);
        if (!attempts.some((raw) => stripLeakedNotes(raw) === reply.trim())) console.log('  · used the ready-made fallback question');
        console.log(problems.length ? `  ✗ ${problems.join('; ')}` : '  ✓ ok');
        if (i < answers.length) console.log(`Candidate [${answers[i].kind}]: ${answers[i].text}\n`);
    });

    // The same stock acknowledgment on most turns reads as robotic and stops
    // telling the candidate anything.
    const openings = replies.slice(1, TOTAL_QUESTIONS).map((r) => r.trim().split(/[.!]/)[0].toLowerCase());
    const counts = openings.reduce((acc, o) => ({ ...acc, [o]: (acc[o] || 0) + 1 }), {});
    Object.entries(counts).filter(([, n]) => n > 3).forEach(([opening, n]) => {
        failures++;
        console.log(`✗ same opening "${opening}" used ${n} times`);
    });

    console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} problem(s) across ${replies.length} replies.`);
    console.log('Automatic checks cover format only; read the transcript to judge difficulty and topic flow.');
    process.exit(failures === 0 ? 0 : 1);
};

run().catch((error) => {
    console.error('Simulation failed:', error.status || '', error.message);
    process.exit(1);
});
