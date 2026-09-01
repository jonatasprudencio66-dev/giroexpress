import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import ChatModal from "@/components/ChatModal";
import TicketModal from "@/components/TicketModal";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import { Bike, MapPin, MessageSquare, Play, Check, Headphones, DollarSign, Loader2, ExternalLink, Package, Bell, BellOff } from "lucide-react";

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => {
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.type = "sine"; o2.frequency.value = 1320;
      o2.connect(g2); g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0.001, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      o2.start(); o2.stop(ctx.currentTime + 0.5);
    }, 250);
  } catch (_) {}
}

export default function CourierDashboard() {
  const { user, refresh } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(user?.online ?? false);
  const [chatDelivery, setChatDelivery] = useState(null);
  const [showTicket, setShowTicket] = useState(false);
  const [ticketForId, setTicketForId] = useState(null);
  const [notifyOn, setNotifyOn] = useState(true);
  const [flashCount, setFlashCount] = useState(0);
  const seenPending = useRef(new Set());
  const firstLoad = useRef(true);

useEffect(() => {
    if (!user || (!user.id && !user._id)) return;
    const userId = user.id || user._id;
    
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = "ensnare-enunciate-mushy.ngrok-free.dev";
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/${userId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Toca um som de bipe opcional e mostra o alerta na tela do entregador
      if (typeof playBeep === "function") playBeep();
     toast.success(`💬 Nova mensagem de ${data.sender_name}: ${data.text}`, {
  duration: 5000,
  position: "top-right"
});
    };

    return () => {
      ws.close();
    };
  }, [user]);

  console.log("CourierDashboard renderizou! Usuário:", user);

  const load = async () => {
    try {
      const { data } = await api.get("/deliveries");
      const pending = data.filter(d => d.status === "pending" && !d.courier_id);
      if (!firstLoad.current && online && notifyOn) {
        const fresh = pending.filter(d => !seenPending.current.has(d.id));
        if (fresh.length) {
          playBeep();
          setFlashCount(c => c + fresh.length);
          fresh.forEach(d => toast.info(`🛵 Nova corrida! ${d.code} • ${d.store_name} • ${formatBRL(d.gross_price)}`, { duration: 8000 }));
        }
      }
      seenPending.current = new Set(pending.map(d => d.id));
      firstLoad.current = false;
      setDeliveries(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [online, notifyOn]);

const toggleOnline = async () => {
    const userStatus = String(user?.status || "").toLowerCase();
    if (userStatus !== "active" && !user?.approved && !user?.is_approved) { 
      toast.error("Aguardando aprovação do admin para ficar online."); 
      return; 
    }
    const next = !online;
    try {
      await api.post("/couriers/me/online", { online: next });
      setOnline(next);
      await refresh();
      toast.success(next ? "Você está ONLINE. Aceitando corridas!" : "Você ficou OFFLINE.");
    } catch (e) { toast.error(apiError(e)); }
  };

  const act = async (id, action) => {
    try {
      await api.post(`/deliveries/${id}/${action}`);
      toast.success(action === "accept" ? "Corrida aceita!" : action === "complete" ? "Entrega concluída!" : "Ok");
      await load();
    } catch (e) { toast.error(apiError(e)); }
  };

const netToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return deliveries
      .filter(d => {
        const statusOk = ["delivered", "completed", "COMPLETED", "DELIVERED"].includes(d.status);
        const mine = String(d.courier_id) === String(user?.id);
        const dateStr = d.delivered_at || d.updated_at || d.created_at || "";
        const dateOk = dateStr.startsWith(today) || !dateStr; // Fallback se a data não bater exatamente
        return statusOk && mine && dateOk;
      })
      .reduce((s, d) => s + (Number(d.net_courier) || Number(d.gross_price) - 1 || 7), 0);
  }, [deliveries, user]);

  const available = deliveries.filter(d => d.status === "pending");
  const mine = deliveries.filter(d => String(d.courier_id) === String(user?.id) && !["delivered", "completed", "cancelled"].includes(d.status));
  const history = deliveries.filter(d => String(d.courier_id) === String(user?.id) && ["delivered", "completed", "cancelled"].includes(d.status));

  return (
    <Layout subtitle="Painel do Motoboy" right={
      <div className="flex items-center space-x-2">
        <button data-testid="toggle-notify-btn" onClick={() => setNotifyOn(v => !v)} title={notifyOn ? "Silenciar" : "Ativar som"} className={`p-2 rounded-xl border ${notifyOn ? "bg-orange-500/10 text-orange-400 border-orange-500/30" : "bg-slate-900 text-slate-500 border-slate-800"}`}>
          {notifyOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </button>
        <div className="flex items-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 space-x-3">
          <div className={`w-3 h-3 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
          <span className="text-xs font-bold text-slate-300 hidden sm:inline">{online ? "ONLINE" : "OFFLINE"}</span>
          <button data-testid="toggle-online-btn" onClick={toggleOnline} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${online ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
            {online ? "Ficar Offline" : "Ficar Online"}
          </button>
        </div>
      </div>
    }>
      {user?.status === "pending" && (
        <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 p-4 rounded-2xl mb-6">
          <p className="font-bold">Conta pendente de aprovação</p>
          <p className="text-sm">Aguarde o administrador aprovar seu cadastro para ficar Online e aceitar corridas.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-testid="courier-dashboard">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Ganhos Líquidos Hoje" value={formatBRL(netToday)} sub="Taxa admin de R$ 1,00 já descontada" testid="courier-earnings" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Corridas Ativas" value={mine.length} sub="Em aceite/andamento" />
        <StatCard icon={<Bike className="w-5 h-5" />} label="Veículo" value={user?.vehicle || "—"} sub="Cadastrado" />
        <StatCard icon={<MapPin className="w-5 h-5" />} label="Disponíveis na Região" value={available.length} sub="Prontas para aceitar" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Corridas Disponíveis" empty="Nenhuma corrida disponível no momento." data={available} badge={flashCount > 0 ? flashCount : null} onSeen={() => setFlashCount(0)}>
            {(d) => (
              <DeliveryCard key={d.id} d={d} me={user} online={online}
                onAccept={() => act(d.id, "accept")}
                onChat={() => setChatDelivery(d)}
                onTicket={() => { setTicketForId(d.id); setShowTicket(true); }}
              />
            )}
          </Section>

          <Section title="Minhas Corridas em Andamento" empty="Aceite uma corrida acima para começar." data={mine}>
            {(d) => (
              <DeliveryCard key={d.id} d={d} me={user} online={online}
                onStart={d.status === "accepted" ? () => act(d.id, "start") : null}
                onComplete={["accepted", "in_transit", "picked_up", "in_progress"].includes(d.status) ? () => act(d.id, "complete") : null}
                onChat={() => setChatDelivery(d)}
                onTicket={() => { setTicketForId(d.id); setShowTicket(true); }}
              />
            )}
          </Section>

          <Section title="Histórico" empty="Sem histórico ainda." data={history}>
            {(d) => (
              <DeliveryCard key={d.id} d={d} me={user} online={online}
                onChat={() => setChatDelivery(d)}
                onTicket={() => { setTicketForId(d.id); setShowTicket(true); }}
              />
            )}
          </Section>
        </div>
      )}

      {chatDelivery && <ChatModal delivery={chatDelivery} onClose={() => setChatDelivery(null)} />}
      <TicketModal open={showTicket} onClose={() => setShowTicket(false)} deliveryId={ticketForId} onCreated={load} />
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

function Section({ title, data, empty, children, badge = null, onSeen }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" onMouseEnter={onSeen}>
      <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2">
        <span>{title}</span>
        <span className="text-xs text-slate-500 font-normal">({data.length})</span>
        {badge ? <span data-testid="new-delivery-badge" className="text-[10px] font-black bg-orange-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">+{badge} NOVA{badge > 1 ? "S" : ""}</span> : null}
      </h3>
      {data.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(children)}
        </div>
      )}
    </section>
  );
}

function DeliveryCard({ d, me, online, onAccept, onStart, onComplete, onChat, onTicket }) {
  const isMine = String(d.courier_id) === String(me?.id);
  const statusStyle = { pending: "text-slate-300 bg-slate-800", accepted: "text-blue-400 bg-blue-500/20", in_transit: "text-amber-400 bg-amber-500/20", delivered: "text-emerald-400 bg-emerald-500/20", cancelled: "text-rose-400 bg-rose-500/20" }[d.status] || "text-slate-300 bg-slate-800";
  const gmapsRoute = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(d.pickup_address)}&destination=${encodeURIComponent(d.dropoff_address)}&travelmode=driving`;
  
  return (
    <div className={`bg-slate-950 border rounded-2xl p-5 space-y-4 ${isMine ? "border-orange-500/60 shadow-lg shadow-orange-500/10" : "border-slate-800"}`} data-testid={`courier-delivery-${d.id}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/20">{d.code}</span>
        <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-full">{d.store_name}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-start space-x-2"><MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" /><div><p className="text-xs text-slate-400">Retirada:</p><p className="font-medium text-white">{d.pickup_address}</p></div></div>
        <div className="flex items-start space-x-2"><MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /><div><p className="text-xs text-slate-400">Cliente: {d.client_name}</p><p className="font-medium text-white">{d.dropoff_address}</p></div></div>
      </div>
      <div className="bg-slate-900 p-3 rounded-xl flex items-center justify-between text-xs">
        <div><p className="text-slate-400">Distância / Tempo:</p><p className="font-mono font-bold text-white">{d.distance_km} km (~{d.estimated_min} min)</p></div>
        <div className="text-right"><p className="text-slate-400">Líquido:</p><p className="font-mono font-bold text-emerald-400 text-base">{formatBRL(d.net_courier)}</p><p className="text-[10px] text-slate-500">Taxa R$ 1,00 deduzida</p></div>
      </div>

      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${statusStyle}`}>{d.status?.replace("_", " ").toUpperCase()}</span>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {onAccept && (
          <button data-testid={`accept-${d.id}`} disabled={!online} onClick={onAccept} className={`flex-1 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition ${online ? "bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-lg shadow-orange-500/30" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}>
            <Play className="w-4 h-4 fill-current" /><span>Aceitar</span>
          </button>
        )}
        {onStart && <button data-testid={`start-${d.id}`} onClick={onStart} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs">Iniciar Rota</button>}
        {onComplete && <button data-testid={`complete-${d.id}`} onClick={onComplete} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1"><Check className="w-4 h-4" /><span>Concluir</span></button>}

        {isMine && ["accepted", "in_transit"].includes(d.status) && (
          <a data-testid={`navigate-${d.id}`} href={gmapsRoute} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-orange-400 px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border border-slate-700">
            <ExternalLink className="w-3.5 h-3.5" /><span>Google Maps</span>
          </a>
        )}
        <button onClick={onChat} className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2.5 rounded-xl border border-slate-700"><MessageSquare className="w-4 h-4" /></button>
        <button onClick={onTicket} className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2.5 rounded-xl border border-slate-700"><Headphones className="w-4 h-4" /></button>
      </div>
    </div>
  );
}