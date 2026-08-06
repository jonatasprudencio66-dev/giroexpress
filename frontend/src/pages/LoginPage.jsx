import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogIn, Loader2 } from "lucide-react";

const LOGO = "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      nav(u.role === "admin" ? "/admin" : u.role === "courier" ? "/motoboy" : "/loja", { replace: true });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 items-center justify-center p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10 text-center space-y-6 max-w-md">
          <img src={LOGO} alt="GiroExpress" className="mx-auto w-56 h-auto bg-white/95 rounded-3xl p-4 shadow-2xl" />
          <h1 className="text-4xl font-black text-slate-950">Entregas Rápidas e Eficientes</h1>
          <p className="text-slate-950/80 text-lg leading-relaxed">Plataforma B2B2C de logística sob demanda. Conecte sua loja aos melhores motoboys da região.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="md:hidden text-center">
            <img src={LOGO} alt="GiroExpress" className="mx-auto w-40 bg-white rounded-2xl p-2" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">Entrar no GiroExpress</h2>
            <p className="text-sm text-slate-400 mt-2">Acesse seu painel de Loja, Motoboy ou Admin</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">E-mail</label>
              <input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" placeholder="voce@exemplo.com" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Senha</label>
              <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" placeholder="••••••••" />
            </div>

            {err && <div data-testid="login-error" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm p-3 rounded-xl">{err}</div>}

            <button data-testid="login-submit" type="submit" disabled={busy} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{busy ? "Entrando..." : "Entrar"}</span>
            </button>

            <div className="text-right">
              <Link to="/forgot-password" data-testid="link-forgot" className="text-xs text-slate-400 hover:text-orange-400 transition">Esqueci minha senha</Link>
            </div>
          </form>

          <p className="text-sm text-slate-400 text-center">
            Não tem conta? <Link to="/register" className="text-orange-400 font-bold hover:underline" data-testid="link-register">Cadastre sua loja ou moto</Link>
          </p>

          <div className="text-xs text-slate-500 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <p className="font-bold text-slate-400 mb-1">Admin master (demonstração):</p>
            <p>admin@giroexpress.com • Admin@2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
