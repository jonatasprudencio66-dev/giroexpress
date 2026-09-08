import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";

const LOGO =
  "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function Layout({
  children,
  right = null,
  subtitle = "Plataforma de Entregas Sob Demanda",
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabel =
    {
      store: "# LOJA",
      courier: "# MOTOBOY",
      admin: "# ADMIN MASTER",
    }[user?.role] || "";

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-slate-950">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">

          {/* LOGO / MARCA */}
          <div
            className="flex min-w-0 items-center gap-3"
            data-testid="brand-header"
          >
            {/* CONTAINER DA LOGO */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-orange-500/20 sm:h-16 sm:w-16">
              <img
                src={LOGO}
                alt="GiroExpress"
                className="block h-full w-full object-contain"
              />
            </div>

            {/* IDENTIFICAÇÃO */}
            <div className="hidden min-w-0 sm:block">
              {roleLabel && (
                <span className="inline-flex rounded-full border border-orange-500/30 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                  {roleLabel}
                </span>
              )}

              <p className="mt-1 truncate text-xs text-slate-400">
                # {subtitle}
              </p>
            </div>
          </div>

          {/* AÇÕES / USUÁRIO */}
          <div className="flex items-center gap-2 sm:gap-3">
            {right}

            {/* DADOS DO USUÁRIO */}
            <div className="hidden flex-col items-end md:flex">
              <span
                data-testid="current-user-name"
                className="max-w-[180px] truncate text-sm font-bold text-white"
              >
                # {user?.name || "Usuário"}
              </span>

              <span className="max-w-[220px] truncate text-[10px] text-slate-400">
                # {user?.email || ""}
              </span>
            </div>

            {/* SAIR */}
            <button
              type="button"
              data-testid="logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:border-rose-500/40 hover:bg-rose-900/40"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline"># Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}