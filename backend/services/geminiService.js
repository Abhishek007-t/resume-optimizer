const ai = require('../config/gemini');
const { Type } = require('@google/genai');
const axios = require('axios');
const groqConfig = require('../config/groq');
const { scoreSectionCompleteness } = require('../utils/parseabilityChecker');
const { BASE_QUESTION_COUNT, MAX_WEAK_AREA_QUESTIONS, usesWeakAreas, spreadByCategory } = require('./interviewRules');
const {
    buildInterviewerGuide,
    stripLeakedNotes,
    endsInterview,
    isUsableReply,
    fallbackQuestion
} = require('./interrogationGuide');

const MODEL = 'gemini-3.5-flash-lite';

// Defensive cleanup in case the model still wraps output in a code fence
// despite responseSchema/responseMimeType constraining it to raw JSON.
const stripJsonBlock = (text) => {
    let result = text.trim();
    if (result.startsWith('```json')) {
        result = result.substring(7);
    } else if (result.startsWith('```')) {
        result = result.substring(3);
    }
    if (result.endsWith('```')) {
        result = result.substring(0, result.length - 3);
    }
    return result.trim();
};

// Status codes worth retrying: transient server-side overload/rate-limit,
// not client errors like bad request or invalid key.
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callGemini = async (contents, config, attempt = 0) => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents,
            config
        });
        return response.text;
    } catch (error) {
        const isTransient = TRANSIENT_STATUS_CODES.has(error.status);
        if (isTransient && attempt < MAX_TRANSIENT_RETRIES) {
            await sleep(1000 * 2 ** attempt); // 1s, then 2s
            return callGemini(contents, config, attempt + 1);
        }
        throw error;
    }
};

const isGroqConfigured = () => Boolean(groqConfig.apiKey);

// Gemini's schema format is structurally the same as JSON Schema except
// `type` values use the Type enum's uppercase strings (Type.OBJECT === 'OBJECT').
// Lowercasing them recursively lets the exact same schema objects drive the
// Groq fallback prompt without maintaining a second copy of every schema.
const toJsonSchema = (node) => {
    if (Array.isArray(node)) return node.map(toJsonSchema);
    if (node && typeof node === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            out[key] = key === 'type' && typeof value === 'string' ? value.toLowerCase() : toJsonSchema(value);
        }
        return out;
    }
    return node;
};

// Fallback provider used only when Gemini's free-tier quota is exhausted or
// it's otherwise unavailable — Groq's free tier is a separate quota entirely,
// so the app keeps working end-to-end instead of going dark for the day.
// Groq has no native equivalent to Gemini's responseSchema, so the schema is
// serialized into the prompt and enforced via json_object mode + the same
// self-repair retry used for Gemini.
const callGroq = async ({ prompt, systemInstruction, schema, temperature }) => {
    const schemaInstruction = `Respond with ONLY a single valid JSON object — no markdown fences, no explanation — matching this JSON Schema exactly:\n${JSON.stringify(toJsonSchema(schema))}`;

    const response = await axios.post(
        `${groqConfig.baseURL}/chat/completions`,
        {
            model: groqConfig.model,
            messages: [
                { role: 'system', content: `${systemInstruction}\n\n${schemaInstruction}` },
                { role: 'user', content: prompt }
            ],
            temperature,
            response_format: { type: 'json_object' }
        },
        { headers: { Authorization: `Bearer ${groqConfig.apiKey}` } }
    );

    return response.data.choices[0].message.content;
};

