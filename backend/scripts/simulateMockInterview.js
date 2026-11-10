// Live end-to-end check of the Mock Interview against the real Gemini API.
// It generates a question set for each round type, then plays one full
// Technical round: a simulated fresher answers each question (mixing good,
// vague and "I don't know" answers), every answer is scored, follow-ups are
// inserted exactly as interviewController.js does, and the session is
// summarized. Every step is checked automatically and printed.
//
// Usage (from backend/):  npm run test:mock-interview-live
// Cost: roughly 20-25 Gemini requests per run. No database or server needed.
require('dotenv').config();
const ai = require('../config/gemini');
const geminiService = require('../services/geminiService');
const { BASE_QUESTION_COUNT, MAX_QUESTIONS, FOLLOW_UP_CATEGORY, shouldAddFollowUp } = require('../services/interviewRules');

const PAUSE_MS = Number(process.env.SIM_PAUSE_MS || 4000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sample resume built from the user's own project section.
const RESUME_TEXT = `Final-year B.Tech Computer Science student.

PROJECTS
AI-Powered Career Readiness Platform | React.js, Node.js, Express, MongoDB, Google Gemini, Groq LLM, JWT
- Designed and built full-stack AI platform guiding candidates through resume optimization, ATS analysis, job matching, mock interviews with voice input, and career readiness scoring.
- Integrated Google Gemini and Groq LLMs with content-hash caching strategy (SHA-256 of extracted text + scoring version) stored in MongoDB to minimize API calls while maintaining consistent scoring across features. Re-analyzing unchanged resumes returns cached results instantly.
- Hardened API security through JWT validation, NoSQL injection protection, rate limiting, and input sanitization to ensure robust data protection.

SKILLS
JavaScript, React.js, Node.js, Express, MongoDB, REST APIs, Git`;

// What buildWeakAreasHint produces for a user whose earlier Project
// Interrogator report flagged caching/fallback claims; this is the input that
// can pull a whole round onto one concept.
const WEAK_AREAS_HINT = `Resume weaknesses: Few quantified results in project bullets
Unverified/vague claims on project "AI-Powered Career Readiness Platform" (dig into these specifically): cache hit rate was never measured; concurrent duplicate requests are not handled; exact Gemini error conditions for the Groq fallback were unclear`;

// One answer style per question slot. Follow-ups get a "good" answer so any
// further follow-up would come from the chaining rule, not a weak answer.
const ANSWER_PLAN = ['good', 'vague', 'good', 'dontknow', 'good', 'vague'];

const HARD_TERMS = /\b(system design|distributed|scal(e|ing|ability)|concurren\w*|race condition|circuit breaker|sharding|load balanc\w*|microservice\w*|cap theorem|kubernetes|consensus|replication)\b/i;

// The simulated candidate calls Gemini directly, so it needs its own retry
// for temporary 503/429 errors (the baseline run died on one).
const withRetry = async (fn, attempt = 0) => {
    try {
        return await fn();
    } catch (error) {
        if ([429, 500, 503].includes(error.status) && attempt < 3) {
            await sleep(5000 * (attempt + 1));
            return withRetry(fn, attempt + 1);
        }
        throw error;
    }
};

const simulateAnswer = (question, kind) => withRetry(() => simulateAnswerOnce(question, kind));

const simulateAnswerOnce = async (question, kind) => {
    const style = {
        good: 'Give a clear, correct, specific answer in 3-4 simple sentences, as a fresher who built this project would.',
        vague: 'Give a short, vague answer in 1-2 sentences with no specifics, like a nervous fresher.',
        dontknow: "Say honestly in one sentence that you don't know or aren't sure."
    }[kind];
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: `You are a final-year student in a placement interview. Your resume:\n${RESUME_TEXT}\n\nInterviewer: ${question}\n\n${style} Reply with only your spoken answer.`,
        config: { temperature: 0.7 }
    });
    return (response.text || '').trim();
};

const problems = [];
const flag = (where, message) => problems.push(`${where}: ${message}`);

const checkQuestionSet = (roundType, questions) => {
    if (questions.length !== BASE_QUESTION_COUNT) flag(roundType, `expected ${BASE_QUESTION_COUNT} questions, got ${questions.length}`);
    const skills = questions.map((q) => (q.targetSkill || '').toLowerCase().trim());
    const repeated = skills.filter((s, i) => s && skills.indexOf(s) !== i);
    if (repeated.length) flag(roundType, `repeated target skill(s): ${[...new Set(repeated)].join(', ')}`);
    const isCaching = (q) => /cach|hash/i.test(q.question);
    const caching = questions.filter(isCaching).length;
    if (caching > 2) flag(roundType, `${caching} questions about caching (max 2)`);
    const ordered = require('../services/interviewRules').spreadByCategory(questions);
    if (ordered.some((q, i) => i > 0 && isCaching(q) && isCaching(ordered[i - 1]))) {
        flag(roundType, 'two caching questions next to each other after reordering');
    }
    const weakSpot = questions.filter((q) => /cach|hash|fallback|groq|concurren|duplicate request/i.test(q.question)).length;
    if (weakSpot > 2) flag(roundType, `${weakSpot} questions on caching/fallback weak spots (max 2)`);
    questions.forEach((q, i) => {
        if (i > 0 && (q.category || '').toLowerCase() === (questions[i - 1].category || '').toLowerCase()) {
            flag(`${roundType} Q${i + 1}`, `same category as the question before ("${q.category}")`);
        }
    });
    questions.forEach((q, i) => {
        const hard = q.question.match(HARD_TERMS);
        if (hard) flag(`${roundType} Q${i + 1}`, `not fresher-level ("${hard[0]}")`);
        const words = q.question.split(/\s+/).length;
        if (words > 45) flag(`${roundType} Q${i + 1}`, `too long (${words} words)`);
    });
};

