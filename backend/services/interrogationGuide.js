// Topic plan for the Project Interrogator. It lives in code, not in the
// prompt: left to itself the model keeps drilling into whatever the candidate
// said last and never moves on, so the server decides which topic each
// question covers and caps every topic at one main question plus one
// follow-up.
//
// The current step goes into the system instruction, never into the chat
// messages. A live test showed that when the step was appended to the
// candidate's message, the model started writing its own fake
// "[Interviewer guide: ...]" notes in its replies (visible to the user) and
// then followed those instead of the real plan.
//
// Kept free of any AI/SDK imports so it can be unit-tested offline
// (see backend/tests/interrogationGuide.test.js). Keep the topic count and
// QUESTIONS_PER_TOPIC in sync with the progress display in
// frontend/src/pages/ProjectInterrogator.jsx.
const INTERROGATION_TOPICS = [
    'the big picture: what the project does, who it is for, and why they built it',
    'their own role: which parts they personally built',
    'one technology from the tech stack: why they chose it and what it does in this project',
    'how one main feature works, step by step, from what the user does to the result they see',
    'one problem or bug they ran into while building it and how they fixed it',
    'how they tested that it works, and what they would improve or add next'
];
const QUESTIONS_PER_TOPIC = 2;
const TOTAL_QUESTIONS = INTERROGATION_TOPICS.length * QUESTIONS_PER_TOPIC;

// Last-resort question per topic, used only if the model twice fails to ask
// one, so the interview can never stall. Same order as INTERROGATION_TOPICS.
const FALLBACK_QUESTIONS = [
    'What problem does this project solve, and who is it for?',
    'Which part of this project did you build yourself?',
    'Why did you pick one of the technologies in your stack for this project?',
    'Can you walk me through how one main feature works, step by step?',
    'What was one problem you ran into while building it, and how did you fix it?',
    'How did you check that the project works, and what would you add next?'
];

// What the panelist should do on this turn, given how many questions have
// already been asked.
const buildInterviewerGuide = (questionsAsked) => {
    if (questionsAsked >= TOTAL_QUESTIONS) {
        return 'All topics are covered. Do not ask another question. Briefly acknowledge their last answer, thank them in one sentence, and tell them to click "End & Grade" to see their report.';
    }

    const topicNumber = Math.floor(questionsAsked / QUESTIONS_PER_TOPIC) + 1;
    const topic = INTERROGATION_TOPICS[topicNumber - 1];
    const isFollowUp = questionsAsked % QUESTIONS_PER_TOPIC !== 0;

    // No "question N of 12" counter here: a live test showed that near the
    // end the model treats the count as a cue to wrap up early.
    const keepGoing = 'The interview is not over: a separate closing turn comes later, so do not end the interview, say goodbye, or mention a report.';

    if (questionsAsked === 0) {
        return `This is the start of the interview and the candidate has not answered anything yet, so don't react to an answer. Greet them in a few words, then ask a simple opening question on topic 1 of ${INTERROGATION_TOPICS.length}: ${topic}.`;
    }
    if (isFollowUp) {
        return `Ask ONE simple follow-up on topic ${topicNumber} (${topic}) about something specific they just said. If they already covered it well, ask about a different simple detail of the same topic. Do not go deeper than this. ${keepGoing}`;
    }
    return `Move to topic ${topicNumber} of ${INTERROGATION_TOPICS.length}: ${topic}. Ask a fresh, simple opening question on this topic. Do not continue the previous topic. ${keepGoing}`;
};

const fallbackQuestion = (questionsAsked) =>
    FALLBACK_QUESTIONS[Math.min(Math.floor(questionsAsked / QUESTIONS_PER_TOPIC), FALLBACK_QUESTIONS.length - 1)];

// Safety net: if the model still writes a bracketed plan/guide/step note into
// its reply, drop it so it never reaches the stored transcript or the UI.
const LEAKED_NOTE = /\[\s*(interviewer guide|current step|interview plan|note)\b[^\]]*(\]|$)/gi;
const stripLeakedNotes = (text) => (text || '').replace(LEAKED_NOTE, '').replace(/\n{3,}/g, '\n\n').trim();

// True if a reply actually asks the candidate something. A live test showed
// the model sometimes replies with only a reaction ("Good, that's clear."),
// which stalls the interview, so the service regenerates such replies once.
const asksQuestion = (text) => /\?|\b(walk me through|tell me|explain|describe)\b/i.test(text || '');

// True if a reply tries to close the interview ("out of time", "feedback
// report", "End & Grade"). Only the final turn may do that.
const endsInterview = (text) =>
    /\b(out of time|wrap (things|this|it) up|wraps up|feedback report|end\s*&\s*grade|thank(s| you) for (walking|your time|talking))/i.test(text || '');

// A mid-interview reply is usable only if it asks something and doesn't
// try to end the interview. The closing turn is always accepted.
const isUsableReply = (text, questionsAsked) =>
    questionsAsked >= TOTAL_QUESTIONS || (asksQuestion(text) && !endsInterview(text));

module.exports = {
    INTERROGATION_TOPICS,
    QUESTIONS_PER_TOPIC,
    TOTAL_QUESTIONS,
    buildInterviewerGuide,
    stripLeakedNotes,
    asksQuestion,
    endsInterview,
    isUsableReply,
    fallbackQuestion
};
