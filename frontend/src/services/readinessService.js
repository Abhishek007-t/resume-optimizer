import api from "./api";

export const getReadiness = async () => {
  const response = await api.get("/readiness");
  return response.data;
};
