import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const storedUser = localStorage.getItem("wttsUser");
  if (!storedUser) return config;

  try {
    const parsed = JSON.parse(storedUser);
    if (parsed?.id) {
      config.headers["x-demo-user-id"] = String(parsed.id);
    }
  } catch (_error) {
    // Ignore malformed local storage values.
  }

  return config;
});

export default api;
