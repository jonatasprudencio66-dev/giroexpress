
import axios from "axios";

/*
 * ============================================================
 * CONFIGURAÇÃO DA API
 * ============================================================
 *
 * O frontend e o backend podem estar:
 *
 * 1. No mesmo computador:
 *    http://localhost:8000
 *
 * 2. Em outro dispositivo da rede local:
 *    http://192.168.0.110:8000
 *
 * 3. Em produção:
 *    https://seu-dominio.com
 *
 * A API acompanha automaticamente o hostname usado
 * para abrir o frontend.
 */

const hostname = window.location.hostname;
const protocol = window.location.protocol;

/*
 * Quando o frontend está sendo acessado por localhost,
 * usamos localhost no backend.
 *
 * Quando está sendo acessado pelo IP da rede,
 * usamos o mesmo IP no backend.
 */
export const API_HOST =
  hostname === "localhost" || hostname === "127.0.0.1"
    ? `${protocol === "https:" ? "https" : "http"}://${hostname}:8000`
    : `${protocol === "https:" ? "https" : "http"}://${hostname}:8000`;

export const API_BASE = `${API_HOST}/api`;

/*
 * ============================================================
 * LOG DE CONFIGURAÇÃO
 * ============================================================
 */

console.log("[GiroExpress] Frontend hostname:", hostname);
console.log("[GiroExpress] API_HOST:", API_HOST);
console.log("[GiroExpress] API_BASE:", API_BASE);

/*
 * ============================================================
 * AXIOS
 * ============================================================
 */

export const api = axios.create({
  baseURL: API_BASE,

  headers: {
    "Content-Type": "application/json",
  },

  timeout: 15000,
});

/*
 * ============================================================
 * TOKEN DE AUTENTICAÇÃO
 * ============================================================
 */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("giro_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      "[GiroExpress] API:",
      config.method?.toUpperCase(),
      config.url
    );

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/*
 * ============================================================
 * TRATAMENTO DE RESPOSTA
 * ============================================================
 */

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error(
      "[GiroExpress] Erro API:",
      error?.response?.status,
      error?.response?.data || error?.message
    );

    return Promise.reject(error);
  }
);

/*
 * ============================================================
 * TRATAMENTO DE ERROS
 * ============================================================
 */

export function apiError(err) {
  const detail = err?.response?.data?.detail;

  if (detail == null) {
    return err?.message || "Erro desconhecido.";
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item?.msg) {
          return item.msg;
        }

        return JSON.stringify(item);
      })
      .join(" ");
  }

  if (detail?.msg) {
    return detail.msg;
  }

  return String(detail);
}

/*
 * ============================================================
 * WEBSOCKET
 * ============================================================
 *
 * O frontend pode estar em:
 *
 * http://localhost:3000
 * http://192.168.0.110:3000
 *
 * E o FastAPI:
 *
 * http://localhost:8000
 * http://192.168.0.110:8000
 *
 * O WebSocket usa automaticamente o mesmo hostname
 * utilizado pelo frontend.
 */

export function createUserWebSocket(userId) {
  if (!userId) {
    console.warn(
      "[GiroExpress] ID do usuário não informado para WebSocket."
    );

    return null;
  }

  const hostname = window.location.hostname;

  const wsProtocol =
    window.location.protocol === "https:"
      ? "wss:"
      : "ws:";

  const host = `${hostname}:8000`;

  const url = `${wsProtocol}//${host}/ws/${userId}`;

  console.log(
    "[GiroExpress] Conectando WebSocket:",
    url
  );

  try {
    return new WebSocket(url);
  } catch (error) {
    console.error(
      "[GiroExpress] Erro ao criar WebSocket:",
      error
    );

    return null;
  }
}


