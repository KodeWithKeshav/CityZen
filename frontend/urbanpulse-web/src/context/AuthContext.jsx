import { createContext, useContext, useState, useEffect } from 'react';
import { authStorage } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const u = authStorage.getUser(); if (u && authStorage.getToken()) setUser(u); setLoading(false); }, []);
  const login = (token, userData) => { authStorage.save(token, userData); setUser(userData); };
  const logout = () => { authStorage.clear(); setUser(null); };
  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);