const run = async () => {
    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set in backend/.env');
        process.exit(1);
    }

    // 1. Question sets for every round type.
    let technical;
    for (const roundType of ['HR', 'Behavioral', 'Technical']) {
        const generated = await geminiService.generateInterviewQuestions(RESUME_TEXT, '', roundType, WEAK_AREAS_HINT);
        const questions = generated.slice(0, BASE_QUESTION_COUNT).map((q) => ({ ...q }));
        console.log(`\n=== ${roundType} round: generated questions ===`);
        generated.forEach((q, i) => console.log(`${i + 1}. [${q.category} / ${q.targetSkill}] ${q.question}`));
        checkQuestionSet(roundType, generated);
        if (roundType === 'Technical') technical = questions;
        await sleep(PAUSE_MS);
    }

    // 2. Play the Technical round, mirroring interviewController.submitAnswer.
    console.log('\n=== Technical round: full session ===');
    const questions = technical;
    let baseIndex = 0;
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const isFollowUp = q.category === FOLLOW_UP_CATEGORY;
        const kind = isFollowUp ? 'good' : ANSWER_PLAN[baseIndex++ % ANSWER_PLAN.length];

        const answer = await simulateAnswer(q.question, kind);
        await sleep(PAUSE_MS);
        const result = await geminiService.scoreAnswer(q.question, answer, RESUME_TEXT);
        Object.assign(q, { answer, kind, score: result.score, idealAnswerHint: result.idealAnswerHint });

        console.log(`\nQ${i + 1}${isFollowUp ? ' (follow-up)' : ''}: ${q.question}`);
        console.log(`  Candidate [${kind}]: ${answer}`);
        console.log(`  Score: ${result.score}/100 · Hint: ${result.idealAnswerHint}`);

        if (kind === 'dontknow' && result.followUpQuestion && result.followUpQuestion.trim() && result.score > 20) {
            flag(`Q${i + 1}`, `"I don't know" scored ${result.score}, so a follow-up could still be added`);
        }
        if (shouldAddFollowUp({ answeredQuestion: q, followUpQuestion: result.followUpQuestion, totalQuestions: questions.length, score: result.score })) {
            questions.splice(i + 1, 0, { question: result.followUpQuestion.trim(), category: FOLLOW_UP_CATEGORY, targetSkill: q.targetSkill });
            console.log(`  → follow-up added: ${result.followUpQuestion.trim()}`);
            const hard = result.followUpQuestion.match(HARD_TERMS);
            if (hard) flag(`Follow-up after Q${i + 1}`, `not fresher-level ("${hard[0]}")`);
        }
        if (isFollowUp && questions[i + 1]?.category === FOLLOW_UP_CATEGORY) flag(`Q${i + 1}`, 'a follow-up was added to a follow-up (chain)');
        await sleep(PAUSE_MS);
    }

    // Longest run of consecutive questions on one base question.
    let run = 0;
    let longest = 0;
    questions.forEach((q) => { run = q.category === FOLLOW_UP_CATEGORY ? run + 1 : 1; longest = Math.max(longest, run); });
    if (longest > 2) flag('Technical session', `${longest} questions in a row on one concept (max 2)`);
    if (questions.length > MAX_QUESTIONS) flag('Technical session', `${questions.length} questions (max ${MAX_QUESTIONS})`);

    const avg = (kind) => {
        const scored = questions.filter((q) => q.kind === kind);
        return scored.length ? scored.reduce((s, q) => s + q.score, 0) / scored.length : null;
    };
    const good = avg('good');
    const vague = avg('vague');
    const dontKnow = avg('dontknow');
    console.log(`\nAverage score: good ${good?.toFixed(0)}, vague ${vague?.toFixed(0)}, "I don't know" ${dontKnow?.toFixed(0)}`);
    if (good !== null && vague !== null && vague >= good) flag('Scoring', 'vague answers scored as high as good ones');
    if (dontKnow !== null && dontKnow > 30) flag('Scoring', `"I don't know" scored ${dontKnow.toFixed(0)} (expected 30 or less)`);
    if (good !== null && good < 60) flag('Scoring', `good fresher answers averaged only ${good.toFixed(0)} (too harsh for freshers)`);

    await sleep(PAUSE_MS);
    const report = await geminiService.summarizeInterviewSession(questions.filter((q) => q.answer));
    console.log(`\nReport: overall ${report.overallScore}/100 · weakest area: ${report.weakestArea}\n${report.summary}`);

    console.log(`\n${problems.length === 0 ? 'PASS' : 'FAIL'}: ${problems.length} problem(s)`);
    problems.forEach((p) => console.log(`  ✗ ${p}`));
    console.log('Automatic checks cover structure and rough difficulty; read the questions to judge them properly.');
    process.exit(problems.length === 0 ? 0 : 1);
};

run().catch((error) => {
    console.error('Simulation failed:', error.status || '', error.message);
    process.exit(1);
});
