import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, apiError, API_BASE } from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import { Loader2, Shield, Users, DollarSign, Package, Headphones, CheckSquare, XSquare, ExternalLink, Save, Calendar, Clock, Plus, Trash2, Power } from "lucide-react";

const WEEKDAYS = [
  { i: 0, label: "Seg" }, { i: 1, label: "Ter" }, { i: 2, label: "Qua" },
  { i: 3, label: "Qui" }, { i: 4, label: "Sex" }, { i: 5, label: "Sáb" }, { i: 6, label: "Dom" }
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [statements, setStatements] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState({ bank: {} });
  const [bank, setBank] = useState({ bank: "", agency: "", account: "", pix_key: "" });
  const [ops, setOps] = useState({ enabled: true, disabled_weekdays: [], open_time: "00:00", close_time: "23:59", holidays: [] });
  const [newHoliday, setNewHoliday] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [st, u, s, t, cfg, opsRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/statements"),
        api.get("/tickets"),
        api.get("/admin/settings"),
        api.get("/admin/settings/operations"),
      ]);
      setStats(st.data); 
      setUsers(Array.isArray(u.data) ? u.data : []); 
      setStatements(Array.isArray(s.data) ? s.data : []); 
      setTickets(Array.isArray(t.data) ? t.data : []); 
      setSettings(cfg.data);
      setBank({ ...cfg.data.bank });
      setOps({ ...ops, ...opsRes.data });
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

