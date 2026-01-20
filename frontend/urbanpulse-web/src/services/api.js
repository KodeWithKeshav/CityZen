export const API_BASE_URL = 'http://localhost:3001';

export const apiClient = {
  baseUrl: API_BASE_URL,
  health: API_BASE_URL + '/health',
  auth: { login: API_BASE_URL + '/api/auth/login', signup: API_BASE_URL + '/api/auth/signup' },
};

const getToken = () => localStorage.getItem('authToken');

export const makeApiCall = async (url, options = {}) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'HTTP ' + response.status);
  return data;
};

export const authStorage = {
  save: (token, user) => { localStorage.setItem('authToken', token); localStorage.setItem('userData', JSON.stringify(user)); },
  clear: () => { localStorage.removeItem('authToken'); localStorage.removeItem('userData'); },
  getUser: () => { const u = localStorage.getItem('userData'); return u ? JSON.parse(u) : null; },
  getToken: () => localStorage.getItem('authToken'),
  isLoggedIn: () => !!localStorage.getItem('authToken'),
};