import api from "./api";

export const parseResumeIntoBuilder = async (resumeId, force = false) => {
  const response = await api.post("/builder/parse", { resumeId, force });
  return response.data;
};

export const saveBuilderResume = async (resumeId, structuredResume, projects) => {
  const response = await api.put(`/builder/${resumeId}`, { structuredResume, projects });
  return response.data;
};

export const improveBuilderField = async (resumeId, fieldLabel, currentText, contextHint) => {
  const response = await api.post(`/builder/${resumeId}/improve`, { fieldLabel, currentText, contextHint });
  return response.data;
};

export const uploadCertification = async (resumeId, file) => {
  const formData = new FormData();
  formData.append("certificate", file);
  const response = await api.post(`/builder/${resumeId}/certifications/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};