// Enforces JSON output against `schema` via Gemini's native structured-output
// support, and self-repairs once if the model still returns unparseable text.
// Falls back to Groq (if configured) when Gemini fails for any reason, so a
// quota-exhausted or unavailable Gemini doesn't take the whole feature down.
const generateStructuredJSON = async ({ prompt, systemInstruction, schema, temperature = 0.3 }) => {
    const config = {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
        maxOutputTokens: 4096
    };

    let rawText;
    let usedGroq = false;
    try {
        rawText = await callGemini(prompt, config);
    } catch (geminiError) {
        if (!isGroqConfigured()) throw geminiError;
        console.warn('Gemini call failed, falling back to Groq:', geminiError.message);
        usedGroq = true;
        rawText = await callGroq({ prompt, systemInstruction, schema, temperature });
    }

    try {
        return JSON.parse(stripJsonBlock(rawText));
    } catch (parseError) {
        const repairPrompt = `The following output was supposed to be valid JSON matching the required schema but failed to parse (${parseError.message}). Return ONLY the corrected, valid JSON — no explanation, no markdown fences:\n\n${rawText}`;
        const repairedText = usedGroq
            ? await callGroq({ prompt: repairPrompt, systemInstruction, schema, temperature })
            : await callGemini(repairPrompt, config);
        return JSON.parse(stripJsonBlock(repairedText));
    }
};

// Same as generateStructuredJSON but for multimodal input (e.g. an uploaded
// image/PDF) — takes an array of Part objects instead of a plain string, so
// the JSON-repair retry appends a part rather than concatenating strings.
const generateStructuredJSONFromParts = async ({ parts, systemInstruction, schema, temperature = 0.2 }) => {
    const config = {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
        maxOutputTokens: 2048
    };

    const rawText = await callGemini(parts, config);

    try {
        return JSON.parse(stripJsonBlock(rawText));
    } catch (parseError) {
        const repairParts = [
            ...parts,
            { text: `The previous response was supposed to be valid JSON matching the required schema but failed to parse (${parseError.message}). Return ONLY the corrected, valid JSON — no explanation, no markdown fences.` }
        ];
        const repairedText = await callGemini(repairParts, config);
        return JSON.parse(stripJsonBlock(repairedText));
    }
};

const ANALYSIS_SYSTEM_INSTRUCTION = `You are an expert technical recruiter and ATS specialist with 10+ years reviewing resumes for software engineering and IT roles. Give direct, specific, actionable feedback — never generic platitudes. Every claim must be grounded in the actual resume text provided; never invent details not present in it.`;

// sectionCompleteness is deliberately NOT in here — "does this resume have
// an Experience/Education/Skills heading" is a yes/no presence check with
// zero semantic judgment involved, and letting the LLM score it was adding
// pure sampling variance to a criterion that has one objectively correct
// answer per resume. It's computed deterministically instead — see
// scoreSectionCompleteness in utils/parseabilityChecker.js.
const SCORE_BREAKDOWN_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        keywordRelevance: { type: Type.INTEGER, description: 'Keyword relevance for the apparent target role, 0-20' },
        quantifiedImpact: { type: Type.INTEGER, description: 'Use of numbers/metrics in bullets, 0-20' },
        formattingConsistency: { type: Type.INTEGER, description: 'Formatting and structural consistency, 0-20' },
        clarity: { type: Type.INTEGER, description: 'Clarity and professionalism of language, 0-20' }
    },
    required: ['keywordRelevance', 'quantifiedImpact', 'formattingConsistency', 'clarity']
};

const ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        scoreBreakdown: SCORE_BREAKDOWN_SCHEMA,
        atsReasoning: { type: Type.STRING },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        weaknesses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    issue: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                },
                required: ['issue', 'impact', 'severity']
            }
        },
        missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        improvements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    section: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    example: { type: Type.STRING }
                },
                required: ['section', 'suggestion', 'example']
            }
        },
        formatting: {
            type: Type.OBJECT,
            properties: {
                issueFound: { type: Type.BOOLEAN },
                feedback: { type: Type.STRING }
            },
            required: ['issueFound', 'feedback']
        },
        overallFeedback: { type: Type.STRING }
    },
    required: ['scoreBreakdown', 'atsReasoning', 'strengths', 'weaknesses', 'missingKeywords', 'improvements', 'formatting', 'overallFeedback']
};

