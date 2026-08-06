import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, apiError, API_BASE } from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import { Loader2, Shield, Users, DollarSign, Package, Headphones, CheckSquare, XSquare, ExternalLink, Save } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [statements, setStatements] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState({ bank: {} });
  const [bank, setBank] = useState({ bank: "", agency: "", account: "", pix_key: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [st, u, s, t, cfg] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/statements"),
        api.get("/tickets"),
        api.get("/admin/settings"),
      ]);
      setStats(st.data); setUsers(u.data); setStatements(s.data); setTickets(t.data); setSettings(cfg.data);
      setBank({ ...cfg.data.bank });
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const patchUser = async (id, upd, msg) => {
    try { await api.patch(`/admin/users/${id}`, upd); toast.success(msg); await load(); } catch (e) { toast.error(apiError(e)); }
  };
  const approveUser = async (id) => { try { await api.post(`/admin/users/${id}/approve`); toast.success("Usuário aprovado."); await load(); } catch (e) { toast.error(apiError(e)); } };
  const approveStmt = async (id, ok) => { try { await api.post(`/statements/${id}/approve`, { approved: ok }); toast.success(ok ? "Repasse aprovado!" : "Comprovante rejeitado."); await load(); } catch (e) { toast.error(apiError(e)); } };
  const resolveTicket = async (id) => { try { await api.post(`/tickets/${id}/resolve`); toast.success("Chamado resolvido."); await load(); } catch (e) { toast.error(apiError(e)); } };

  const saveBank = async () => { try { await api.put("/admin/settings/bank", bank); toast.success("Dados bancários salvos."); await load(); } catch (e) { toast.error(apiError(e)); } };

  if (loading) return <Layout subtitle="Admin Master"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></Layout>;

  return (
    <Layout subtitle="Painel Admin (Master)">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-dashboard">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Taxas Coletadas" value={formatBRL(stats?.platform_fees_collected)} sub="R$ 1,00 por entrega" testid="admin-fees" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Usuários" value={stats?.total_users} sub={`${stats?.total_stores} lojas · ${stats?.total_couriers} motoboys`} />
        <StatCard icon={<Package className="w-5 h-5" />} label="Entregas" value={stats?.total_deliveries} sub={`${stats?.delivered} concluídas`} />
        <StatCard icon={<Headphones className="w-5 h-5" />} label="Chamados Abertos" value={stats?.open_tickets} sub="Central de mediação" />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center space-x-2"><DollarSign className="w-5 h-5 text-orange-400" /><span>Configuração Bancária</span></h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <FormInput label="Banco" value={bank.bank} onChange={(v) => setBank({ ...bank, bank: v })} testid="bank-name" />
            <FormInput label="Agência" value={bank.agency} onChange={(v) => setBank({ ...bank, agency: v })} testid="bank-agency" />
            <FormInput label="Conta" value={bank.account} onChange={(v) => setBank({ ...bank, account: v })} testid="bank-account" />
            <FormInput label="Chave PIX" value={bank.pix_key} onChange={(v) => setBank({ ...bank, pix_key: v })} testid="bank-pix" />
          </div>
          <button data-testid="save-bank-btn" onClick={saveBank} className="bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2"><Save className="w-4 h-4" /><span>Salvar Dados Bancários</span></button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center space-x-2"><Shield className="w-5 h-5 text-orange-400" /><span>Conferência de Comprovantes</span></h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {statements.length === 0 && <p className="text-sm text-slate-400">Nenhum fechamento ainda.</p>}
            {statements.map(s => (
              <div key={s.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3" data-testid={`admin-stmt-${s.id}`}>
                <div>
                  <p className="font-bold text-white text-sm">{s.store_name}</p>
                  <p className="text-xs text-slate-400">{s.cycle_label}</p>
                  <p className="text-xs font-mono text-orange-400 mt-0.5">{formatBRL(s.total_gross)} · {s.total_deliveries} entregas</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${s.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : s.status === "under_review" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                    {s.status.replace("_", " ").toUpperCase()}
                  </span>
                  {s.proof_path && <a href={`${API_BASE}/api/files?path=${encodeURIComponent(s.proof_path)}`} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline text-xs flex items-center space-x-1"><ExternalLink className="w-3 h-3" /><span>Ver</span></a>}
                  {s.status === "under_review" && (
                    <>
                      <button data-testid={`approve-stmt-${s.id}`} onClick={() => approveStmt(s.id, true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded">Aprovar</button>
                      <button onClick={() => approveStmt(s.id, false)} className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded">Rejeitar</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2"><Users className="w-5 h-5 text-orange-400" /><span>Gestão de Usuários ({users.length})</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono">
                <th className="py-3 px-2">Nome</th>
                <th className="py-3 px-2">Perfil</th>
                <th className="py-3 px-2">E-mail</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/40" data-testid={`user-row-${u.id}`}>
                  <td className="py-3 px-2 font-semibold text-white">{u.name}</td>
                  <td className="py-3 px-2"><span className="text-[10px] uppercase bg-slate-800 px-2 py-1 rounded text-orange-400 font-mono">{u.role}</span></td>
                  <td className="py-3 px-2 text-slate-300">{u.email}</td>
                  <td className="py-3 px-2"><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${u.status === "active" ? "bg-emerald-500/20 text-emerald-400" : u.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}>{u.status.toUpperCase()}</span></td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      {u.status === "pending" && <button data-testid={`approve-user-${u.id}`} onClick={() => approveUser(u.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded">Aprovar</button>}
                      {u.role !== "admin" && u.status !== "blocked" && <button data-testid={`block-user-${u.id}`} onClick={() => patchUser(u.id, { status: "blocked" }, "Usuário bloqueado")} className="bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 text-xs px-3 py-1 rounded">Bloquear</button>}
                      {u.status === "blocked" && <button onClick={() => patchUser(u.id, { status: "active" }, "Usuário reativado")} className="bg-slate-800 hover:bg-emerald-900/40 text-emerald-400 border border-slate-700 text-xs px-3 py-1 rounded">Reativar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2"><Headphones className="w-5 h-5 text-orange-400" /><span>Central de Chamados ({tickets.length})</span></h3>
        {tickets.length === 0 ? <p className="text-sm text-slate-400">Nenhum chamado registrado.</p> : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div key={t.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl" data-testid={`ticket-${t.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-orange-400">{t.code}</span>
                      <span className="text-[10px] uppercase bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">{t.priority}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${t.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>{t.status.toUpperCase()}</span>
                    </div>
                    <p className="font-bold text-white text-sm mt-1">{t.subject}</p>
                    <p className="text-xs text-slate-400">Aberto por: {t.opened_by_name} ({t.opened_by_role}){t.delivery_id ? ` · Entrega: ${t.delivery_id}` : ""}</p>
                  </div>
                  {t.status !== "resolved" && <button data-testid={`resolve-ticket-${t.id}`} onClick={() => resolveTicket(t.id)} className="bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs">Resolver</button>}
                </div>
                {t.messages?.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
                    {t.messages.map((m, i) => (
                      <p key={i} className="text-xs text-slate-300"><b className="text-orange-400">{m.sender_name}:</b> {m.text}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

function StatCard({ icon, label, value, sub, testid }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
      <div className="flex items-center space-x-2 text-orange-400">{icon}<p className="text-xs uppercase font-bold tracking-wide">{label}</p></div>
      <h3 data-testid={testid} className="text-2xl font-black text-white mt-2">{value}</h3>
      {sub && <p className="text-xs text-slate-400 mt-2">{sub}</p>}
    </div>
  );
}

function FormInput({ label, value, onChange, testid }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 block mb-1 font-semibold">{label}</span>
      <input data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-orange-500" />
    </label>
  );
}
