t
import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import ChatModal from "../components/ChatModal";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { api, apiError } from "../lib/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext"; // Adicione o import do seu contexto de autenticação se necessário

export default function StoreDashboard() {
  const { user: currentUser } = useAuth(); // <--- ADICIONE ESTA LINHA AQUI
  const [activeTab, setActiveTab] = useState("deliveries");
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [deliveryModal, setDeliveryModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [activeChatDelivery, setActiveChatDelivery] = useState(null);

  const [deliveryForm, setDeliveryForm] = useState({
    pickup_address: "Loja",
    dropoff_address: "",
    client_name: "",
    client_phone: "",
    distance_km: 2,
    price: "8.00",
    notes: ""
  });

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "Geral"
  });

useEffect(() => {
    if (!currentUser || (!currentUser.id && !currentUser._id)) return;
    const userId = currentUser.id || currentUser._id;
    
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = "ensnare-enunciate-mushy.ngrok-free.dev";
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/${userId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Notifica visualmente que chegou mensagem nova
     toast.success(`💬 Nova mensagem de ${data.sender_name}: ${data.text}`, {
  duration: 5000,
  position: "top-right"
});
    };

    return () => {
      ws.close();
    };
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [delRes, prodRes] = await Promise.all([
        api.get("/deliveries").catch(() => ({ data: [] })),
        api.get("/products").catch(() => ({ data: [] }))
      ]);
      const delData = delRes.data;
      setDeliveries(Array.isArray(delData) ? delData : (delData.deliveries || []));
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    try {
      await api.post("/deliveries", { ...deliveryForm, price: Number(deliveryForm.price) });
      toast.success("Corrida solicitada com sucesso!");
      setDeliveryModal(false);
      setDeliveryForm({ dropoff_address: "", client_name: "", client_phone: "", distance_km: 2, price: "8.00", notes: "" });
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post("/products", { ...productForm, price: Number(productForm.price) });
      toast.success("Produto cadastrado no cardápio!");
      setProductModal(false);
      setProductForm({ name: "", description: "", price: "", category: "Geral" });
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm("Deseja remover este produto?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Produto removido.");
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Layout 
      subtitle="Painel da Loja"
      right={
        <div className="flex space-x-3">
          {activeTab === 'deliveries' ? (
            <button
              onClick={() => setDeliveryModal(true)}
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-medium transition"
            >
              <Plus className="w-5 h-5" />
              <span>Nova Entrega</span>
            </button>
          ) : (
            <button
              onClick={() => setProductModal(true)}
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-medium transition"
            >
              <Plus className="w-5 h-5" />
              <span>Novo Produto</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex border-b border-slate-800 space-x-6">
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`pb-3 font-medium text-sm transition border-b-2 ${
              activeTab === "deliveries" 
                ? "border-orange-500 text-orange-400" 
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Acompanhar Entregas
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-3 font-medium text-sm transition border-b-2 ${
              activeTab === "products" 
                ? "border-orange-500 text-orange-400" 
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Gerenciar Cardápio / Produtos
          </button>
        </div>

        {activeTab === "deliveries" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">Total de Entregas</span>
                <p className="text-2xl font-bold text-white mt-2">{deliveries.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">Em Andamento</span>
                <p className="text-2xl font-bold text-white mt-2">
                  {deliveries.filter(d => ["pending", "accepted", "picked_up"].includes(d.status)).length}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">Concluídas</span>
                <p className="text-2xl font-bold text-white mt-2">
                  {deliveries.filter(d => ["delivered", "completed", "COMPLETED", "DELIVERED"].includes(d.status)).length}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Lista de Pedidos e Corridas</h2>
              {deliveries.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhuma entrega registrada ainda.</p>
              ) : (
                <div className="space-y-4">
                  {deliveries.map((d) => (
                    <div key={d.id || d._id} className="border border-slate-800 bg-slate-950/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-orange-400 text-sm">{d.code || "PEDIDO"}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {d.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white font-medium mt-1">Cliente: {d.client_name}</p>
                        <p className="text-slate-400 text-sm">Destino: {d.dropoff_address}</p>
                        {d.courier_name && <p className="text-slate-500 text-xs mt-1">Motoboy: {d.courier_name}</p>}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold">R$ {Number(d.price || d.gross_price || 0).toFixed(2)}</p>
                          <span className="text-xs text-slate-500">Taxa adm: R$ 1,00</span>
                        </div>
                        <button
                          onClick={() => setActiveChatDelivery(d)}
                          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-orange-400 px-3 py-2 rounded-xl text-xs font-medium transition border border-slate-700"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Itens Cadastrados no Cardápio</h2>
            {products.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum produto cadastrado. Clique em "Novo Produto" acima.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => (
                  <div key={p.id} className="border border-slate-800 bg-slate-950 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-bold">{p.name}</h3>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2">{p.description || "Sem descrição"}</p>
                      <span className="inline-block bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded mt-2">
                        {p.category}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                      <span className="text-emerald-400 font-bold">R$ {Number(p.price).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {deliveryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white">Solicitar Nova Entrega</h3>
            <form onSubmit={handleCreateDelivery} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">1. Selecione a Região / Taxa de Entrega</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: "Entregas dentro da cidade", price: 8, address: "Cidade - " },
                    { label: "Condomínio dentro da cidade", price: 10, address: "Condomínio (Cidade) - " },
                    { label: "Condomínios próximo (Raízes e Botânico)", price: 12, address: "Cond. Raízes / Botânico - " },
                    { label: "Condomínio Reserva do Bosque", price: 15, address: "Cond. Reserva do Bosque - " },
                    { label: "Condomínios afastados (Bella Vitta e Garden RNI)", price: 20, address: "Cond. Bella Vitta / Garden RNI - " },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDeliveryForm({
                          ...deliveryForm, 
                          pickup_address: "Loja",
                          price: item.price,
                          dropoff_address: deliveryForm.dropoff_address ? deliveryForm.dropoff_address : item.address,
                          notes: `${item.label} - R$ ${item.price},00`
                        });
                      }}
                      className={`text-left px-3 py-2.5 rounded-xl text-xs flex justify-between items-center transition border ${
                        Number(deliveryForm.price) === item.price 
                          ? "bg-orange-600/20 border-orange-500 text-orange-300 font-medium" 
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-bold text-emerald-400 text-sm">R$ {item.price},00</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    required
                    value={deliveryForm.client_name}
                    onChange={e => setDeliveryForm({...deliveryForm, client_name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Endereço Completo (Rua, Número, Lote...)</label>
                  <input
                    type="text"
                    required
                    value={deliveryForm.dropoff_address}
                    onChange={e => setDeliveryForm({...deliveryForm, dropoff_address: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Ex: Rua Tiradentes, 281 (ou Lote 12)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={deliveryForm.client_phone}
                      onChange={e => setDeliveryForm({...deliveryForm, client_phone: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                      placeholder="(17) 9..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Valor Final (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={deliveryForm.price}
                      onChange={e => setDeliveryForm({...deliveryForm, price: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-emerald-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDeliveryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition"
                >
                  Chamar Motoboy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Cadastrar Novo Produto</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Porção de Frango com Fritas"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({...productForm, price: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="49.90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={e => setProductForm({...productForm, category: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Porções, Bebidas..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Descrição</label>
                <textarea
                  value={productForm.description}
                  onChange={e => setProductForm({...productForm, description: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                  placeholder="Ingredientes e detalhes..."
                  rows="2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeChatDelivery && (
        <ChatModal 
          delivery={activeChatDelivery} 
          onClose={() => setActiveChatDelivery(null)} 
        />
      )}
    </Layout>
  );
}