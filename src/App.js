import React from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

import StoreDashboard from "@/pages/StoreDashboard";
import CourierDashboard from "@/pages/CourierDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

/* ============================================================
   TELA DE CARREGAMENTO
============================================================ */

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#020617",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Loader2
          size={32}
          style={{
            animation: "spin 1s linear infinite",
          }}
        />

        <div
          style={{
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          Carregando GiroExpress...
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DESTINO DE ACORDO COM O PERFIL
============================================================ */

function getRoleDestination(user) {
  if (!user) {
    return "/login";
  }

  const role = String(user.role || "")
    .trim()
    .toLowerCase();

  if (role === "admin") {
    return "/admin";
  }

  if (
    role === "courier" ||
    role === "deliveryman" ||
    role === "motoboy" ||
    role === "moto" ||
    role === "entregador"
  ) {
    return "/motoboy";
  }

  if (
    role === "store" ||
    role === "loja" ||
    role === "merchant"
  ) {
    return "/loja";
  }

  return "/login";
}

/* ============================================================
   ROTA PROTEGIDA
============================================================ */

function ProtectedRoute({
  role,
  children,
}) {
  const { user } = useAuth();

  /* Ainda verificando a sessão */
  if (user === undefined) {
    return <LoadingScreen />;
  }

  /* Não autenticado */
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const currentRole = String(
    user.role || ""
  )
    .trim()
    .toLowerCase();

  const expectedRole = String(
    role || ""
  )
    .trim()
    .toLowerCase();

  /* Perfil correto */
  if (
    !expectedRole ||
    currentRole === expectedRole
  ) {
    return children;
  }

  /* Perfil diferente: manda para o painel correto */
  return (
    <Navigate
      to={getRoleDestination(user)}
      replace
    />
  );
}

/* ============================================================
   REDIRECIONAMENTO PRINCIPAL
============================================================ */

function RoleRedirect() {
  const { user } = useAuth();

  if (user === undefined) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <Navigate
      to={getRoleDestination(user)}
      replace
    />
  );
}

/* ============================================================
   ROTAS
============================================================ */

function AppRoutes() {
  return (
    <Routes>

      {/* Página inicial */}
      <Route
        path="/"
        element={<RoleRedirect />}
      />

      {/* Autenticação */}
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />

      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* ======================================================
          LOJA
      ====================================================== */}

      <Route
        path="/loja"
        element={
          <ProtectedRoute role="store">
            <StoreDashboard />
          </ProtectedRoute>
        }
      />

      {/* ======================================================
          MOTOBOY / ENTREGADOR
      ====================================================== */}

      <Route
        path="/motoboy"
        element={
          <ProtectedRoute role="courier">
            <CourierDashboard />
          </ProtectedRoute>
        }
      />

      {/* ======================================================
          ADMIN
      ====================================================== */}

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Qualquer rota desconhecida */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

/* ============================================================
   APP PRINCIPAL
============================================================ */

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />

        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
        />
      </HashRouter>
    </AuthProvider>
  );
}