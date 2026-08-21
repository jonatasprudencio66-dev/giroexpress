import axios from "axios";

export const BASE = "https://giroexpress-production.up.railway.app";
export const API_BASE = BASE;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("giro_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function apiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Erro desconhecido.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e.msg ? e.msg : JSON.stringify(e)).join(" ");
  if (d?.msg) return d.msg;
  return String(d);
}

