import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";

const LOGO = "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [demoLink, setDemoLink] = useState(null);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setOk(true);
      if (data.demo_reset_link) setDemoLink(data.demo_reset_link);
    } catch (ex) { setErr(apiError(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <img src={LOGO} alt="GiroExpress" className="w-16 bg-white rounded-xl p-1" />
          <div>
            <h2 className="text-2xl font-black text-white">Esqueceu a senha?</h2>
            <p className="text-sm text-slate-400">Enviaremos um link seguro para redefinir</p>
          </div>
        </div>

        {!ok ? (
          <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">E-mail cadastrado</label>
              <input data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500" />
            </div>
            {err && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm p-3 rounded-xl">{err}</div>}
            <button data-testid="forgot-submit" type="submit" disabled={busy} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>Enviar link de recuperação</span>
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-sm">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
            </div>
            {demoLink && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl text-xs" data-testid="demo-reset-link">
                <p className="font-bold mb-1">Modo demo — link direto:</p>
                <a href={demoLink} className="underline break-all text-amber-400 hover:text-amber-300">{demoLink}</a>
                <p className="mt-2 opacity-70">Em produção, esse link será enviado por e-mail via Resend/SendGrid.</p>
              </div>
            )}
          </div>
        )}

        <Link to="/login" data-testid="link-back-login" className="flex items-center justify-center space-x-2 text-sm text-slate-400 hover:text-orange-400 transition">
          <ArrowLeft className="w-4 h-4" /><span>Voltar ao login</span>
        </Link>
      </div>
    </div>
  );
}
