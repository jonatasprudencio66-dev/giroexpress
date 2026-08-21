import axios from "axios";

export const BASE = import.meta.env.VITE_API_URL || "https://giroexpress-production.up.railway.app";
export const API_BASE = BASE;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
