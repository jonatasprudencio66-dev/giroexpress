import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import StoreDashboard from "@/pages/StoreDashboard";
import CourierDashboard from "@/pages/CourierDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  );
}

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (user === undefined) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const dest = user.role === "admin" ? "/admin" : user.role === "courier" ? "/motoboy" : "/loja";
    return <Navigate to={dest} replace />;
  }
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (user === undefined) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const dest = user.role === "admin" ? "/admin" : user.role === "courier" ? "/motoboy" : "/loja";
  return <Navigate to={dest} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/loja" element={<ProtectedRoute role="store"><StoreDashboard /></ProtectedRoute>} />
      <Route path="/motoboy" element={<ProtectedRoute role="courier"><CourierDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}
