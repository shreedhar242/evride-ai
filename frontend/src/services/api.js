import axios from "axios";

export const TOKEN_KEY = "evride_jwt";

const api = axios.create({
  // Set VITE_API_URL when the API is hosted on a different origin.
  // The relative fallback works with same-origin production reverse proxies.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

export default api;
