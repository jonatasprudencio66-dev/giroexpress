import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import ChatModal from "@/components/ChatModal";
import TicketModal from "@/components/TicketModal";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, API_BASE } from "@/lib/api";
import { priceFromKm, formatBRL, PLATFORM_FEE } from "@/lib/pricing";
import { toast } from "sonner";
import { Plus, MapPin, MessageSquare, Headphones, Upload, FileText, Loader2, X, CheckSquare, Package, DollarSign, ExternalLink, AlertTriangle } from "lucide-react";

export default function StoreDashboard() {
  const { user, refresh } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState({ open: true, reason: null });

  const [showNew, setShowNew] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketForId, setTicketForId] = useState(null);
  const [chatDelivery, setChatDelivery] = useState(null);

  const [allowBatch, setAllowBatch] = useState(user?.allow_batch ?? true);

  const load = async () => {
    try {
      const [d, s, sys] = await Promise.all([api.get("/deliveries"), api.get("/statements"), api.get("/system/status")]);
      setDeliveries(d.data);
      setStatements(s.data);
      setSystemStatus({ open: sys.data.open, reason: sys.data.reason });
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);

  const toggleBatch = async (v) => {
    setAllowBatch(v);
    try { await api.post("/stores/me/allow-batch", { allow_batch: v }); await refresh(); toast.success(v ? "Lote autorizado (até 3 entregas)." : "Lote desativado."); }
    catch (e) { setAllowBatch(!v); toast.error(apiError(e)); }
  };

  const activeWeek = statements[0];
  const weekBalance = activeWeek?.total_gross || 0;

  return (
    <Layout subtitle="Painel da Loja">
      {!systemStatus.open && (
        <div data-testid="system-closed-banner" className="bg-rose-500/10 border border-rose-500/40 text-rose-300 p-4 rounded-2xl flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-300">Sistema fechado no momento</p>
            <p className="text-sm">{systemStatus.reason || "Novas entregas estão temporariamente desativadas pelo administrador."}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="store-dashboard">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Extrato Acumulado (Semana Atual)" value={formatBRL(weekBalance)} sub="Fechamento domingo · Vencimento terça" testid="store-weekly-balance" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Entregas Realizadas" value={`${deliveries.filter(d => d.status === "delivered").length}`} sub={`${deliveries.length} totais (incluindo pendentes)`} />
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col">
          <div className="flex items-center space-x-2 text-orange-400"><CheckSquare className="w-5 h-5" /><p className="text-xs uppercase font-bold tracking-wide">Lotes Simultâneos</p></div>
          <p className="text-sm text-slate-300 mt-2 mb-3">Autorizar até 3 entregas para um mesmo motoboy?</p>
          <label className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <input data-testid="allow-batch-toggle" type="checkbox" checked={allowBatch} onChange={(e) => toggleBatch(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            <span className="text-xs text-slate-300 font-semibold">{allowBatch ? "Lote habilitado" : "Lote desabilitado"}</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button data-testid="new-delivery-btn" disabled={!systemStatus.open} onClick={() => setShowNew(true)} className={`font-bold px-5 py-3 rounded-xl flex items-center space-x-2 transition shadow-lg ${systemStatus.open ? "bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-orange-500/30" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}>
          <Plus className="w-4 h-4" /><span>Solicitar Nova Entrega</span>
        </button>
        <button data-testid="open-ticket-btn" onClick={() => { setTicketForId(null); setShowTicket(true); }} className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-orange-400 px-5 py-3 rounded-xl text-sm font-semibold flex items-center space-x-2">
          <Headphones className="w-4 h-4" /><span>Abrir Chamado</span>
        </button>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2"><FileText className="w-5 h-5 text-orange-400" /><span>Fechamento Semanal &amp; Comprovantes</span></h3>
        <StatementsList statements={statements} onChanged={load} />
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2"><MapPin className="w-5 h-5 text-orange-400" /><span>Minhas Entregas</span></h3>
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : <DeliveriesTable deliveries={deliveries} onChat={setChatDelivery} onTicket={(id) => { setTicketForId(id); setShowTicket(true); }} />}
      </section>

      {showNew && <NewDeliveryModal user={user} onClose={() => setShowNew(false)} onCreated={load} />}
      <TicketModal open={showTicket} onClose={() => setShowTicket(false)} deliveryId={ticketForId} onCreated={load} />
      {chatDelivery && <ChatModal delivery={chatDelivery} onClose={() => setChatDelivery(null)} />}
    </Layout>
  );
}

function StatCard({ icon, label, value, sub, testid }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
      <div className="flex items-center space-x-2 text-orange-400">{icon}<p className="text-xs uppercase font-bold tracking-wide">{label}</p></div>
      <h3 data-testid={testid} className="text-3xl font-black text-white mt-2">{value}</h3>
      {sub && <p className="text-xs text-slate-400 mt-2">{sub}</p>}
    </div>
  );
}

function DeliveriesTable({ deliveries, onChat, onTicket }) {
  const statusStyle = {
    pending: "bg-slate-800 text-slate-300",
    accepted: "bg-blue-500/20 text-blue-400",
    in_transit: "bg-amber-500/20 text-amber-400",
    delivered: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-rose-500/20 text-rose-400",
  };
  const statusLabel = { pending: "PENDENTE", accepted: "ACEITA", in_transit: "EM TRÂNSITO", delivered: "ENTREGUE", cancelled: "CANCELADA" };

  if (!deliveries.length) return <p className="text-sm text-slate-400">Nenhuma entrega ainda. Clique em "Solicitar Nova Entrega".</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono">
            <th className="py-3 px-2">Código</th>
            <th className="py-3 px-2">Cliente / Endereço</th>
            <th className="py-3 px-2">Dist</th>
            <th className="py-3 px-2">Valor</th>
            <th className="py-3 px-2">Motoboy</th>
            <th className="py-3 px-2">Status</th>
            <th className="py-3 px-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {deliveries.map((d) => (
            <tr key={d.id} data-testid={`delivery-row-${d.id}`} className="hover:bg-slate-800/40 transition">
              <td className="py-3 px-2 font-mono font-bold text-orange-400">{d.code}</td>
              <td className="py-3 px-2">
                <p className="font-semibold text-white">{d.client_name}</p>
                <p className="text-xs text-slate-400">{d.dropoff_address}</p>
              </td>
              <td className="py-3 px-2 font-mono text-slate-300">{d.distance_km} km ({d.estimated_min}min)</td>
              <td className="py-3 px-2 font-bold text-white">{formatBRL(d.gross_price)}</td>
              <td className="py-3 px-2 text-slate-300">{d.courier_name || <span className="text-slate-500 italic">Aguardando</span>}</td>
              <td className="py-3 px-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusStyle[d.status]}`}>{statusLabel[d.status]}</span></td>
              <td className="py-3 px-2">
                <div className="flex items-center space-x-1.5">
                  <button data-testid={`chat-btn-${d.id}`} onClick={() => onChat(d)} className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2 rounded-lg" title="Chat"><MessageSquare className="w-3.5 h-3.5" /></button>
                  <button data-testid={`ticket-btn-${d.id}`} onClick={() => onTicket(d.id)} className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2 rounded-lg" title="Chamado"><Headphones className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementsList({ statements, onChanged }) {
  if (!statements.length) return <p className="text-sm text-slate-400">Ainda não há fechamento gerado. Assim que a primeira entrega for concluída, o extrato semanal é criado automaticamente.</p>;
  return (
    <div className="space-y-3">
      {statements.map((s) => <StatementRow key={s.id} s={s} onChanged={onChanged} />)}
    </div>
  );
}

function StatementRow({ s, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const label = { open: "EM ABERTO", under_review: "COMPROVANTE ENVIADO", approved: "APROVADO", rejected: "REJEITADO" }[s.status] || s.status;
  const badge = { open: "bg-slate-800 text-slate-300", under_review: "bg-amber-500/20 text-amber-400", approved: "bg-emerald-500/20 text-emerald-400", rejected: "bg-rose-500/20 text-rose-400" }[s.status];

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const t = localStorage.getItem("giro_token");
      const res = await fetch(`${API_BASE}/api/statements/${s.id}/proof`, { method: "POST", credentials: "include", body: fd, headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || "Falha no upload"); }
      toast.success("Comprovante enviado! Aguarde validação do admin.");
      onChanged?.();
    } catch (e) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3" data-testid={`statement-${s.id}`}>
      <div>
        <p className="text-xs bg-slate-800 px-2 py-0.5 rounded inline-block text-slate-300 font-mono">{s.cycle_label}</p>
        <p className="text-sm text-white font-semibold mt-1">Total: {formatBRL(s.total_gross)} · {s.total_deliveries} entregas</p>
        {s.due_date && <p className="text-xs text-slate-400">Vencimento: {new Date(s.due_date).toLocaleDateString("pt-BR")}</p>}
      </div>
      <div className="flex items-center space-x-3">
        <span className={`text-xs px-3 py-1 rounded-full font-bold ${badge}`}>{label}</span>
        {s.status !== "approved" && (
          <label className="cursor-pointer bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{s.proof_path ? "Reenviar" : "Enviar Comprovante"}</span>
            <input data-testid={`upload-proof-${s.id}`} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} />
          </label>
        )}
        {s.proof_path && (
          <a data-testid={`view-proof-${s.id}`} href={`${API_BASE}/api/files?path=${encodeURIComponent(s.proof_path)}`} target="_blank" rel="noreferrer" className="text-orange-400 text-xs flex items-center space-x-1 hover:underline">
            <ExternalLink className="w-3 h-3" /><span>Ver</span>
          </a>
        )}
      </div>
    </div>
  );
}

function NewDeliveryModal({ user, onClose, onCreated }) {
  const [pickup, setPickup] = useState(user?.address || "");
  const [dropoff, setDropoff] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [distance, setDistance] = useState(3.0);
  const [autoCalc, setAutoCalc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const preview = priceFromKm(distance);

  const runQuote = async () => {
    if (!autoCalc || !pickup || !dropoff) return;
    setQuoting(true);
    try {
      const { data } = await api.post("/pricing/quote", { pickup_address: pickup, dropoff_address: dropoff });
      setQuote(data);
      setDistance(data.distance_km);
    } catch (e) { setQuote(null); }
    finally { setQuoting(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { pickup_address: pickup, dropoff_address: dropoff, client_name: clientName, client_phone: clientPhone };
      if (!autoCalc) body.distance_km = Number(distance);
      const { data } = await api.post("/deliveries", body);
      toast.success(`Corrida ${data.code} criada! ${formatBRL(data.gross_price)}`);
      onCreated();
      onClose();
    } catch (ex) { toast.error(apiError(ex)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto" data-testid="new-delivery-modal">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2"><MapPin className="w-5 h-5 text-orange-400" /><span>Nova Entrega</span></h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-sm">
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">Endereço de Retirada (Loja)</label>
            <input data-testid="pickup-address" required value={pickup} onChange={(e) => setPickup(e.target.value)} onBlur={runQuote} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">Endereço de Entrega (Cliente Final)</label>
            <input data-testid="dropoff-address" required value={dropoff} onChange={(e) => setDropoff(e.target.value)} onBlur={runQuote} placeholder="Ex: Rua Augusta, 1500 - São Paulo" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Nome do Cliente</label>
              <input data-testid="client-name" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Telefone (opcional)</label>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
            </div>
          </div>

          <label className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <input data-testid="auto-calc-toggle" type="checkbox" checked={autoCalc} onChange={(e) => setAutoCalc(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            <span className="text-xs text-slate-300 font-semibold">Calcular distância automaticamente (geocoding real dos endereços)</span>
          </label>

          {!autoCalc && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Distância (raio):</span>
                <span className="font-mono font-bold text-orange-400">{distance} km</span>
              </div>
              <input data-testid="distance-slider" type="range" min="0.5" max="15" step="0.5" value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="w-full accent-orange-500 cursor-pointer" />
            </div>
          )}

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
            {autoCalc && quoting && <p className="text-slate-400 flex items-center space-x-2"><Loader2 className="w-3 h-3 animate-spin" /><span>Calculando distância real...</span></p>}
            {autoCalc && quote && <p className="text-emerald-400 text-xs">✓ Distância calculada: <b>{quote.distance_km} km</b> {quote.geocoded && "(via OpenStreetMap)"}</p>}
            <div className="flex justify-between"><span className="text-slate-400">Valor bruto:</span><span className="font-mono font-bold text-white">{formatBRL(quote?.gross_price ?? preview.grossPrice)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Taxa admin:</span><span className="font-mono font-bold text-rose-400">- {formatBRL(PLATFORM_FEE)}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-2"><span className="text-slate-300 font-semibold">Líquido motoboy:</span><span className="font-mono font-bold text-emerald-400">{formatBRL(quote?.net_courier ?? preview.netCourier)}</span></div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancelar</button>
            <button data-testid="submit-new-delivery" type="submit" disabled={busy} className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-orange-500/30 flex items-center space-x-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}<span>Confirmar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
