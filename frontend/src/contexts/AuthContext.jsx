// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";
import api, { setAuthToken } from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
// frontend/src/contexts/AuthContext.jsx (replace useEffect)
useEffect(() => {
  async function init() {
    const token = localStorage.getItem('token');
    if (!token) { setReady(true); return; }
    try {
      setAuthToken(token); // your helper to set axios default header
      // Try to fetch latest user from server
      const res = await api.get('/auth/me'); // requires valid token
      const serverUser = res.data?.user;
      if (serverUser) {
        // normalize keys if backend returns snake_case (optional)
        const normalized = {
          ...serverUser,
          // addressLine1: serverUser.addressLine1 || serverUser.addressline1
        };
        localStorage.setItem('user', JSON.stringify(normalized));
        setUser(normalized);
      } else {
        // fallback to stored user if server didn't return one
        const stored = JSON.parse(localStorage.getItem('user') || 'null');
        setUser(stored);
      }
    } catch (e) {
      console.warn('Failed to refresh user from server', e);
      // if token invalid, clear it
      // localStorage.removeItem('token'); localStorage.removeItem('user');
    } finally {
      setReady(true);
    }
  }
  init();
}, []);

  const login = (token, userData) => {
    if (token) {
      localStorage.setItem("token", token);
      setAuthToken(token);
    }
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
    }
  };

const logout = () => {
  console.trace("AuthContext.logout() called"); // <--- debug: shows stack where logout invoked
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  setAuthToken(null);
  setUser(null);
};


  const isAdmin = () => user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, ready }}>
      {children}
    </AuthContext.Provider>
  );
}
