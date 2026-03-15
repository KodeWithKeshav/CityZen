// UrbanPulse API Service Layer
// Handles all backend communication for auth, complaints, admin, and AI services

const inferApiBaseUrl = () => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
};

export const API_BASE_URL = inferApiBaseUrl();

export const apiClient = {
  baseUrl: API_BASE_URL,
  health: `${API_BASE_URL}/health`,

  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    signup: `${API_BASE_URL}/api/auth/signup`,
    profile: `${API_BASE_URL}/api/auth/profile`,
  },

  complaints: {
    all: `${API_BASE_URL}/api/complaints/all`,
    submit: `${API_BASE_URL}/api/complaints/submit`,
    personalReports: `${API_BASE_URL}/api/complaints/personal-reports`,
    byId: (id) => `${API_BASE_URL}/api/complaint-details/${id}`,
    progress: (id) => `${API_BASE_URL}/api/complaint-details/${id}/progress`,
    vote: () => `${API_BASE_URL}/api/complaints/vote`,
    updateStatus: (id) => `${API_BASE_URL}/api/admin/complaints/${id}/status`,
  },

  admin: {
    dashboard: `${API_BASE_URL}/api/admin/dashboard`,
    complaintById: (id) => `${API_BASE_URL}/api/admin/complaints/${id}`,
    priorityQueue: `${API_BASE_URL}/api/admin-enhanced/complaints/priority-queue`,
    citizens: `${API_BASE_URL}/api/admin-enhanced/citizens`,
    citizenById: (id) => `${API_BASE_URL}/api/admin-enhanced/citizens/${id}/details`,
  },

  imageAnalysis: {
    validate: `${API_BASE_URL}/api/image-analysis/validate-image`,
  },

  heatMap: {
    data: `${API_BASE_URL}/api/heat-map/data`,
    statistics: `${API_BASE_URL}/api/heat-map/statistics`,
  },

  chatbot: {
    message: `${API_BASE_URL}/api/chatbot/message`,
  },

  transparency: {
    data: `${API_BASE_URL}/api/transparency/dashboard`,
  },

  feedback: {
    submit: `${API_BASE_URL}/api/feedback/submit`,
    stats: `${API_BASE_URL}/api/feedback/stats`,
  },
};

const getToken = () => localStorage.getItem('authToken');

const buildDefaultHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const makeApiCall = async (url, options = {}) => {
  try {
    const token = getToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...buildDefaultHeaders(token),
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : { message: await response.text() };

    if (!response.ok) {
      const message = payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Cannot connect to backend. Start UrbanPulse_Backend on port 3001 and try again.');
    }
    throw error;
  }
};

export const authStorage = {
  save: (token, user) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  },
  getUser: () => {
    const u = localStorage.getItem('userData');
    return u ? JSON.parse(u) : null;
  },
  getToken: () => localStorage.getItem('authToken'),
  isLoggedIn: () => !!localStorage.getItem('authToken'),
};