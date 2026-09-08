
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, apiError } from "@/lib/api";

const AuthCtx = createContext(null);

function normalizeUser(data) {
  if (!data) {
    return null;
  }

  const source = data.user || data;

  if (!source || typeof source !== "object") {
    return null;
  }

  const user = {
    ...source,
  };

  const role = String(user.role || "")
    .trim()
    .toLowerCase();

  if (
    role === "loja" ||
    role === "store" ||
    role === "merchant"
  ) {
    user.role = "store";
  } else if (
    role === "motoboy" ||
    role === "moto" ||
    role === "courier" ||
    role === "deliveryman" ||
    role === "entregador"
  ) {
    user.role = "courier";
  } else if (
    role === "admin" ||
    role === "administrator"
  ) {
    user.role = "admin";
  }

  if (!user.id && user._id) {
    user.id = String(user._id);
  }

  if (!user._id && user.id) {
    user._id = String(user.id);
  }

  return user;
}

function usersAreEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return a === b;
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(undefined);
  const [error, setError] = useState(null);

  const setUser = useCallback((nextUser) => {
    setUserState((currentUser) => {
      if (usersAreEqual(currentUser, nextUser)) {
        return currentUser;
      }

      return nextUser;
    });
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("giro_token");

    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");
      const userData = normalizeUser(response.data);

      if (!userData) {
        localStorage.removeItem("giro_token");
        localStorage.removeItem("user");
        setUser(null);
        return null;
      }

      localStorage.setItem(
        "user",
        JSON.stringify(userData)
      );

      setUser(userData);

      return userData;
    } catch (e) {
      console.error(
        "[GiroExpress] Erro ao restaurar sessão:",
        e
      );

      localStorage.removeItem("giro_token");
      localStorage.removeItem("user");

      setUser(null);

      return null;
    }
  }, [setUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email, password) => {
      setError(null);

      try {
        const cleanEmail = String(email || "")
          .trim()
          .toLowerCase();

        if (!cleanEmail) {
          throw new Error("Informe o e-mail.");
        }

        if (!password) {
          throw new Error("Informe a senha.");
        }

        const response = await api.post(
          "/auth/login",
          {
            email: cleanEmail,
            password,
          }
        );

        const data = response.data;

        if (!data || !data.access_token) {
          throw new Error(
            "A API não retornou o token de autenticação."
          );
        }

        const userData = normalizeUser(data);

        if (!userData) {
          throw new Error(
            "Usuário não retornado pela API."
          );
        }

        localStorage.setItem(
          "giro_token",
          data.access_token
        );

        localStorage.setItem(
          "user",
          JSON.stringify(userData)
        );

        setUser(userData);

        return userData;
      } catch (e) {
        const message =
          e && e.response
            ? apiError(e)
            : e?.message || "Erro ao realizar login.";

        console.error(
          "[GiroExpress] Erro no login:",
          message
        );

        setError(message);

        throw new Error(message);
      }
    },
    [setUser]
  );

  const register = useCallback(
    async (payload) => {
      setError(null);

      try {
        if (!payload || typeof payload !== "object") {
          throw new Error(
            "Dados de cadastro inválidos."
          );
        }

        const cleanPayload = {
          name: String(payload.name || "").trim(),

          email: String(payload.email || "")
            .trim()
            .toLowerCase(),

          password: String(payload.password || ""),

          role: String(payload.role || "")
            .trim()
            .toLowerCase(),

          phone: payload.phone
            ? String(payload.phone).trim()
            : null,

          address: payload.address
            ? String(payload.address).trim()
            : null,

          vehicle: payload.vehicle
            ? String(payload.vehicle).trim()
            : null,

          allow_batch: payload.allow_batch !== false,
        };

        if (!cleanPayload.name) {
          throw new Error("Informe o nome.");
        }

        if (!cleanPayload.email) {
          throw new Error("Informe o e-mail.");
        }

        if (cleanPayload.password.length < 6) {
          throw new Error(
            "A senha deve ter pelo menos 6 caracteres."
          );
        }

        if (
          cleanPayload.role !== "store" &&
          cleanPayload.role !== "courier"
        ) {
          throw new Error(
            "Selecione Loja ou Motoboy."
          );
        }

        console.log(
          "[GiroExpress] Cadastro:",
          cleanPayload.email,
          cleanPayload.role
        );

        const response = await api.post(
          "/auth/register",
          cleanPayload
        );

        const data = response.data;

        console.log(
          "[GiroExpress] Resposta cadastro:",
          data
        );

        if (!data || !data.access_token) {
          throw new Error(
            "Cadastro realizado, mas a API não retornou o token de acesso."
          );
        }

        const userData = normalizeUser(data);

        if (!userData) {
          throw new Error(
            "Cadastro realizado, mas o usuário não foi retornado pela API."
          );
        }

        localStorage.setItem(
          "giro_token",
          data.access_token
        );

        localStorage.setItem(
          "user",
          JSON.stringify(userData)
        );

        setUser(userData);

        return userData;
      } catch (e) {
        const message =
          e && e.response
            ? apiError(e)
            : e?.message || "Erro ao realizar cadastro.";

        console.error(
          "[GiroExpress] Erro no cadastro:",
          message
        );

        setError(message);

        throw new Error(message);
      }
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.warn(
        "[GiroExpress] Erro no logout da API:",
        e
      );
    }

    localStorage.removeItem("giro_token");
    localStorage.removeItem("user");

    setUser(null);
    setError(null);
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      error,
      login,
      register,
      logout,
      refresh,
      setUser,
    }),
    [
      user,
      error,
      login,
      register,
      logout,
      refresh,
      setUser,
    ]
  );

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthCtx);

  if (!context) {
    throw new Error(
      "useAuth deve ser usado dentro de um AuthProvider."
    );
  }

  return context;
}

