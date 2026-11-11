import api from "./api";

export const startInterview = async (resumeId, jobDescription, roundType, focusProjectTitle) => {
  const response = await api.post("/interview/start", { resumeId, jobDescription, roundType, focusProjectTitle });
  return response.data;
};

export const submitAnswer = async (sessionId, questionIndex, answer) => {
  const response = await api.post(`/interview/${sessionId}/answer`, { questionIndex, answer });
  return response.data;
};

export const finishInterview = async (sessionId) => {
  const response = await api.post(`/interview/${sessionId}/finish`);
  return response.data;
};

export const getInterviewSession = async (sessionId) => {
  const response = await api.get(`/interview/${sessionId}`);
  return response.data;
};

export const listInterviewSessions = async () => {
  const response = await api.get("/interview");
  return response.data;
};
