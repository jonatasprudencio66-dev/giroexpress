import React, { useEffect, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ChatModal({ delivery, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!delivery) return;
    try {
      const { data } = await api.get(`/deliveries/${delivery.id}/chat`);
      setMessages(data);
    } catch (_) {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearInterval(t); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line
  }, [delivery?.id]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
     await api.post(`/deliveries/${delivery.id}/chat`, { message: text });
      setText("");
      await load();
    } finally { setBusy(false); }
  };

  if (!delivery) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full h-[500px] flex flex-col shadow-2xl overflow-hidden" data-testid="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Chat GiroExpress</h3>
            <p className="text-xs text-slate-400">{delivery.code} • {delivery.store_name} ➔ {delivery.client_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" data-testid="chat-close-btn"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 && <p className="text-xs text-slate-500 text-center mt-4">Sem mensagens ainda. Envie a primeira!</p>}
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-slate-500 mb-1">{m.sender_name} ({m.sender_role}) • {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${mine ? "bg-orange-500 text-slate-950 font-medium" : "bg-slate-800 text-slate-100"}`}>{m.message}</div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
          <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Digite sua mensagem..." className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
          <button data-testid="chat-send-btn" onClick={send} disabled={busy} className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 p-2.5 rounded-xl transition">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
