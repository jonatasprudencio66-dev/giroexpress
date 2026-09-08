import axios from "axios";

/*
 * ============================================================
 * CONFIGURAÇÃO DA API - GIROEXPRESS
 * ============================================================
 *
 * AMBIENTE LOCAL:
 *   http://localhost:8000/api
 *   http://192.168.0.110:8000/api
 *
 * VERCEL:
 *   /api
 *
 * APK ANDROID:
 *   https://giroexpress-9ufp.vercel.app/api
 *
 * IMPORTANTE:
 * No Android/Capacitor o hostname da aplicação NÃO é
 * necessariamente o domínio da Vercel.
 *
 * Por isso o APK precisa ser identificado separadamente.
 */

/* ============================================================
   INFORMAÇÕES DO AMBIENTE
============================================================ */

const hostname =
  typeof window !== "undefined"
    ? window.location.hostname
    : "";

const protocol =
  typeof window !== "undefined"
    ? window.location.protocol
    : "http:";

/*
 * ============================================================
 * DETECÇÃO DO AMBIENTE
============================================================ */

const isLocalhost =
  hostname === "localhost" ||
  hostname === "127.0.0.1";

const isVercel =
  hostname.endsWith(".vercel.app");

/*
 * Capacitor / Android / iOS
 *
 * O Capacitor pode utilizar:
 *   capacitor://localhost
 *   http://localhost
 *   https://localhost
 *
 * Portanto, além de verificar o hostname, verificamos também
 * a existência do objeto Capacitor no navegador.
 */

const isCapacitor =
  typeof window !== "undefined" &&
  (
    window.Capacitor !== undefined ||
    window.location.protocol === "capacitor:"
  );

/*
 * ============================================================
 * URL FIXA DA API EM PRODUÇÃO
============================================================ */

const PRODUCTION_API =
  "https://giroexpress-9ufp.vercel.app";

/*
 * ============================================================
 * API HOST
============================================================ */

let apiHost;

/*
 * APK / CAPACITOR
 *
 * Sempre usa a API pública da Vercel.
 */

if (isCapacitor) {
  apiHost = PRODUCTION_API;
}

/*
 * VERCEL
 *
 * Frontend e backend ficam no mesmo domínio.
 */

else if (isVercel) {
  apiHost = "";
}

/*
 * LOCAL
 *
 * Usa o mesmo hostname da máquina onde o navegador está
 * executando.
 *
 * Exemplos:
 *
 * localhost:
 *   http://localhost:8000
 *
 * rede local:
 *   http://192.168.0.110:8000
 */

else {
  apiHost =
    `${protocol === "https:" ? "https" : "http"}://${hostname}:8000`;
}

/*
 * ============================================================
 * API BASE
============================================================ */

export const API_HOST = apiHost;

export const API_BASE =
  `${API_HOST}/api`;

/*
 * ============================================================
 * LOG DE CONFIGURAÇÃO
============================================================ */

console.log(
  "[GiroExpress] Frontend hostname:",
  hostname
);

console.log(
  "[GiroExpress] Protocolo:",
  protocol
);

console.log(
  "[GiroExpress] Capacitor:",
  isCapacitor
);

console.log(
  "[GiroExpress] Vercel:",
  isVercel
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
============================================================ */

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
============================================================ */

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("giro_token");

    if (token) {
      config.headers =
        config.headers || {};

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
============================================================ */

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
============================================================ */

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
 * APK:
 *   wss://giroexpress-9ufp.vercel.app/ws/...
 *
 * VERCEL:
 *   wss://giroexpress-9ufp.vercel.app/ws/...
 *
 * LOCAL:
 *   ws://localhost:8000/ws/...
 *   ws://192.168.0.110:8000/ws/...
 */

export function createUserWebSocket(userId) {
  if (!userId) {
    console.warn(
      "[GiroExpress] ID do usuário não informado para WebSocket."
    );

    return null;
  }

  const currentHostname =
    typeof window !== "undefined"
      ? window.location.hostname
      : "";

  const currentProtocol =
    typeof window !== "undefined"
      ? window.location.protocol
      : "http:";

  const production =
    isCapacitor || isVercel;

  /*
   * ==========================================================
   * PRODUÇÃO / APK
   * ==========================================================
   */

  if (production) {
    const url =
      `wss://giroexpress-9ufp.vercel.app/ws/${userId}`;

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

  /*
   * ==========================================================
   * LOCAL
   * ==========================================================
   */

  const wsProtocol =
    currentProtocol === "https:"
      ? "wss:"
      : "ws:";

  const host =
    `${currentHostname}:8000`;

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