import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauth, obj = auth
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const token = localStorage.getItem("giro_token");
      if (!token) {
        setUser(null);
        return null;
      }

      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        return parsedUser;
      }

      const { data } = await api.get("/auth/me"); // Corrigido de /api/auth/me para /auth/me
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
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
      const { data } = await api.post("/auth/login", { email, password }); // Corrigido de /api/auth/login para /auth/login
      if (data.access_token) localStorage.setItem("giro_token", data.access_token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
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
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = apiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {} // Corrigido de /api/auth/logout para /auth/logout
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