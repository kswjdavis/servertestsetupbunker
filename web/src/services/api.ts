import axios, { AxiosError } from 'axios';

// Use relative URL if VITE_API_URL is empty (for Docker/nginx proxy)
// Otherwise use the configured URL or fallback to localhost
const envApiUrl = import.meta.env.VITE_API_URL;
const API_URL = envApiUrl === '' ? '' : (envApiUrl || 'http://localhost:8000');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token');
      localStorage.removeItem('current_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;