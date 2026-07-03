import axios from 'axios';

/**
 * Pre-configured axios instance for the admin API.
 * Uses Next.js rewrites to proxy /api/* → http://localhost:8001/api/*
 * (or whatever ADMIN_API_URL is set to).
 *
 * Attaches the JWT from localStorage on every request.
 */
export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('chymusic:admin-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('chymusic:admin-token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);
