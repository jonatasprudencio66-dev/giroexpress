import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";

const LOGO = "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function Layout({ children, right = null, subtitle }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const roleLabel = { store: "LOJA", courier: "MOTOBOY", admin: "ADMIN MASTER" }[user?.role] || "";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3" data-testid="brand-header">
          <img src={LOGO} alt="GiroExpress" className="h-14 sm:h-16 w-auto rounded-xl bg-white p-1 shadow-lg shadow-orange-500/20" />
          <div className="hidden sm:block">
            <span className="text-[10px] bg-slate-800 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-bold">{roleLabel}</span>
            <p className="text-xs text-slate-400 mt-1">{subtitle || "Plataforma de Entregas Sob Demanda"}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {right}
          <div className="hidden md:flex flex-col items-end">
            <span data-testid="current-user-name" className="text-sm font-bold text-white">{user?.name}</span>
            <span className="text-[10px] text-slate-400">{user?.email}</span>
          </div>
          <button data-testid="logout-btn" onClick={async () => { await logout(); nav("/login"); }} className="bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 hover:border-rose-500/40 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">{children}</main>
    </div>
  );
}
