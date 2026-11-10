// Offline unit tests for the Project Interrogator's topic rotation.
// No AI calls, no database. Run with: npm test (from backend/).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    INTERROGATION_TOPICS,
    QUESTIONS_PER_TOPIC,
    TOTAL_QUESTIONS,
    buildInterviewerGuide,
    stripLeakedNotes,
    asksQuestion,
    endsInterview,
    isUsableReply,
    fallbackQuestion
} = require('../services/interrogationGuide');

test('first question opens topic 1 with a greeting and no reaction', () => {
    const guide = buildInterviewerGuide(0);
    assert.match(guide, /topic 1 of 6/);
    assert.match(guide, /don't react to an answer/);
    assert.ok(guide.includes(INTERROGATION_TOPICS[0]));
});

test('second question is a follow-up on topic 1, not a new topic', () => {
    const guide = buildInterviewerGuide(1);
    assert.match(guide, /follow-up on topic 1/);
    assert.ok(guide.includes(INTERROGATION_TOPICS[0]));
    assert.doesNotMatch(guide, /Move to topic/);
});

test('every topic gets exactly one opening and one follow-up, in order', () => {
    INTERROGATION_TOPICS.forEach((topic, i) => {
        const opening = buildInterviewerGuide(i * QUESTIONS_PER_TOPIC);
        const followUp = buildInterviewerGuide(i * QUESTIONS_PER_TOPIC + 1);
        assert.match(opening, new RegExp(`topic ${i + 1} of ${INTERROGATION_TOPICS.length}`));
        assert.ok(opening.includes(topic));
        assert.match(followUp, new RegExp(`follow-up on topic ${i + 1}`));
        assert.ok(followUp.includes(topic));
    });
});

test('a topic is never asked about more than QUESTIONS_PER_TOPIC times', () => {
    INTERROGATION_TOPICS.forEach((topic) => {
        let count = 0;
        for (let q = 0; q < TOTAL_QUESTIONS; q++) {
            if (buildInterviewerGuide(q).includes(topic)) count++;
        }
        assert.equal(count, QUESTIONS_PER_TOPIC);
    });
});

test('every question after the first tells the model not to end the interview', () => {
    for (let q = 1; q < TOTAL_QUESTIONS; q++) {
        assert.match(buildInterviewerGuide(q), /do not end the interview/);
    }
});

test('after all questions the guide wraps up instead of asking more', () => {
    assert.equal(TOTAL_QUESTIONS, 12);
    for (const q of [TOTAL_QUESTIONS, TOTAL_QUESTIONS + 1, TOTAL_QUESTIONS + 10]) {
        const guide = buildInterviewerGuide(q);
        assert.match(guide, /All topics are covered/);
        assert.match(guide, /End & Grade/);
    }
});

test('stripLeakedNotes removes a bracketed guide the model wrote into its reply', () => {
    const reply = 'Good, that\'s clear.\n\nWhich parts did you build yourself?\n\n[Interviewer guide: move to topic 3 of 6: tech stack.]';
    assert.equal(stripLeakedNotes(reply), 'Good, that\'s clear.\n\nWhich parts did you build yourself?');
});

test('stripLeakedNotes removes an unclosed note at the end of a reply', () => {
    assert.equal(stripLeakedNotes('Why MongoDB?\n[Current step: ask about'), 'Why MongoDB?');
});

test('asksQuestion spots replies that are only a reaction', () => {
    assert.equal(asksQuestion('Good, that\'s clear.'), false);
    assert.equal(asksQuestion('That was a hands-on way to test it.'), false);
    assert.equal(asksQuestion('Nice. Why did you pick MongoDB?'), true);
    assert.equal(asksQuestion('Walk me through the upload flow.'), true);
    assert.equal(asksQuestion(undefined), false);
});

test('guides never show a question counter (it made the model wrap up early)', () => {
    for (let q = 0; q <= TOTAL_QUESTIONS; q++) {
        assert.doesNotMatch(buildInterviewerGuide(q), /question \d+ of/i);
    }
});

test('endsInterview spots replies that try to close the interview', () => {
    assert.equal(endsInterview("We are out of time, so I'll share my feedback report shortly!"), true);
    assert.equal(endsInterview('Thanks for walking me through it. Click "End & Grade".'), true);
    assert.equal(endsInterview('Nice. Why did you pick MongoDB?'), false);
});

test('isUsableReply rejects mid-interview replies with no question or an early ending', () => {
    assert.equal(isUsableReply('Nice. Why did you pick MongoDB?', 5), true);
    assert.equal(isUsableReply('That sounds like a great next step.', 11), false);
    assert.equal(isUsableReply("We're out of time. Any questions for me?", 11), false);
    assert.equal(isUsableReply('Thanks! Click "End & Grade" to see your report.', TOTAL_QUESTIONS), true);
});

test('fallbackQuestion gives a real question for every topic', () => {
    for (let q = 0; q < TOTAL_QUESTIONS; q++) {
        assert.ok(asksQuestion(fallbackQuestion(q)));
        assert.equal(isUsableReply(fallbackQuestion(q), q), true);
    }
});

test('stripLeakedNotes leaves normal replies untouched', () => {
    const reply = 'You used arr[0] in the parser. Why that index?';
    assert.equal(stripLeakedNotes(reply), reply);
    assert.equal(stripLeakedNotes(undefined), '');
});