const buildAnalysisPrompt = (extractedText) => `Evaluate this resume for ATS compatibility and overall quality.

Score it on these 4 criteria independently, each 0-20 — score each on its own merits, do not anchor it to what you expect a total to be (there is no total for you to compute; that's handled separately):
- keywordRelevance: keyword relevance for its apparent target role
- quantifiedImpact: use of numbers/metrics in bullets
- formattingConsistency: formatting and structural consistency
- clarity: clarity of language

Identify concrete strengths, weaknesses with severity, missing keywords a recruiter would expect for this candidate's apparent field, and specific improvements — each with a rewritten example bullet.

Resume:
${extractedText}`;

const clampScore = (n, max) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));

const analyzeResume = async (extractedText) => {
    const result = await generateStructuredJSON({
        prompt: buildAnalysisPrompt(extractedText),
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        schema: ANALYSIS_SCHEMA,
        temperature: 0
    });

    // atsScore is entirely server-computed: 4 LLM-judged sub-scores (clamped,
    // never trusting the model's own arithmetic) plus one fully deterministic
    // sub-score (sectionCompleteness — a presence check, not a judgment call,
    // so it carries zero sampling variance). Splitting the rubric this way
    // means only 80 of the 100 points can drift between runs at all, not 100.
    const breakdown = result.scoreBreakdown || {};
    const clamped = {
        keywordRelevance: clampScore(breakdown.keywordRelevance, 20),
        quantifiedImpact: clampScore(breakdown.quantifiedImpact, 20),
        formattingConsistency: clampScore(breakdown.formattingConsistency, 20),
        sectionCompleteness: scoreSectionCompleteness(extractedText),
        clarity: clampScore(breakdown.clarity, 20)
    };
    result.scoreBreakdown = clamped;
    result.atsScore = Object.values(clamped).reduce((sum, v) => sum + v, 0);

    return result;
};

const JOB_MATCH_SYSTEM_INSTRUCTION = `You are an expert technical recruiter comparing a candidate's resume against a specific job description to judge fit. Be honest and specific — do not inflate the match score to be encouraging. Ground every judgment in the actual text of both documents.`;

const JOB_MATCH_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        matchPercentage: { type: Type.NUMBER, description: 'Overall fit score from 0 to 100' },
        matchReasoning: { type: Type.STRING },
        matchedSkills: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    skill: { type: Type.STRING },
                    importance: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                    proficiency: { type: Type.STRING }
                },
                required: ['skill', 'importance']
            }
        },
        missingSkills: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    skill: { type: Type.STRING },
                    importance: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                    canBeLearned: { type: Type.BOOLEAN },
                    alternative: { type: Type.STRING }
                },
                required: ['skill', 'importance', 'canBeLearned']
            }
        },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        weaknesses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    gap: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                    impact: { type: Type.STRING }
                },
                required: ['gap', 'severity', 'impact']
            }
        },
        improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendation: { type: Type.STRING, enum: ['Strong Fit', 'Potential Fit', 'Not Recommended'] },
        finalVerdict: { type: Type.STRING }
    },
    required: ['matchPercentage', 'matchReasoning', 'matchedSkills', 'missingSkills', 'strengths', 'weaknesses', 'improvements', 'recommendation', 'finalVerdict']
};

const buildJobMatchPrompt = (extractedText, jobDescription) => `Compare this resume against the job description and determine fit.

Score match percentage 0-100 based on required skills coverage, experience level alignment, and domain relevance. List matched skills with evidence from the resume, missing skills with whether they're realistically learnable quickly, and a clear hire-fit recommendation.

Job Description:
${jobDescription}

Resume:
${extractedText}`;

const matchJob = async (extractedText, jobDescription) => {
    return generateStructuredJSON({
        prompt: buildJobMatchPrompt(extractedText, jobDescription),
        systemInstruction: JOB_MATCH_SYSTEM_INSTRUCTION,
        schema: JOB_MATCH_SCHEMA,
        temperature: 0.1
    });
};

// Reusable multi-turn session for conversational features (Project
// Interrogator, Mock Interview Simulator). Each HTTP request is stateless,
// so `history` lets a fresh session be re-seeded from what's stored in
// MongoDB rather than relying on an in-memory session surviving across calls.
const createChatSession = ({ systemInstruction, temperature = 0.6, history } = {}) => {
    return ai.chats.create({
        model: MODEL,
        config: { systemInstruction, temperature },
        history
    });
};

