import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authStorage } from '../services/api';

const AuthContext = createContext(null);

function isJwtExpired(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.exp === 'number') {
      return Date.now() >= payload.exp * 1000;
    }
    return false;
  } catch {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrateFromStorage = useCallback(() => {
    try {
      const u = authStorage.getUser();
      const token = authStorage.getToken();
      if (u && token && !isJwtExpired(token)) {
        setUser(u);
      } else {
        if (u || token) {
          authStorage.clear();
        }
        setUser(null);
      }
    } catch {
      authStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateFromStorage();

    const handleStorage = (e) => {
      if (e.key === null || e.key === 'authToken' || e.key === 'userData') {
        hydrateFromStorage();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [hydrateFromStorage]);

  const login = useCallback((token, userData) => {
    authStorage.save(token, userData);
    setUser(userData ?? null);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};