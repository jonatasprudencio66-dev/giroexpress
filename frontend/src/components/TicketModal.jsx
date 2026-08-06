import React, { useState } from "react";
import { X, Headphones, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function TicketModal({ open, onClose, deliveryId = null, onCreated }) {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("media");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/tickets", { subject, priority, delivery_id: deliveryId, message });
      toast.success(`Chamado ${data.code} aberto! O admin irá analisar.`);
      setSubject(""); setMessage("");
      onCreated?.(data);
      onClose();
    } catch (ex) {
      toast.error(apiError(ex));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl" data-testid="ticket-modal">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2"><Headphones className="w-5 h-5 text-orange-400" /><span>Abrir Chamado / Ocorrência</span></h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-sm">
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">Assunto</label>
            <input data-testid="ticket-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Atraso na entrega, avaria..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">Prioridade</label>
            <select data-testid="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta (Urgente)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-semibold">Descrição (opcional)</label>
            <textarea data-testid="ticket-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-orange-500" />
          </div>
          {deliveryId && <p className="text-xs text-slate-400">Associado à entrega: <span className="font-mono text-orange-400">{deliveryId}</span></p>}

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">Cancelar</button>
            <button data-testid="ticket-submit" type="submit" disabled={busy} className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-orange-500/20 flex items-center space-x-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}<span>Enviar Chamado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
