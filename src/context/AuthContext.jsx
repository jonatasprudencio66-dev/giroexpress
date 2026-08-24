import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauth, obj = auth
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (e) {
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
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = apiError(e);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    localStorage.removeItem("giro_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, error, login, register, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
