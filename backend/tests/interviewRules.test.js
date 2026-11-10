// Offline unit tests for the Mock Interview rules. No AI calls, no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_QUESTIONS,
    FOLLOW_UP_CATEGORY,
    shouldAddFollowUp,
    spreadByCategory,
    usesWeakAreas
} = require('../services/interviewRules');

const categories = (qs) => qs.map((q) => q.category);
const hasAdjacentRepeat = (qs) => qs.some((q, i) => i > 0 && q.category.toLowerCase() === qs[i - 1].category.toLowerCase());

const mainQuestion = { question: 'Why did you choose MongoDB?', category: 'Past Project' };
const followUp = { question: 'Why not SQL?', category: FOLLOW_UP_CATEGORY };

test('a main question can get a follow-up', () => {
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why not SQL?', totalQuestions: 6 }), true);
});

test('a follow-up is never followed up again (no chains on one concept)', () => {
    assert.equal(shouldAddFollowUp({ answeredQuestion: followUp, followUpQuestion: 'And then?', totalQuestions: 7 }), false);
});

test('no follow-up when the model returned an empty or blank one', () => {
    for (const followUpQuestion of ['', '   ', undefined, null]) {
        assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion, totalQuestions: 6 }), false);
    }
});

test('no follow-up after a non-answer such as "I don\'t know"', () => {
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why?', totalQuestions: 6, score: 15 }), false);
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why?', totalQuestions: 6, score: 20 }), false);
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why?', totalQuestions: 6, score: 45 }), true);
});

test('no follow-up once the round has reached the question limit', () => {
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why?', totalQuestions: MAX_QUESTIONS }), false);
    assert.equal(shouldAddFollowUp({ answeredQuestion: mainQuestion, followUpQuestion: 'Why?', totalQuestions: MAX_QUESTIONS - 1 }), true);
});

test('simulated round: every main question followed up still never runs past 2 questions per concept', () => {
    const questions = Array.from({ length: 6 }, (_, i) => ({ question: `Q${i + 1}`, category: 'Main' }));
    for (let i = 0; i < questions.length; i++) {
        if (shouldAddFollowUp({ answeredQuestion: questions[i], followUpQuestion: 'follow-up?', totalQuestions: questions.length })) {
            questions.splice(i + 1, 0, { question: 'follow-up?', category: FOLLOW_UP_CATEGORY });
        }
    }
    let run = 0;
    let longest = 0;
    questions.forEach((q) => { run = q.category === FOLLOW_UP_CATEGORY ? run + 1 : 1; longest = Math.max(longest, run); });
    assert.equal(longest, 2);
    assert.ok(questions.length <= MAX_QUESTIONS);
});

test('spreadByCategory separates same-category questions (the live-test case)', () => {
    const generated = [
        { question: 'How is your caching implemented?', category: 'Past Project' },
        { question: 'How did you verify caching saved calls?', category: 'Past Project' },
        { question: 'SQL vs NoSQL?', category: 'CS Fundamentals' },
        { question: 'How do promises work?', category: 'Tech Stack' },
        { question: 'What is CORS?', category: 'Tech Stack' },
        { question: 'React lifecycle?', category: 'CS Fundamentals' }
    ];
    const ordered = spreadByCategory(generated);
    assert.equal(ordered.length, generated.length);
    assert.deepEqual(new Set(ordered), new Set(generated));
    assert.equal(hasAdjacentRepeat(ordered), false, categories(ordered).join(' > '));
});

test('spreadByCategory handles a category with half the questions', () => {
    const generated = ['A', 'A', 'A', 'B', 'C', 'D'].map((category, i) => ({ question: `q${i}`, category }));
    assert.equal(hasAdjacentRepeat(spreadByCategory(generated)), false);
});

test('spreadByCategory keeps everything when a repeat cannot be avoided', () => {
    const generated = ['A', 'A', 'A', 'B'].map((category, i) => ({ question: `q${i}`, category }));
    const ordered = spreadByCategory(generated);
    assert.equal(ordered.length, 4);
    assert.deepEqual(new Set(ordered), new Set(generated));
});

test('weak spots only steer the Technical round', () => {
    assert.equal(usesWeakAreas('Technical'), true);
    assert.equal(usesWeakAreas('HR'), false);
    assert.equal(usesWeakAreas('Behavioral'), false);
});