// Same transient-retry protection as callGemini, for the chat.sendMessage() path.
const sendMessageWithRetry = async (chat, message, attempt = 0) => {
    try {
        const response = await chat.sendMessage({ message });
        return response.text;
    } catch (error) {
        const isTransient = TRANSIENT_STATUS_CODES.has(error.status);
        if (isTransient && attempt < MAX_TRANSIENT_RETRIES) {
            await sleep(1000 * 2 ** attempt);
            return sendMessageWithRetry(chat, message, attempt + 1);
        }
        throw error;
    }
};

// ---- Project Interrogator ----

const PROJECT_EXTRACTION_SYSTEM_INSTRUCTION = `You extract distinct projects mentioned in a resume. Only use information explicitly present in the text — never invent or embellish details.`;

const PROJECT_EXTRACTION_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            link: { type: Type.STRING, description: "GitHub/live/demo URL for this project if stated in the resume, empty string if none" },
            description: { type: Type.STRING, description: "Concise summary combining the project's stated purpose and the claims made about it" },
            techStack: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'link', 'description', 'techStack']
    }
};

const buildProjectExtractionPrompt = (extractedText) => `Extract every distinct project mentioned in this resume as a list. For each, give its title, its GitHub/live/demo link if one is stated, a concise description combining its stated purpose and the claims made about it, and its tech stack.

Resume:
${extractedText}`;

const extractProjects = async (extractedText) => {
    return generateStructuredJSON({
        prompt: buildProjectExtractionPrompt(extractedText),
        systemInstruction: PROJECT_EXTRACTION_SYSTEM_INSTRUCTION,
        schema: PROJECT_EXTRACTION_SCHEMA,
        temperature: 0.2
    });
};

const INTERROGATION_SYSTEM_INSTRUCTION = `You are a friendly but honest technical interviewer running a practice interview with a college fresher — a final-year student or recent graduate applying for an internship or entry-level role — about ONE project from their resume. Your goal is to check that they understand what they built and can explain it clearly, not to catch them out.

How to ask:
- Ask exactly ONE question per turn, in 1-2 short sentences of simple, everyday English.
- Ask the kind of question a campus-placement interviewer asks a fresher: what it does, why they chose something, how it works, what went wrong, what they would change.
- Do not ask about production-level concerns (timeouts, circuit breakers, scaling, load, distributed systems, exact API error fields, security edge cases) unless the candidate raised it themselves and the current topic calls for it.
- Never build a question on a wrong assumption or a trick premise, and never chain "what if" scenarios.
- Stay on the project as described — never invent details about it.

Following the plan:
- The "Current step" at the end of these instructions says exactly what to do on this turn. Always follow it, even if earlier turns went differently; it decides when to move to a new topic so the interview covers the whole project.
- Never end the interview, say goodbye, or mention a feedback report unless the current step tells you to.
- Your reply is only what you say out loud to the candidate. Never write plans, notes, steps or anything in square brackets.

Every reply has two parts:
1. A short, honest reaction to their last answer (one sentence at most) that matches its quality:
   - Clear and on point: say so briefly, in your own words, and vary the wording from turn to turn.
   - Vague, or didn't answer what you asked: say so kindly and name what was missing. Do not call it clear or good.
   - They don't know or are stuck: don't push, but don't just reassure them either. Give a one-sentence hint that starts with "A good answer would mention" and names one or two concrete things from their project.
2. The question for the current step. Every reply must end with exactly one question, except the final wrap-up. Never send a reply that is only a reaction.

Don't lecture or give long feedback; detailed feedback comes in the final report.`;

// The step changes every turn, so the system instruction is rebuilt per
// request (each request already creates a fresh chat session).
const buildInterrogationSystemInstruction = (questionsAsked) =>
    `${INTERROGATION_SYSTEM_INSTRUCTION}\n\nCurrent step: ${buildInterviewerGuide(questionsAsked)}`;

