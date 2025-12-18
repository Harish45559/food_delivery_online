import { createContext, useState, useEffect } from "react";
import api, { setAuthToken } from "../services/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setReady(true);
        return;
      }

      try {
        setAuthToken(token);

        // Fetch latest user from backend
        const res = await api.get("/auth/me");
        const serverUser = res.data?.user || null;

        if (serverUser && mounted) {
          localStorage.setItem("user", JSON.stringify(serverUser));
          setUser(serverUser);
        } else if (mounted) {
          const stored = JSON.parse(localStorage.getItem("user") || "null");
          setUser(stored);
        }
      } catch (e) {
        console.warn("Auth init failed, token may be invalid", e);
        // optional hard logout:
        // localStorage.removeItem("token");
        // localStorage.removeItem("user");
      } finally {
        if (mounted) setReady(true);
      }
    }

    init();
    return () => {
      mounted = false;
    };
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

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
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
