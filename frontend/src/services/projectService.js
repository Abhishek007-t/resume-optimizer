import api from "./api";

export const extractProjects = async (resumeId) => {
  const response = await api.post("/projects/extract", { resumeId });
  return response.data;
};

export const startInterrogation = async (resumeId, projectTitle) => {
  const response = await api.post("/projects/interrogate/start", { resumeId, projectTitle });
  return response.data;
};

export const replyToInterrogation = async (interrogationId, message) => {
  const response = await api.post(`/projects/interrogate/${interrogationId}/reply`, { message });
  return response.data;
};

export const finishInterrogation = async (interrogationId) => {
  const response = await api.post(`/projects/interrogate/${interrogationId}/finish`);
  return response.data;
};

export const getInterrogation = async (interrogationId) => {
  const response = await api.get(`/projects/interrogate/${interrogationId}`);
  return response.data;
};

export const listInterrogations = async () => {
  const response = await api.get("/projects/interrogate");
  return response.data;
};