const buildKickoffMessage = (project) => `Project: ${project.title}
Description: ${project.description}
Tech stack: ${(project.techStack || []).join(', ')}

Begin the interview now.`;

// Generates the panelist's next reply. A mid-interview reply that asks no
// question or tries to end the interview is regenerated once with a
// reminder (the extra AI call only happens then). If that also fails, a
// ready-made question for the current topic is appended, so the interview
// can never stall or end early.
const generatePanelistReply = async ({ history, message, questionsAsked }) => {
    const seededHistory = history.map(({ role, text }) => ({ role, parts: [{ text }] }));
    const systemInstruction = buildInterrogationSystemInstruction(questionsAsked);

    const ask = async (instruction) => {
        const chat = createChatSession({ systemInstruction: instruction, temperature: 0.6, history: seededHistory });
        return stripLeakedNotes(await sendMessageWithRetry(chat, message));
    };

    const reply = await ask(systemInstruction);
    if (isUsableReply(reply, questionsAsked)) return reply;

    const retry = await ask(`${systemInstruction}\n\nImportant: the interview is still going. Your reply MUST end with exactly one question for the current step, and must not wrap up or mention a report.`);
    if (isUsableReply(retry, questionsAsked)) return retry;

    const reaction = endsInterview(reply) ? '' : `${reply} `;
    return `${reaction}${fallbackQuestion(questionsAsked)}`.trim();
};

const startInterrogation = async (project) =>
    generatePanelistReply({ history: [], message: buildKickoffMessage(project), questionsAsked: 0 });

const continueInterrogation = async (history, userMessage) =>
    generatePanelistReply({
        history,
        message: userMessage,
        questionsAsked: history.filter((turn) => turn.role === 'model').length
    });

const WEAK_CLAIMS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        depthScore: { type: Type.NUMBER, description: '0-100: how well the candidate defended this project under questioning' },
        weakClaims: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Claims that stayed vague or unquantified even after follow-up' },
        strongMoments: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Answers that were specific, quantified, and well-defended' },
        summary: { type: Type.STRING }
    },
    required: ['depthScore', 'weakClaims', 'strongMoments', 'summary']
};

const buildInterrogationSummaryPrompt = (project, conversation) => {
    const transcript = conversation
        .map((turn) => `${turn.role === 'model' ? 'Panelist' : 'Candidate'}: ${turn.text}`)
        .join('\n');

    return `Review this technical interrogation transcript about the candidate's project "${project.title}". Identify which of the candidate's claims remained vague or unquantified even after follow-up, which answers were genuinely specific and well-defended, score how well they defended the project overall (0-100), and give a short summary.

Transcript:
${transcript}`;
};

const summarizeInterrogation = async (project, conversation) => {
    return generateStructuredJSON({
        prompt: buildInterrogationSummaryPrompt(project, conversation),
        systemInstruction: 'You are grading a college fresher\'s mock technical interview transcript for specificity and depth of understanding of their own project — not against experienced-engineer standards. A fresher who clearly understands their own design choices and can explain tradeoffs in plain terms should score well, even without production-scale metrics or team-lead experience.',
        schema: WEAK_CLAIMS_SCHEMA,
        temperature: 0.2
    });
};

// ---- Resume Builder ----

const STRUCTURE_SYSTEM_INSTRUCTION = `You extract a resume's content into structured fields for a resume builder. Only use information explicitly present in the text — never invent contact details, employers, dates, or skills that aren't there. Leave a field as an empty string or empty array if it's genuinely not present rather than guessing.`;

