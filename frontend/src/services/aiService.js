import api from "./api";

export const analyzeResume = async (resumeId) => {
  const response = await api.post("/ai/analyze", { resumeId });
  return response.data;
};

export const matchJob = async (resumeId, jobDescription) => {
  const response = await api.post("/job/match", { resumeId, jobDescription });
  return response.data;
};

export const getAnalysisHistory = async () => {
  const response = await api.get("/analysis/");
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await api.get("/analysis/stats");
  return response.data;
};