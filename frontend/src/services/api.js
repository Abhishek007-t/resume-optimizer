import axios from "axios";
import { getToken, clearAuth } from "../utils/storage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Request interceptor - attach auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearAuth();
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;