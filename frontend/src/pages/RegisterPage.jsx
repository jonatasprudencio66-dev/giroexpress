import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { UserPlus, Loader2, Store, Bike } from "lucide-react";

const LOGO = "https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png";

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState("store");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "", vehicle: "", allow_batch: true });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const upd = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = await register({ ...form, role });
      nav(u.role === "courier" ? "/motoboy" : "/loja", { replace: true });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-4">
          <img src={LOGO} alt="GiroExpress" className="w-20 h-auto bg-white rounded-xl p-1.5" />
          <div>
            <h2 className="text-2xl font-black text-white">Criar conta GiroExpress</h2>
            <p className="text-sm text-slate-400">Escolha seu perfil e comece agora</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button data-testid="role-store-btn" type="button" onClick={() => setRole("store")} className={`p-4 rounded-2xl border-2 text-left transition ${role === "store" ? "border-orange-500 bg-orange-500/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"}`}>
            <Store className={`w-6 h-6 mb-2 ${role === "store" ? "text-orange-400" : "text-slate-400"}`} />
            <p className="font-bold text-white">Sou Loja</p>
            <p className="text-xs text-slate-400">Solicito entregas para meus clientes</p>
          </button>
          <button data-testid="role-courier-btn" type="button" onClick={() => setRole("courier")} className={`p-4 rounded-2xl border-2 text-left transition ${role === "courier" ? "border-orange-500 bg-orange-500/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"}`}>
            <Bike className={`w-6 h-6 mb-2 ${role === "courier" ? "text-orange-400" : "text-slate-400"}`} />
            <p className="font-bold text-white">Sou Motoboy</p>
            <p className="text-xs text-slate-400">Quero receber corridas na região</p>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">{role === "store" ? "Nome da Loja" : "Seu nome"}</label>
              <input data-testid="reg-name" required value={form.name} onChange={(e) => upd("name", e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">E-mail</label>
              <input data-testid="reg-email" required type="email" value={form.email} onChange={(e) => upd("email", e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Senha (mín 6)</label>
              <input data-testid="reg-password" required type="password" minLength={6} value={form.password} onChange={(e) => upd("password", e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Telefone (opcional)</label>
              <input data-testid="reg-phone" value={form.phone} onChange={(e) => upd("phone", e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
            {role === "store" && (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Endereço da Loja (para retirada padrão)</label>
                <input data-testid="reg-address" value={form.address} onChange={(e) => upd("address", e.target.value)} placeholder="Ex: Av. Paulista, 1000 - São Paulo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
              </div>
            )}
            {role === "courier" && (
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Veículo / Placa</label>
                <input data-testid="reg-vehicle" value={form.vehicle} onChange={(e) => upd("vehicle", e.target.value)} placeholder="Ex: Honda CG 160 - ABC-1234" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
              </div>
            )}
          </div>

          {role === "courier" && (
            <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl">
              Motoboys ficam com status <b>pendente</b> até aprovação do administrador. Após aprovado, você poderá ficar Online e aceitar corridas.
            </div>
          )}

          {err && <div data-testid="reg-error" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm p-3 rounded-xl">{err}</div>}

          <button data-testid="register-submit" type="submit" disabled={busy} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30 transition">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>{busy ? "Criando..." : "Criar Conta"}</span>
          </button>

          <p className="text-sm text-slate-400 text-center">Já tem conta? <Link to="/login" className="text-orange-400 font-bold hover:underline" data-testid="link-login">Fazer login</Link></p>
        </form>
      </div>
    </div>
  );
}
