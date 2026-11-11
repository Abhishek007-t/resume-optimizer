// Rules for the Mock Interview round that are enforced in code rather than
// left to the model. Kept free of AI/SDK imports so they can be unit-tested
// offline (see backend/tests/interviewRules.test.js).
//
// A live test of the original version showed two problems: every round type,
// HR included, opened with the same three questions about the candidate's
// weak spots, and follow-ups could be added to follow-ups, so one concept ran
// for three or more questions in a row.

const BASE_QUESTION_COUNT = 6;
const MAX_QUESTIONS = 10;
const FOLLOW_UP_CATEGORY = 'Follow-up';

// At most this many of the generated questions may target known weak spots.
const MAX_WEAK_AREA_QUESTIONS = 2;

// At or below this score the candidate gave no real answer ("I don't know").
// A live test showed the model then re-asked the same question in other
// words, which only adds pressure; the score's hint already shows them what
// a good answer covers, so the round moves on instead.
const NO_REAL_ANSWER_SCORE = 20;

// Whether the model's suggested follow-up should be inserted after the
// question that was just answered. Only one follow-up per main question
// (a follow-up is never followed up again), and none after a non-answer.
const shouldAddFollowUp = ({ answeredQuestion, followUpQuestion, totalQuestions, score }) =>
    Boolean(followUpQuestion && followUpQuestion.trim()) &&
    answeredQuestion?.category !== FOLLOW_UP_CATEGORY &&
    !(typeof score === 'number' && score <= NO_REAL_ANSWER_SCORE) &&
    totalQuestions < MAX_QUESTIONS;

// Reorders a generated question set so two questions of the same category
// are never next to each other when that can be avoided. A live test showed
// two "Past Project" questions about the same feature placed back to back;
// with a follow-up on each, the round spent four questions in a row on one
// concept. Spreading them out keeps the interview moving between topics.
const spreadByCategory = (questions) => {
    const remaining = [...questions];
    const ordered = [];
    while (remaining.length) {
        const last = (ordered[ordered.length - 1]?.category || '').toLowerCase().trim();
        // Prefer the category with the most questions left, so it can still
        // be spread out later; fall back to any different category.
        const counts = remaining.reduce((acc, q) => {
            const c = (q.category || '').toLowerCase().trim();
            acc[c] = (acc[c] || 0) + 1;
            return acc;
        }, {});
        let pick = -1;
        remaining.forEach((q, i) => {
            const c = (q.category || '').toLowerCase().trim();
            if (c === last && last) return;
            if (pick === -1 || counts[c] > counts[(remaining[pick].category || '').toLowerCase().trim()]) pick = i;
        });
        ordered.push(remaining.splice(pick === -1 ? 0 : pick, 1)[0]);
    }
    return ordered;
};

// Weak spots from earlier activity are technical (resume gaps, project
// claims), so they only steer the Technical round. HR and Behavioral rounds
// stay on their own subject.
const usesWeakAreas = (roundType) => roundType === 'Technical';

module.exports = {
    BASE_QUESTION_COUNT,
    MAX_QUESTIONS,
    FOLLOW_UP_CATEGORY,
    MAX_WEAK_AREA_QUESTIONS,
    NO_REAL_ANSWER_SCORE,
    shouldAddFollowUp,
    spreadByCategory,
    usesWeakAreas
};
