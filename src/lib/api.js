import axios from "axios";

/*
 * ============================================================
 * CONFIGURAÇÃO DA API
 * ============================================================
 *
 * LOCAL:
 *   http://localhost:8000/api
 *   http://192.168.0.110:8000/api
 *
 * VERCEL:
 *   /api
 *
 * No Vercel, o frontend e o FastAPI ficam no mesmo domínio.
 * Por isso NÃO devemos acrescentar :8000 em produção.
 */

const hostname = window.location.hostname;
const protocol = window.location.protocol;

const isLocalhost =
  hostname === "localhost" ||
  hostname === "127.0.0.1";

const isVercel =
  hostname.endsWith(".vercel.app");

/*
 * ============================================================
 * API HOST
 * ============================================================
 *
 * Local:
 *   http://localhost:8000
 *   http://192.168.0.110:8000
 *
 * Vercel:
 *   "" (usa o próprio domínio)
 */

export const API_HOST = isVercel
  ? ""
  : `${protocol === "https:" ? "https" : "http"}://${hostname}:8000`;

/*
 * ============================================================
 * API BASE
 * ============================================================
 *
 * Vercel:
 *   /api
 *
 * Local:
 *   http://localhost:8000/api
 *   http://192.168.0.110:8000/api
 */

export const API_BASE = `${API_HOST}/api`;

/*
 * ============================================================
 * LOG DE CONFIGURAÇÃO
 * ============================================================
 */

console.log(
  "[GiroExpress] Frontend hostname:",
  hostname
);

console.log(
  "[GiroExpress] API_HOST:",
  API_HOST
);

console.log(
  "[GiroExpress] API_BASE:",
  API_BASE
);

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

      config.headers.Authorization =
        `Bearer ${token}`;
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
      error?.response?.data ||
        error?.message
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
  const detail =
    err?.response?.data?.detail;

  if (detail == null) {
    return (
      err?.message ||
      "Erro desconhecido."
    );
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
 * LOCAL:
 *   ws://localhost:8000/ws/...
 *   ws://192.168.0.110:8000/ws/...
 *
 * VERCEL:
 *   wss://giroexpress-9ufp.vercel.app/ws/...
 *
 * No Vercel não usamos :8000.
 */

export function createUserWebSocket(userId) {
  if (!userId) {
    console.warn(
      "[GiroExpress] ID do usuário não informado para WebSocket."
    );

    return null;
  }

  const hostname =
    window.location.hostname;

  const wsProtocol =
    window.location.protocol === "https:"
      ? "wss:"
      : "ws:";

  /*
   * No Vercel:
   *   hostname
   *
   * Local:
   *   hostname:8000
   */

  const isProduction =
    hostname.endsWith(".vercel.app");

  const host = isProduction
    ? hostname
    : `${hostname}:8000`;

  const url =
    `${wsProtocol}//${host}/ws/${userId}`;

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