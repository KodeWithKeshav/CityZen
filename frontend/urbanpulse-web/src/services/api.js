// CityZen API Service Layer
// Handles all backend communication for auth, complaints, admin, and AI services

const RENDER_BACKEND_URL = 'https://urbanpulse-backend-cb7e.onrender.com';

const inferApiBaseUrl = () => {
  const fromEnv = import.meta.env?.VITE_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, ''); // strip trailing slash

  // In production (deployed on Vercel), always use the Render backend
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return RENDER_BACKEND_URL;
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
    password: `${API_BASE_URL}/api/auth/password`,
    deleteAccount: `${API_BASE_URL}/api/auth/account`,
  },

  complaints: {
    all: `${API_BASE_URL}/api/complaints/all`,
    submit: `${API_BASE_URL}/api/complaints/submit`,
    analyzeText: `${API_BASE_URL}/api/complaints/analyze-text`,
    personalReports: `${API_BASE_URL}/api/complaints/personal-reports`,
    byId: (id) => `${API_BASE_URL}/api/complaint-details/${id}`,
    progress: (id) => `${API_BASE_URL}/api/complaint-details/${id}/progress`,
    vote: () => `${API_BASE_URL}/api/complaints/vote`,
    updateStatus: (id) => `${API_BASE_URL}/api/admin/complaints/${id}/status`,
    reopen: (id) => `${API_BASE_URL}/api/complaints/${id}/reopen`,
  },

  admin: {
    dashboard: `${API_BASE_URL}/api/admin/dashboard`,
    complaintById: (id) => `${API_BASE_URL}/api/admin/complaints/${id}`,
    priorityQueue: `${API_BASE_URL}/api/admin-enhanced/complaints/priority-queue`,
    citizens: `${API_BASE_URL}/api/admin-enhanced/citizens`,
    citizenById: (id) => `${API_BASE_URL}/api/admin-enhanced/citizens/${id}/details`,
    citizenStatus: (id) => `${API_BASE_URL}/api/admin-enhanced/citizens/${id}/status`,
    deleteCitizen: (id) => `${API_BASE_URL}/api/admin-enhanced/citizens/${id}`,
    workflowDetails: (id) => `${API_BASE_URL}/api/admin-enhanced/complaints/${id}/details`,
    workflowStage: (id, stageId) => `${API_BASE_URL}/api/admin-enhanced/complaints/${id}/stage/${stageId}`,
    escalate: (id) => `${API_BASE_URL}/api/admin-enhanced/complaints/${id}/escalate`,
    departments: `${API_BASE_URL}/api/admin-enhanced/departments`,
    contractors: `${API_BASE_URL}/api/admin-enhanced/contractors`,
    contractorStatus: (id) => `${API_BASE_URL}/api/admin-enhanced/contractors/${id}/status`,
  },

  imageAnalysis: {
    validate: `${API_BASE_URL}/api/image-analysis/validate-image`,
    explain: `${API_BASE_URL}/api/image-analysis/explain`,
    estimateGeometry: `${API_BASE_URL}/api/image-analysis/estimate-geometry`,
  },

  locationPriority: {
    calculate: `${API_BASE_URL}/api/location-priority/calculate`,
    comprehensive: `${API_BASE_URL}/api/location-priority/comprehensive`,
  },

  heatMap: {
    data: `${API_BASE_URL}/api/heat-map/data`,
    statistics: `${API_BASE_URL}/api/heat-map/statistics`,
  },

  chatbot: {
    message: `${API_BASE_URL}/api/chatbot/message`,
  },

  transcribe: {
    audio: `${API_BASE_URL}/api/transcribe/audio`,
  },

  translate: {
    batch: `${API_BASE_URL}/api/translate/batch`,
    text: `${API_BASE_URL}/api/translate/text`,
  },

  transparency: {
    data: `${API_BASE_URL}/api/transparency/dashboard`,
  },

  feedback: {
    submit: `${API_BASE_URL}/api/feedback/submit`,
    stats: `${API_BASE_URL}/api/feedback/stats`,
  },
};

const buildDefaultHeaders = (token, isFormData = false) => ({
  ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

// Generous enough to outlast the backend's own worst-case retry/backoff
// window on slow endpoints (e.g. image validation: up to 3 Roboflow
// attempts x 20s, with exponential backoff between them) -- without this,
// a dropped/hung connection (dev server restart mid-request, network
// blip) leaves `fetch` pending forever and the caller's loading state
// stuck with no error ever surfacing.
const DEFAULT_TIMEOUT_MS = 90000;

export const makeApiCall = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const token = authStorage.getToken();
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const { timeoutMs, ...fetchOptions } = options;
    const response = await fetch(url, {
      ...fetchOptions,
      signal: options.signal || controller.signal,
      headers: {
        ...buildDefaultHeaders(token, isFormData),
        ...(options.headers || {}),
      },
    });

    const contentType = response.headers?.get?.('content-type') || '';
    let payload = {};
    if (contentType.includes('application/json') || (!contentType && typeof response.json === 'function')) {
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
    } else if (typeof response.text === 'function') {
      const text = await response.text();
      payload = text ? { message: text } : {};
    }

    if (!response.ok) {
      const message = payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request timed out. Please check your connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const authStorage = {
  save: (token, user) => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
    if (user !== undefined && user !== null) {
      localStorage.setItem('userData', JSON.stringify(user));
    } else {
      localStorage.removeItem('userData');
    }
  },
  clear: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
  },
  getUser: () => {
    const u = localStorage.getItem('userData');
    if (!u || u === 'undefined' || u === 'null') return null;
    try {
      return JSON.parse(u);
    } catch {
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      return null;
    }
  },
  getToken: () => {
    const token = localStorage.getItem('authToken');
    if (!token || token === 'undefined' || token === 'null') return null;
    return token;
  },
  isLoggedIn: () => !!authStorage.getToken(),
};