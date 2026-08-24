import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const LOGO = "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { setErr("Senha deve ter pelo menos 6 caracteres."); return; }
    if (pw !== pw2) { setErr("As senhas não conferem."); return; }
    setBusy(true); setErr(null);
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      toast.success("Senha redefinida! Você já pode entrar.");
      nav("/login", { replace: true });
    } catch (ex) { setErr(apiError(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <img src={LOGO} alt="GiroExpress" className="w-16 bg-white rounded-xl p-1" />
          <div>
            <h2 className="text-2xl font-black text-white">Redefinir senha</h2>
            <p className="text-sm text-slate-400">Escolha uma nova senha</p>
          </div>
        </div>

        {!token ? (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm">Token ausente. Solicite um novo link em <Link className="underline" to="/forgot-password">Esqueci minha senha</Link>.</div>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Nova senha</label>
              <input data-testid="reset-pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Confirmar senha</label>
              <input data-testid="reset-pw2" type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
            </div>
            {err && <div data-testid="reset-error" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm p-3 rounded-xl">{err}</div>}
            <button data-testid="reset-submit" type="submit" disabled={busy} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>Redefinir senha</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
