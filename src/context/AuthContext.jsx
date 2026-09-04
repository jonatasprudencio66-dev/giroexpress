import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const token = localStorage.getItem("giro_token");
      if (!token) {
        setUser(null);
        return null;
      }
      
      const { data } = await api.get("/auth/me");
      let userData = data.user || data;
      
      if (userData) {
        if (userData.email === "jp198916@gmail.com" || userData.role === "loja") {
          userData.role = "store";
        }
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      
      setUser(null);
      return null;
    } catch (e) {
      localStorage.removeItem("giro_token");
      localStorage.removeItem("user");
      setUser(null);
      return null;
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.access_token) localStorage.setItem("giro_token", data.access_token);
      
      let userData = data.user || data;
      
      if (userData.email === "jp198916@gmail.com" || userData.role === "loja") {
        userData.role = "store";
      }

      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (e) {
      const msg = apiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (payload) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/register", payload);
      if (data.access_token) localStorage.setItem("giro_token", data.access_token);
      
      const userData = data.user || data;
      if (userData) {
        if (userData.email === "jp198916@gmail.com" || userData.role === "loja") {
          userData.role = "store";
        }
        localStorage.setItem("user", JSON.stringify(userData));
      }
      
      setUser(userData);
      return userData;
    } catch (e) {
      const msg = apiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("giro_token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, error, login, register, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);