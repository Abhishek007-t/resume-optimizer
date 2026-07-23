const ai = require('../config/gemini');
const { Type } = require('@google/genai');
const axios = require('axios');
const groqConfig = require('../config/groq');

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

const SCORE_BREAKDOWN_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        keywordRelevance: { type: Type.INTEGER, description: 'Keyword relevance for the apparent target role, 0-20' },
        quantifiedImpact: { type: Type.INTEGER, description: 'Use of numbers/metrics in bullets, 0-20' },
        formattingConsistency: { type: Type.INTEGER, description: 'Formatting and structural consistency, 0-20' },
        sectionCompleteness: { type: Type.INTEGER, description: 'Completeness of standard resume sections, 0-20' },
        clarity: { type: Type.INTEGER, description: 'Clarity and professionalism of language, 0-20' }
    },
    required: ['keywordRelevance', 'quantifiedImpact', 'formattingConsistency', 'sectionCompleteness', 'clarity']
};

const ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        scoreBreakdown: SCORE_BREAKDOWN_SCHEMA,
        atsScore: { type: Type.NUMBER, description: 'Overall ATS/quality score from 0 to 100 — must equal the sum of scoreBreakdown values' },
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
    required: ['scoreBreakdown', 'atsScore', 'atsReasoning', 'strengths', 'weaknesses', 'missingKeywords', 'improvements', 'formatting', 'overallFeedback']
};

const buildAnalysisPrompt = (extractedText) => `Evaluate this resume for ATS compatibility and overall quality.

Score it on these 5 criteria independently, each 0-20, then set atsScore to their exact sum (0-100):
- keywordRelevance: keyword relevance for its apparent target role
- quantifiedImpact: use of numbers/metrics in bullets
- formattingConsistency: formatting and structural consistency
- sectionCompleteness: completeness of standard sections
- clarity: clarity of language

Score each criterion on its own merits — do not anchor it to what you expect the total to be.

Identify concrete strengths, weaknesses with severity, missing keywords a recruiter would expect for this candidate's apparent field, and specific improvements — each with a rewritten example bullet.

Resume:
${extractedText}`;

const clampScore = (n, max) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));

const analyzeResume = async (extractedText) => {
    const result = await generateStructuredJSON({
        prompt: buildAnalysisPrompt(extractedText),
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        schema: ANALYSIS_SCHEMA,
        temperature: 0.1
    });

    // Recompute atsScore server-side from the sub-scores rather than trusting
    // the model's own addition — removes arithmetic slip as a source of the
    // score drifting between otherwise-identical runs.
    const breakdown = result.scoreBreakdown || {};
    const clamped = {
        keywordRelevance: clampScore(breakdown.keywordRelevance, 20),
        quantifiedImpact: clampScore(breakdown.quantifiedImpact, 20),
        formattingConsistency: clampScore(breakdown.formattingConsistency, 20),
        sectionCompleteness: clampScore(breakdown.sectionCompleteness, 20),
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

const INTERROGATION_SYSTEM_INSTRUCTION = `You are a technical interview panelist probing a college fresher — a final-year student or recent graduate, typically interviewing for an internship or entry-level role, not an experienced engineer — about ONE specific project from their resume. Calibrate your expectations accordingly: don't expect production-scale metrics, team-lead experience, or enterprise architecture decisions. Do expect them to genuinely understand what they personally built and be able to explain their own design choices, even in a small or simple project.

Ask exactly ONE focused follow-up question per turn — never multiple questions at once. Every question must build directly on something specific the candidate just said in their previous answer — reference the exact claim, technology, or decision they mentioned rather than asking a generic question that could apply to any project. Target vague claims and unquantified results ("optimized", "improved", "built a scalable system") by asking for specifics: what exactly they built, why they chose that approach over alternatives they considered, what broke and how they debugged it, and their individual contribution versus any teammates'. If the candidate's last answer was still vague, say so directly in one sentence and ask again before moving to a new angle. Keep each question to 1-2 sentences. Stay strictly on the project described — never invent details about it that weren't given to you.`;

const buildKickoffMessage = (project) => `Project: ${project.title}
Description: ${project.description}
Tech stack: ${(project.techStack || []).join(', ')}

Begin the interrogation now. Ask your first pointed question about this project.`;

const startInterrogation = async (project) => {
    const chat = createChatSession({ systemInstruction: INTERROGATION_SYSTEM_INSTRUCTION, temperature: 0.6 });
    return sendMessageWithRetry(chat, buildKickoffMessage(project));
};

const continueInterrogation = async (history, userMessage) => {
    const seededHistory = history.map(({ role, text }) => ({ role, parts: [{ text }] }));
    const chat = createChatSession({
        systemInstruction: INTERROGATION_SYSTEM_INSTRUCTION,
        temperature: 0.6,
        history: seededHistory
    });
    return sendMessageWithRetry(chat, userMessage);
};

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

const QUESTION_GEN_SYSTEM_INSTRUCTION = `You are an experienced interviewer designing a mock interview round. Generate questions grounded in the candidate's actual resume and, if given, the specific job description — not generic questions any stranger's resume would also get. Vary difficulty and angle across the set.`;

const ROUND_TYPE_GUIDANCE = {
    HR: 'Focus on motivation, culture fit, career goals, and general communication — not technical depth.',
    Technical: "Focus on the specific technologies, projects, and skills listed on the resume, plus core CS fundamentals relevant to the target role.",
    Behavioral: 'Focus on past experiences using a STAR-style angle — teamwork, conflict, failure, leadership, ownership.'
};

const QUESTION_SET_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            category: { type: Type.STRING, description: 'e.g. DSA, System Design, Past Project, Culture Fit, Conflict Resolution' },
            targetSkill: { type: Type.STRING, description: 'The skill or trait this question is meant to probe' }
        },
        required: ['question', 'category', 'targetSkill']
    }
};

const buildQuestionGenPrompt = (resumeText, jobDescription, roundType, weakAreasHint) => `Generate 6 interview questions for a ${roundType} round.

${ROUND_TYPE_GUIDANCE[roundType] || ''}

${weakAreasHint ? `This candidate has known weak spots from prior activity on this platform — bias at least half the questions toward directly probing these, rather than generating generic questions that avoid them:\n${weakAreasHint}\n\n` : ''}${jobDescription ? `Target job description:\n${jobDescription}\n\n` : ''}Candidate resume:
${resumeText}`;

const generateInterviewQuestions = async (resumeText, jobDescription, roundType, weakAreasHint = '') => {
    return generateStructuredJSON({
        prompt: buildQuestionGenPrompt(resumeText, jobDescription, roundType, weakAreasHint),
        systemInstruction: QUESTION_GEN_SYSTEM_INSTRUCTION,
        schema: QUESTION_SET_SCHEMA,
        temperature: 0.7
    });
};

const ANSWER_SCORING_SYSTEM_INSTRUCTION = `You are an interview panelist scoring a candidate's written answer. Score honestly against a real hiring bar — do not inflate scores to be encouraging. Reward specificity, structure, and relevance; penalize vagueness and rambling.`;

const ANSWER_SCORE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: '0-100' },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        idealAnswerHint: { type: Type.STRING, description: 'One sentence on what a strong answer would have included' }
    },
    required: ['score', 'strengths', 'gaps', 'idealAnswerHint']
};

const buildAnswerScoringPrompt = (question, answer, resumeText) => `Score this interview answer.

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
        systemInstruction: 'You are summarizing a completed mock interview session for the candidate.',
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