const patchUser = async (identifier, upd, msg) => {
    try { 
      const safeId = encodeURIComponent(String(identifier).trim());
      await api.patch(`/admin/users/${safeId}`, upd); 
      toast.success(msg); 
      await load(); 
    } catch (e) { 
      toast.error(apiError(e)); 
    }
  };

  const approveUser = async (identifier) => { 
    try { 
      const safeId = encodeURIComponent(String(identifier).trim());
      await api.post(`/admin/users/${safeId}/approve`); 
      toast.success("Usuário aprovado."); 
      await load(); 
    } catch (e) { 
      toast.error(apiError(e)); 
    } 
  };
  const approveStmt = async (id, ok) => { try { await api.post(`/statements/${id}/approve`, { approved: ok }); toast.success(ok ? "Repasse aprovado!" : "Comprovante rejeitado."); await load(); } catch (e) { toast.error(apiError(e)); } };
  const resolveTicket = async (id) => { try { await api.post(`/tickets/${id}/resolve`); toast.success("Chamado resolvido."); await load(); } catch (e) { toast.error(apiError(e)); } };

  const saveBank = async () => { try { await api.put("/admin/settings/bank", bank); toast.success("Dados bancários salvos."); await load(); } catch (e) { toast.error(apiError(e)); } };

  const saveOps = async (patch) => {
    const next = { ...ops, ...patch };
    setOps(next);
    try { await api.put("/admin/settings/operations", patch); toast.success("Horários atualizados."); }
    catch (e) { toast.error(apiError(e)); }
  };

  const toggleWeekday = (i) => {
    const set = new Set(ops.disabled_weekdays || []);
    if (set.has(i)) set.delete(i); else set.add(i);
    saveOps({ disabled_weekdays: Array.from(set).sort() });
  };
  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) { toast.error("Use o formato AAAA-MM-DD"); return; }
    saveOps({ holidays: Array.from(new Set([...(ops.holidays || []), newHoliday])).sort() });
    setNewHoliday("");
  };
  const removeHoliday = (h) => saveOps({ holidays: (ops.holidays || []).filter(x => x !== h) });

  if (loading) return <Layout subtitle="Admin Master"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></Layout>;

  return (
    <Layout subtitle="Painel Admin (Master)">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-dashboard">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Taxas Coletadas" value={formatBRL((stats?.delivered || 0) * 1)} sub="R$ 1,00 por entrega" testid="admin-fees" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Usuários" value={stats?.total_users} sub={`${stats?.total_stores} lojas · ${stats?.total_couriers} motoboys`} />
        <StatCard icon={<Package className="w-5 h-5" />} label="Entregas" value={stats?.total_deliveries} sub={`${stats?.delivered} concluídas`} />
        <StatCard icon={<Headphones className="w-5 h-5" />} label="Chamados Abertos" value={stats?.open_tickets} sub="Central de mediação" />
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 my-6">
        <h3 className="font-bold text-lg text-white flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-orange-400" />
          <span>Taxas por Loja e Data (Para Cobrança)</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono">
                <th className="py-3 px-2">Loja</th>
                <th className="py-3 px-2">Data</th>
                <th className="py-3 px-2">Entregas Concluídas</th>
                <th className="py-3 px-2">Taxa Total (R$ 1,00/cada)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(!stats?.store_fees_details || stats.store_fees_details.length === 0) ? (
                <tr>
                  <td colSpan="4" className="py-4 text-center text-sm text-slate-500">Nenhuma taxa registrada ainda.</td>
                </tr>
              ) : (
                stats.store_fees_details.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-3 px-2 font-semibold text-white">{item.store_name}</td>
                    <td className="py-3 px-2 text-slate-300 font-mono text-xs">{item.date}</td>
                    <td className="py-3 px-2 text-slate-300">{item.deliveries_count} entregas</td>
                    <td className="py-3 px-2 font-bold text-orange-400">{formatBRL(item.total_fee)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
            {(Array.isArray(statements) ? statements : []).map(s => (
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

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 my-6" data-testid="ops-settings">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-lg text-white flex items-center space-x-2"><Clock className="w-5 h-5 text-orange-400" /><span>Horário de Funcionamento &amp; Modo Sábado</span></h3>
          <label className="flex items-center space-x-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <input data-testid="ops-enabled" type="checkbox" checked={ops.enabled} onChange={(e) => saveOps({ enabled: e.target.checked })} className="w-4 h-4 accent-orange-500" />
            <Power className={`w-4 h-4 ${ops.enabled ? "text-emerald-400" : "text-rose-400"}`} />
            <span className="text-xs font-bold text-slate-300">{ops.enabled ? "Plataforma ativa" : "Plataforma DESATIVADA"}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
            <p className="text-xs uppercase font-bold text-orange-400 tracking-wide">Dias da Semana Desativados</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(w => {
                const active = Array.isArray(ops?.disabled_weekdays) && ops.disabled_weekdays.includes(w.i);
                return (
                  <button key={w.i} data-testid={`weekday-${w.i}`} onClick={() => toggleWeekday(w.i)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${active ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"}`}>
                    {w.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500">Vermelho = sem atendimento nesse dia</p>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
            <p className="text-xs uppercase font-bold text-orange-400 tracking-wide">Horário de Abertura / Fechamento</p>
            <div className="flex items-center space-x-2">
              <input data-testid="ops-open-time" type="time" value={ops.open_time} onChange={(e) => setOps({ ...ops, open_time: e.target.value })} onBlur={(e) => saveOps({ open_time: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              <span className="text-slate-500">até</span>
              <input data-testid="ops-close-time" type="time" value={ops.close_time} onChange={(e) => setOps({ ...ops, close_time: e.target.value })} onBlur={(e) => saveOps({ close_time: e.target.value })} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>
            <p className="text-[10px] text-slate-500">Fuso America/São Paulo (UTC-3)</p>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
            <p className="text-xs uppercase font-bold text-orange-400 tracking-wide">Feriados</p>
            <div className="flex items-center space-x-2">
              <input data-testid="holiday-input" type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
              <button data-testid="add-holiday-btn" onClick={addHoliday} className="bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs flex items-center space-x-1"><Plus className="w-3.5 h-3.5" /><span>Add</span></button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(ops.holidays || []).length === 0 && <p className="text-[10px] text-slate-500">Nenhum feriado cadastrado.</p>}
              {(ops.holidays || []).map(h => (
                <span key={h} className="inline-flex items-center space-x-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded" data-testid={`holiday-${h}`}>
                  <Calendar className="w-3 h-3" /><span>{h}</span>
                  <button onClick={() => removeHoliday(h)} className="hover:text-white"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
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
              {users.map((u, index) => { 
                const uid = u.id || u._id || u.email || index; 
                return (
                  <tr key={uid} className="hover:bg-slate-800/40" data-testid={`user-row-${uid}`}>
                    <td className="py-3 px-2 font-semibold text-white">{u.name}</td>
                    <td className="py-3 px-2"><span className="text-[10px] uppercase bg-slate-800 px-2 py-1 rounded text-orange-400 font-mono">{u.role}</span></td>
                    <td className="py-3 px-2 text-slate-300">{u.email}</td>
                    <td className="py-3 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${u.status === "active" || u.status === "Aprovado" ? "bg-emerald-500/20 text-emerald-400" : (u.status === "pending" || u.status === "Pendente") ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}>
                        {String(u.status || "").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center space-x-2">
                        {(u.status === "pending" || u.status === "Pendente") && <button data-testid={`approve-user-${uid}`} onClick={() => approveUser(uid)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded">Aprovar</button>}
                        {u.role !== "admin" && u.status !== "blocked" && u.status !== "Bloqueado" && <button data-testid={`block-user-${uid}`} onClick={() => patchUser(uid, { status: "blocked" }, "Usuário bloqueado")} className="bg-slate-800 hover:bg-rose-900/40 text-rose-400 border border-slate-700 text-xs px-3 py-1 rounded">Bloquear</button>}
                        {(u.status === "blocked" || u.status === "Bloqueado") && <button onClick={() => patchUser(uid, { status: "active" }, "Usuário reativado")} className="bg-slate-800 hover:bg-emerald-900/40 text-emerald-400 border border-slate-700 text-xs px-3 py-1 rounded">Reativar</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
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