const STRUCTURE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        contactInfo: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                github: { type: Type.STRING }
            },
            required: ['name', 'email', 'phone', 'location', 'linkedin', 'github']
        },
        summary: { type: Type.STRING },
        experience: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    company: { type: Type.STRING },
                    position: { type: Type.STRING },
                    location: { type: Type.STRING, description: "City/remote as stated for this role, empty string if not present" },
                    duration: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['company', 'position', 'location', 'duration', 'bullets']
            }
        },
        education: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    school: { type: Type.STRING },
                    degree: { type: Type.STRING },
                    field: { type: Type.STRING },
                    year: { type: Type.STRING }
                },
                required: ['school', 'degree', 'field', 'year']
            }
        },
        skills: {
            type: Type.ARRAY,
            description: "Skills grouped exactly as the original resume groups them (e.g. Languages / Frameworks / Tools). If the original just lists skills flat with no grouping, return a single group with an empty category name.",
            items: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, description: "The group heading as written in the resume, empty string if skills aren't grouped" },
                    items: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['category', 'items']
            }
        },
        certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
        sectionOrder: {
            type: Type.ARRAY,
            description: "The order these sections actually appear in the original resume, top to bottom, using exactly these keys: summary, experience, projects, education, skills, certifications. Omit any section that isn't present in the resume.",
            items: { type: Type.STRING, enum: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'] }
        }
    },
    required: ['contactInfo', 'summary', 'experience', 'education', 'skills', 'certifications', 'sectionOrder']
};

const buildStructurePrompt = (extractedText) => `Parse this resume text into structured fields for a resume builder. Extract contact info, professional summary, work experience (with individual bullet points and location per role), education, skills (preserving whatever grouping/categories the original uses, e.g. Languages/Frameworks/Tools), and certifications exactly as they appear — do not invent or embellish anything. Also report the order these sections appear in the original, top to bottom, so the rebuilt version doesn't reorder the candidate's resume.

Resume:
${extractedText}`;

const parseResumeStructure = async (extractedText) => {
    return generateStructuredJSON({
        prompt: buildStructurePrompt(extractedText),
        systemInstruction: STRUCTURE_SYSTEM_INSTRUCTION,
        schema: STRUCTURE_SCHEMA,
        temperature: 0.1
    });
};

const IMPROVE_FIELD_SYSTEM_INSTRUCTION = `You are an expert resume writer. Rewrite the given resume text to be stronger — more specific, quantified where plausible, and impact-focused. Use ONLY information already implied by the original text; never invent companies, numbers, or achievements that aren't grounded in what's given. If there's nothing meaningful to strengthen, return the text lightly polished rather than fabricating new content. Keep roughly the same length as the original unless it's clearly too short to be useful.`;

const IMPROVE_FIELD_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        improved: { type: Type.STRING },
        whatChanged: { type: Type.STRING, description: 'One short sentence on what was strengthened' }
    },
    required: ['improved', 'whatChanged']
};

const buildImproveFieldPrompt = (fieldLabel, currentText, contextHint) => `Rewrite this ${fieldLabel} from a resume to be stronger.
${contextHint ? `\nContext: ${contextHint}\n` : ''}
Current text:
${currentText}`;

const improveField = async (fieldLabel, currentText, contextHint) => {
    return generateStructuredJSON({
        prompt: buildImproveFieldPrompt(fieldLabel, currentText, contextHint),
        systemInstruction: IMPROVE_FIELD_SYSTEM_INSTRUCTION,
        schema: IMPROVE_FIELD_SCHEMA,
        temperature: 0.4
    });
};

const CERTIFICATION_EXTRACTION_SYSTEM_INSTRUCTION = `You read certificate/credential documents (images or PDFs) and extract a clean, resume-ready description. Only use information visible in the document — never invent an issuer, date, or credential name that isn't shown.`;

const CERTIFICATION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: 'The certification/credential title' },
        issuer: { type: Type.STRING, description: 'The organization that issued it' },
        date: { type: Type.STRING, description: 'Issue date or year, if visible' },
        displayText: { type: Type.STRING, description: 'One resume-ready line combining name, issuer, and date, e.g. "AWS Certified Cloud Practitioner — Amazon Web Services, 2025"' }
    },
    required: ['name', 'issuer', 'date', 'displayText']
};

const extractCertificationInfo = async (base64Data, mimeType) => {
    const parts = [
        { inlineData: { data: base64Data, mimeType } },
        { text: 'Extract the certification name, issuing organization, and date from this document, and produce a single clean resume-ready line.' }
    ];
    return generateStructuredJSONFromParts({
        parts,
        systemInstruction: CERTIFICATION_EXTRACTION_SYSTEM_INSTRUCTION,
        schema: CERTIFICATION_SCHEMA,
        temperature: 0.1
    });
};

// ---- Mock Interview Simulator ----

const QUESTION_GEN_SYSTEM_INSTRUCTION = `You are an experienced campus-placement interviewer designing a mock interview round for a college fresher — a final-year student or recent graduate applying for an internship or entry-level role, not an experienced engineer.

Difficulty: every question must be one a well-prepared fresher can answer — what they built, why they made a choice, how something works, basic fundamentals, their goals and experiences. Never ask about system design, scaling, concurrency or race conditions, distributed systems, production metrics (hit rates, latency or throughput numbers), or exact API error codes. Ask in simple, everyday English, in one or two short sentences, and never build a question on an assumption or "what if" scenario.

Coverage: the questions must each cover a different topic. Never ask two questions about the same feature, concept or project detail.

Ground the questions in the candidate's actual resume and, if given, the job description, so they aren't generic. Phrase them the way a real interviewer would say them out loud, and vary the opening wording across the set instead of repeating one template like "Tell me about a time...".`;

const ROUND_TYPE_GUIDANCE = {
    HR: 'Focus on motivation, career goals, strengths and weaknesses, why this role, and general communication. Do not ask any technical questions.',
    Technical: 'Use this mix: 2 questions about their projects (what it does, why they chose something, how a part works), 2 about technologies listed on their resume at a basic-to-intermediate level, and 2 core CS fundamentals at fresher level (for example OOP, DBMS basics, data structures, HTTP and REST).',
    Behavioral: 'Use a STAR-style angle on situations a student actually has: college projects, team assignments, internships, clubs, deadlines, conflicts with teammates, mistakes they learned from. Do not ask about technical internals.'
};

const QUESTION_SET_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            category: { type: Type.STRING, description: 'e.g. Past Project, Tech Stack, CS Fundamentals, Motivation, Teamwork, Conflict Resolution' },
            targetSkill: { type: Type.STRING, description: 'The skill or trait this question is meant to probe' }
        },
        required: ['question', 'category', 'targetSkill']
    }
};

const buildQuestionGenPrompt = (resumeText, jobDescription, roundType, weakAreasHint) => {
    const useWeakAreas = weakAreasHint && usesWeakAreas(roundType);
    return `Generate exactly ${BASE_QUESTION_COUNT} interview questions for a ${roundType} round.

${ROUND_TYPE_GUIDANCE[roundType] || ''}

${useWeakAreas ? `This candidate has some known weak spots from earlier practice. Use them for at most ${MAX_WEAK_AREA_QUESTIONS} of the ${BASE_QUESTION_COUNT} questions. If you use two, they must be about different features (never two questions about the same feature, such as caching). Ask them at fresher level (for example "How did you check that your caching worked?", not "What was your cache hit rate?"). The other questions must cover other topics:\n${weakAreasHint}\n\n` : ''}${jobDescription ? `Target job description:\n${jobDescription}\n\n` : ''}Candidate resume:
${resumeText}`;
};

const generateInterviewQuestions = async (resumeText, jobDescription, roundType, weakAreasHint = '') => {
    const questions = await generateStructuredJSON({
        prompt: buildQuestionGenPrompt(resumeText, jobDescription, roundType, weakAreasHint),
        systemInstruction: QUESTION_GEN_SYSTEM_INSTRUCTION,
        schema: QUESTION_SET_SCHEMA,
        temperature: 0.7
    });
    return spreadByCategory(questions.slice(0, BASE_QUESTION_COUNT));
};

const ANSWER_SCORING_SYSTEM_INSTRUCTION = `You are an interview panelist scoring a college fresher's answer in the middle of a practice interview. Score against what a well-prepared fresher could realistically say, not a senior engineer. Be honest, not inflated:
- Clear, correct and specific, with an example from their own work: 75-95, even without production metrics.
- Partly right, or correct but generic: 50-74.
- Vague, off-topic or rambling: 25-49.
- "I don't know", or no real answer: 0-20.

You also decide whether a real interviewer would ask one follow-up on this answer before moving on. Ask one only when the answer was vague, left an obvious gap, or mentioned something worth a quick check. If the answer was already clear and complete, return an empty string: real interviewers move on when they're satisfied. A follow-up must be one short, simple sentence a fresher can answer, referencing what they actually said (for example "You mentioned MongoDB — why did you pick it over SQL?"). Never ask about scaling, concurrency, distributed systems, production metrics or exact error codes.`;

const ANSWER_SCORE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: '0-100' },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        idealAnswerHint: { type: Type.STRING, description: 'One sentence on what a strong answer would have included' },
        followUpQuestion: { type: Type.STRING, description: 'A natural follow-up question referencing what the candidate specifically said, if one is warranted — empty string if the answer was already complete and no follow-up is needed' }
    },
    required: ['score', 'strengths', 'gaps', 'idealAnswerHint', 'followUpQuestion']
};

const buildAnswerScoringPrompt = (question, answer, resumeText) => `Score this interview answer, and decide whether it deserves a live follow-up question.

Question: ${question}

Candidate's answer: ${answer}

Candidate's resume (for context on what they could truthfully draw on):
${resumeText}`;

const scoreAnswer = async (question, answer, resumeText) => {
    return generateStructuredJSON({
        prompt: buildAnswerScoringPrompt(question, answer, resumeText),
        systemInstruction: ANSWER_SCORING_SYSTEM_INSTRUCTION,
        schema: ANSWER_SCORE_SCHEMA,
        temperature: 0.3
    });
};

const SESSION_SUMMARY_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        overallScore: { type: Type.NUMBER, description: '0-100 weighted impression across all answers' },
        weakestArea: { type: Type.STRING, description: 'The single category/skill that most needs work' },
        summary: { type: Type.STRING }
    },
    required: ['overallScore', 'weakestArea', 'summary']
};

const buildSessionSummaryPrompt = (questions) => {
    const transcript = questions
        .map((q, i) => `Q${i + 1} [${q.category}] (score ${q.score}/100): ${q.question}\nAnswer: ${q.answer}`)
        .join('\n\n');

    return `Review this full mock interview session and give an overall assessment.

${transcript}`;
};

const summarizeInterviewSession = async (questions) => {
    return generateStructuredJSON({
        prompt: buildSessionSummaryPrompt(questions),
        systemInstruction: 'You are summarizing a completed mock interview session for a college fresher. Judge them against what a well-prepared fresher could realistically answer, not an experienced engineer. Be honest and specific, and end the summary with one concrete thing to practice next.',
        schema: SESSION_SUMMARY_SCHEMA,
        temperature: 0.3
    });
};

// ---- Placement Readiness Index ----
// Deliberately a single small call turning already-computed numbers into
// one actionable insight — the score itself is plain aggregation, not AI.

const READINESS_NARRATIVE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        narrative: { type: Type.STRING, description: '2-3 sentences: strongest signal, then one concrete next step' }
    },
    required: ['narrative']
};

const buildReadinessNarrativePrompt = (data) => `Given this student's aggregated placement-readiness data, identify their strongest signal and their single biggest lever to improve this week. Do not just restate the numbers — give one concrete, actionable next step. Keep it to 2-3 sentences.

Data: ${JSON.stringify(data)}`;

const generateReadinessNarrative = async (data) => {
    const result = await generateStructuredJSON({
        prompt: buildReadinessNarrativePrompt(data),
        systemInstruction: 'You are a direct, specific career coach giving one sharp insight from a student\'s aggregated performance data.',
        schema: READINESS_NARRATIVE_SCHEMA,
        temperature: 0.5
    });
    return result.narrative;
};

module.exports = {
    analyzeResume,
    matchJob,
    createChatSession,
    extractProjects,
    buildKickoffMessage,
    startInterrogation,
    continueInterrogation,
    summarizeInterrogation,
    parseResumeStructure,
    improveField,
    extractCertificationInfo,
    generateInterviewQuestions,
    scoreAnswer,
    summarizeInterviewSession,
    generateReadinessNarrative
};
