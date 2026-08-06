import React, { useState } from "react";
import { 
  Store, Bike, ShieldCheck, UserCheck, Calculator, DollarSign, 
  MapPin, Clock, CheckCircle2, AlertCircle, MessageSquare, 
  Send, Plus, Check, Eye, Lock, RefreshCw, Layers, Headphones, 
  FileText, Upload, ChevronRight, ChevronDown, CheckSquare, X, Play
} from "lucide-react";

// 1. PRICING TABLE (0.5 km to 15.0 km)
const PRICING_TABLE = [
  { km: 0.5, price: 3.99, timeMin: 12 },
  { km: 1.0, price: 3.99, timeMin: 14 },
  { km: 1.5, price: 4.99, timeMin: 16 },
  { km: 2.0, price: 4.99, timeMin: 17 },
  { km: 2.5, price: 5.99, timeMin: 18 },
  { km: 3.0, price: 5.99, timeMin: 19 },
  { km: 3.5, price: 6.99, timeMin: 20 },
  { km: 4.0, price: 6.99, timeMin: 21 },
  { km: 4.5, price: 7.99, timeMin: 22 },
  { km: 5.0, price: 7.99, timeMin: 23 },
  { km: 5.5, price: 8.99, timeMin: 24 },
  { km: 6.0, price: 9.99, timeMin: 25 },
  { km: 6.5, price: 10.99, timeMin: 26 },
  { km: 7.0, price: 11.99, timeMin: 27 },
  { km: 7.5, price: 12.99, timeMin: 29 },
  { km: 8.0, price: 13.99, timeMin: 30 },
  { km: 8.5, price: 14.99, timeMin: 31 },
  { km: 9.0, price: 15.99, timeMin: 32 },
  { km: 9.5, price: 16.99, timeMin: 33 },
  { km: 10.0, price: 17.99, timeMin: 33 },
  { km: 10.5, price: 19.99, timeMin: 34 },
  { km: 11.0, price: 19.99, timeMin: 34 },
  { km: 11.5, price: 20.99, timeMin: 35 },
  { km: 12.0, price: 22.99, timeMin: 36 },
  { km: 12.5, price: 22.99, timeMin: 37 },
  { km: 13.0, price: 24.99, timeMin: 38 },
  { km: 13.5, price: 24.99, timeMin: 39 },
  { km: 14.0, price: 24.99, timeMin: 39 },
  { km: 14.5, price: 24.99, timeMin: 40 },
  { km: 15.0, price: 24.99, timeMin: 41 },
];

function calculatePriceByDistance(km) {
  let matched = PRICING_TABLE[0];
  for (let item of PRICING_TABLE) {
    if (km <= item.km) {
      matched = item;
      break;
    }
    matched = item;
  }
  const grossPrice = matched.price;
  const adminFee = 1.00;
  const netCourier = Number((grossPrice - adminFee).toFixed(2));
  return {
    km: matched.km,
    grossPrice,
    adminFee,
    netCourier,
    timeMin: matched.timeMin
  };
}

const INITIAL_USERS = [
  {
    id: "store_1",
    name: "Burger King Paulista",
    role: "store",
    email: "paulista@burgerking.com",
    address: "Av. Paulista, 1000 - Bela Vista, São Paulo",
    allowBatch: true,
    weeklyBalance: 245.50,
    status: "active",
    avatar: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=150"
  },
  {
    id: "store_2",
    name: "Sushi Express Jardins",
    role: "store",
    email: "contato@sushiexpress.com",
    address: "Rua Augusta, 2200 - Jardins, São Paulo",
    allowBatch: false,
    weeklyBalance: 112.00,
    status: "active",
    avatar: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=150"
  },
  {
    id: "courier_1",
    name: "Carlos Motoboy",
    role: "courier",
    email: "carlos@giroexpress.com",
    statusOnline: true,
    vehicle: "Honda CG 160 - ABC-1234",
    rating: 4.92,
    totalDeliveries: 412,
    netEarningsToday: 134.50,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
  },
  {
    id: "courier_2",
    name: "Mariana Entregas",
    role: "courier",
    email: "mariana@giroexpress.com",
    statusOnline: false,
    vehicle: "Yamaha Fazer 250 - XYZ-9876",
    rating: 4.98,
    totalDeliveries: 620,
    netEarningsToday: 0.00,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150"
  },
  {
    id: "admin_1",
    name: "Admin GiroExpress",
    role: "admin",
    email: "admin@giroexpress.com",
    bankDetails: {
      bank: "Nubank (260)",
      agency: "0001",
      account: "9876543-2",
      pixKey: "financeiro@giroexpress.com"
    },
    totalPlatformFeesCollected: 3420.00,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
  },
  {
    id: "client_1",
    name: "Roberto Silva (Cliente Final)",
    role: "client",
    email: "roberto@gmail.com",
    address: "Rua Oscar Freire, 800 - Jardins, São Paulo",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
  }
];

const INITIAL_DELIVERIES = [
  {
    id: "DEL-9001",
    storeId: "store_1",
    storeName: "Burger King Paulista",
    storeAddress: "Av. Paulista, 1000 - Bela Vista",
    clientName: "Roberto Silva",
    clientAddress: "Rua Oscar Freire, 800 - Jardins",
    distanceKm: 3.2,
    grossPrice: 6.99,
    adminFee: 1.00,
    netCourier: 5.99,
    estimatedTimeMin: 20,
    status: "em_andamento",
    courierId: "courier_1",
    courierName: "Carlos Motoboy",
    batchId: "BATCH-101",
    batchIndex: 1,
    isBatch: true,
    createdAt: "2026-06-06T14:30:00Z",
    deliveredAt: null,
    proofOfDepositSent: false
  },
  {
    id: "DEL-9002",
    storeId: "store_1",
    storeName: "Burger King Paulista",
    storeAddress: "Av. Paulista, 1000 - Bela Vista",
    clientName: "Ana Paula Souza",
    clientAddress: "Alameda Santos, 1200 - Cerqueira César",
    distanceKm: 1.5,
    grossPrice: 4.99,
    adminFee: 1.00,
    netCourier: 3.99,
    estimatedTimeMin: 16,
    status: "em_andamento",
    courierId: "courier_1",
    courierName: "Carlos Motoboy",
    batchId: "BATCH-101",
    batchIndex: 2,
    isBatch: true,
    createdAt: "2026-06-06T14:32:00Z",
    deliveredAt: null,
    proofOfDepositSent: false
  },
  {
    id: "DEL-9003",
    storeId: "store_2",
    storeName: "Sushi Express Jardins",
    storeAddress: "Rua Augusta, 2200 - Jardins",
    clientName: "Marcos Lima",
    clientAddress: "Praça da Sé, 50 - Centro",
    distanceKm: 5.5,
    grossPrice: 8.99,
    adminFee: 1.00,
    netCourier: 7.99,
    estimatedTimeMin: 24,
    status: "pendente",
    courierId: null,
    courierName: null,
    batchId: null,
    batchIndex: 1,
    isBatch: false,
    createdAt: "2026-06-06T15:00:00Z",
    deliveredAt: null,
    proofOfDepositSent: false
  },
  {
    id: "DEL-8998",
    storeId: "store_1",
    storeName: "Burger King Paulista",
    storeAddress: "Av. Paulista, 1000 - Bela Vista",
    clientName: "Juliana Costa",
    clientAddress: "Rua Haddock Lobo, 1300",
    distanceKm: 2.0,
    grossPrice: 4.99,
    adminFee: 1.00,
    netCourier: 3.99,
    estimatedTimeMin: 17,
    status: "entregue",
    courierId: "courier_1",
    courierName: "Carlos Motoboy",
    batchId: null,
    batchIndex: 1,
    isBatch: false,
    createdAt: "2026-06-05T12:10:00Z",
    deliveredAt: "2026-06-05T12:30:00Z",
    proofOfDepositSent: false
  }
];

const INITIAL_STATEMENTS = [
  {
    id: "STMT-2026-W22",
    storeId: "store_1",
    storeName: "Burger King Paulista",
    cycle: "Domingo (31/05) a Terça (02/06)",
    totalDeliveriesCount: 14,
    totalGrossAmount: 112.50,
    status: "pendente_pagamento",
    proofUrl: null,
    dueDate: "2026-06-02T23:59:59Z"
  },
  {
    id: "STMT-2026-W23",
    storeId: "store_1",
    storeName: "Burger King Paulista",
    cycle: "Domingo (07/06) a Terça (09/06) [Atual]",
    totalDeliveriesCount: 6,
    totalGrossAmount: 48.00,
    status: "em_aberto",
    proofUrl: null,
    dueDate: "2026-06-09T23:59:59Z"
  },
  {
    id: "STMT-2026-W22-S2",
    storeId: "store_2",
    storeName: "Sushi Express Jardins",
    cycle: "Domingo (31/05) a Terça (02/06)",
    totalDeliveriesCount: 9,
    totalGrossAmount: 84.00,
    status: "comprovante_enviado",
    proofUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500",
    dueDate: "2026-06-02T23:59:59Z"
  }
];

const INITIAL_TICKETS = [
  {
    id: "TCK-501",
    deliveryId: "DEL-9001",
    openedByRole: "store",
    openedByName: "Burger King Paulista",
    subject: "Atraso na retirada do pedido",
    status: "aberto",
    priority: "alta",
    createdAt: "2026-06-06T14:45:00Z",
    messages: [
      {
        sender: "Burger King Paulista",
        text: "O motoboy demorou mais de 20 minutos para chegar na loja.",
        time: "14:45"
      },
      {
        sender: "Admin GiroExpress",
        text: "Estamos verificando com o entregador Carlos Motoboy.",
        time: "14:50"
      }
    ]
  }
];

const INITIAL_CHATS = {
  "DEL-9001": [
    { sender: "Burger King Paulista", text: "Olá Carlos, o pedido está saindo quente agora!", time: "14:31" },
    { sender: "Carlos Motoboy", text: "Perfeito, chego na loja em 3 minutos.", time: "14:32" }
  ]
};

export default function GiroExpressApp() {
  const [currentRole, setCurrentRole] = useState("store");
  const [currentUser, setCurrentUser] = useState(INITIAL_USERS[0]);

  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES);
  const [statements, setStatements] = useState(INITIAL_STATEMENTS);
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [chats, setChats] = useState(INITIAL_CHATS);
  const [usersList, setUsersList] = useState(INITIAL_USERS);

  const [toastMsg, setToastMsg] = useState(null);
  const [showNewDeliveryModal, setShowNewDeliveryModal] = useState(false);
  const [newPickup, setNewPickup] = useState("Av. Paulista, 1000 - Bela Vista");
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newDistanceKm, setNewDistanceKm] = useState(3.0);
  const [isBatchAllowed, setIsBatchAllowed] = useState(true);

  const [activeChatDelivery, setActiveChatDelivery] = useState(null);
  const [chatInputText, setChatInputText] = useState("");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState("media");
  const [selectedDeliveryForTicket, setSelectedDeliveryForTicket] = useState(null);

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [adminBank, setAdminBank] = useState(INITIAL_USERS.find(u => u.role === 'admin').bankDetails);
  const [adminFeeVal, setAdminFeeVal] = useState(1.00);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSwitchRole = (roleKey) => {
    setCurrentRole(roleKey);
    const found = usersList.find(u => u.role === roleKey);
    if (found) setCurrentUser(found);
    showToast(`Alternado para o perfil: ${roleKey.toUpperCase()}`);
  };

  const pricingPreview = calculatePriceByDistance(Number(newDistanceKm));

  const handleCreateDelivery = (e) => {
    e.preventDefault();
    if (!newClientName || !newClientAddress) {
      showToast("Preencha o nome e endereço do cliente final.");
      return;
    }
    const newId = `DEL-${Math.floor(9000 + Math.random() * 900)}`;
    const newDeliveryObj = {
      id: newId,
      storeId: currentUser.id,
      storeName: currentUser.name,
      storeAddress: newPickup,
      clientName: newClientName,
      clientAddress: newClientAddress,
      distanceKm: Number(newDistanceKm),
      grossPrice: pricingPreview.grossPrice,
      adminFee: pricingPreview.adminFee,
      netCourier: pricingPreview.netCourier,
      estimatedTimeMin: pricingPreview.timeMin,
      status: "pendente",
      courierId: null,
      courierName: null,
      batchId: null,
      batchIndex: 1,
      isBatch: isBatchAllowed,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      proofOfDepositSent: false
    };

    setDeliveries([newDeliveryObj, ...deliveries]);
    setShowNewDeliveryModal(false);
    setNewClientName("");
    setNewClientAddress("");
    showToast(`Corrida ${newId} solicitada com sucesso! R$ ${pricingPreview.grossPrice.toFixed(2)}`);
  };

  const handleAcceptDelivery = (deliveryId) => {
    const target = deliveries.find(d => d.id === deliveryId);
    if (!target) return;

    const courierActive = deliveries.filter(d => d.courierId === currentUser.id && d.status === "em_andamento");
    const sameStoreActive = courierActive.filter(d => d.storeId === target.storeId);

    if (sameStoreActive.length >= 3) {
      showToast("Limite máximo de 3 entregas simultâneas da mesma loja atingido!");
      return;
    }

    const updated = deliveries.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: "em_andamento",
          courierId: currentUser.id,
          courierName: currentUser.name
        };
      }
      return d;
    });

    setDeliveries(updated);
    showToast(`Corrida ${deliveryId} aceita! Navegando via Google Maps...`);
  };

  const handleCompleteDelivery = (deliveryId) => {
    const updated = deliveries.map(d => {
      if (d.id === deliveryId) {
        return {
          ...d,
          status: "entregue",
          deliveredAt: new Date().toISOString()
        };
      }
      return d;
    });
    setDeliveries(updated);
    showToast(`Corrida ${deliveryId} concluída com sucesso!`);
  };

  const handleSendChatMessage = (deliveryId, text) => {
    if (!text.trim()) return;
    const currentMsgs = chats[deliveryId] || [];
    const newMsg = {
      sender: currentUser.name,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChats({
      ...chats,
      [deliveryId]: [...currentMsgs, newMsg]
    });
    setChatInputText("");
  };

  const handleSubmitProof = (statementId) => {
    const updated = statements.map(s => {
      if (s.id === statementId) {
        return {
          ...s,
          status: "comprovante_enviado",
          proofUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500"
        };
      }
      return s;
    });
    setStatements(updated);
    showToast("Comprovante enviado com sucesso para validação do Administrador!");
  };

  const handleAdminApproveStatement = (statementId) => {
    const updated = statements.map(s => {
      if (s.id === statementId) {
        return {
          ...s,
          status: "aprovado"
        };
      }
      return s;
    });
    setStatements(updated);
    showToast("Comprovante validado e repasses liberados pelo Admin!");
  };

  const handleCreateTicket = (e) => {
    e.preventDefault();
    if (!ticketSubject) return;
    const newT = {
      id: `TCK-${Math.floor(600 + Math.random() * 100)}`,
      deliveryId: selectedDeliveryForTicket ? selectedDeliveryForTicket.id : "Geral",
      openedByRole: currentRole,
      openedByName: currentUser.name,
      subject: ticketSubject,
      status: "aberto",
      priority: ticketPriority,
      createdAt: new Date().toISOString(),
      messages: [
        {
          sender: currentUser.name,
          text: ticketSubject,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };
    setTickets([newT, ...tickets]);
    setShowTicketModal(false);
    setTicketSubject("");
    showToast("Chamado aberto com sucesso! O Admin irá analisar.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {toastMsg && (
        <div data-testid="toast-notification" className="fixed top-5 right-5 z-50 bg-amber-500 text-slate-950 px-5 py-3 rounded-xl shadow-2xl font-bold flex items-center space-x-3 border border-amber-300 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3" data-testid="brand-header">
          <img
            src="https://customer-assets-7cd3h4nn.emergentagent.net/job_delivery-hub-1328/artifacts/cbmomf8e_image.png"
            alt="GiroExpress - Entregas rápidas e eficientes"
            data-testid="brand-logo"
            className="h-16 sm:h-20 w-auto rounded-xl shadow-lg shadow-orange-500/30 bg-white p-1.5"
          />
          <div className="hidden sm:block">
            <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">B2B2C P2P Logística</span>
            <p className="text-xs text-slate-400 mt-1">Plataforma de Entregas Sob Demanda</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
          <button 
            data-testid="role-tab-store"
            onClick={() => handleSwitchRole("store")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${currentRole === 'store' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <Store className="w-4 h-4" />
            <span>Painel Loja</span>
          </button>
          
          <button 
            data-testid="role-tab-courier"
            onClick={() => handleSwitchRole("courier")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${currentRole === 'courier' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <Bike className="w-4 h-4" />
            <span>Painel Motoboy</span>
          </button>

          <button 
            data-testid="role-tab-admin"
            onClick={() => handleSwitchRole("admin")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${currentRole === 'admin' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Master</span>
          </button>

          <button 
            data-testid="role-tab-client"
            onClick={() => handleSwitchRole("client")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${currentRole === 'client' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Cliente Final</span>
          </button>
        </div>

        <button 
          data-testid="open-pricing-table-btn"
          onClick={() => setShowPricingModal(true)}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-amber-400 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          <Calculator className="w-4 h-4" />
          <span>Tabela de Preços (0.5km - 15km)</span>
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-12 h-12 rounded-full object-cover border-2 border-amber-500" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 data-testid="current-user-name" className="font-bold text-lg text-white">{currentUser.name}</h2>
                <span className="text-xs uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono border border-amber-500/30">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentUser.email} {currentUser.address ? `• ${currentUser.address}` : ''}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentRole === 'courier' && (
              <div className="flex items-center space-x-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                <div className={`w-3 h-3 rounded-full ${currentUser.statusOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <span className="text-xs font-medium text-slate-300">
                  {currentUser.statusOnline ? 'Online (Pronto para chamados)' : 'Offline'}
                </span>
                <button 
                  data-testid="toggle-online-status-btn"
                  onClick={() => {
                    const next = !currentUser.statusOnline;
                    setCurrentUser({...currentUser, statusOnline: next});
                    showToast(next ? "Você está ONLINE no GiroExpress!" : "Você está OFFLINE.");
                  }}
                  className={`ml-2 px-3 py-1 rounded-lg text-xs font-bold transition ${currentUser.statusOnline ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  {currentUser.statusOnline ? 'Ficar Offline' : 'Ficar Online'}
                </button>
              </div>
            )}

            {currentRole === 'store' && (
              <button 
                data-testid="open-new-delivery-modal-btn"
                onClick={() => setShowNewDeliveryModal(true)}
                className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Solicitar Nova Entrega</span>
              </button>
            )}

            <button 
              data-testid="open-support-modal-btn"
              onClick={() => setShowTicketModal(true)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition"
            >
              <Headphones className="w-4 h-4" />
              <span>Abrir Chamado / Suporte</span>
            </button>
          </div>
        </div>

        {/* STORE VIEW */}
        {currentRole === 'store' && (
          <div className="space-y-6" data-testid="store-dashboard">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Extrato Acumulado da Semana</p>
                <h3 data-testid="store-weekly-balance" className="text-2xl font-black text-amber-400 mt-1">
                  R$ {currentUser.weeklyBalance?.toFixed(2) || "245.50"}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Fechamento domingo, vencimento terça-feira</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Entregas Realizadas (Semana)</p>
                <h3 className="text-2xl font-black text-white mt-1">
                  {deliveries.filter(d => d.storeId === currentUser.id).length} corridas
                </h3>
                <p className="text-xs text-emerald-400 mt-2">Até 3 entregas simultâneas por lote autorizadas</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-400">Configuração de Lote</p>
                  <p className="text-sm font-semibold text-white mt-1">Lote de até 3 entregas</p>
                </div>
                <div className="flex items-center justify-between mt-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-300">Permitir Lote Simultâneo</span>
                  <input 
                    type="checkbox" 
                    checked={isBatchAllowed} 
                    onChange={(e) => setIsBatchAllowed(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Fechamento Semanal e Comprovantes de Pagamento</span>
              </h3>
              <div className="space-y-3">
                {statements.filter(s => s.storeId === currentUser.id).map(stmt => (
                  <div key={stmt.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{stmt.id}</span>
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">{stmt.cycle}</span>
                      </div>
                      <p className="text-sm text-white font-semibold mt-1">Total: R$ {stmt.totalGrossAmount.toFixed(2)} ({stmt.totalDeliveriesCount} entregas)</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                        stmt.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        stmt.status === 'comprovante_enviado' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {stmt.status.replace('_', ' ').toUpperCase()}
                      </span>

                      {stmt.status === 'pendente_pagamento' && (
                        <button 
                          data-testid={`submit-proof-${stmt.id}`}
                          onClick={() => handleSubmitProof(stmt.id)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Enviar Comprovante (Pix/TED)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                <span>Minhas Solicitações de Entrega</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Cliente / Endereço</th>
                      <th className="py-3 px-4">Distância</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Motoboy</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {deliveries.filter(d => d.storeId === currentUser.id).map(d => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-4 px-4 font-mono font-bold text-amber-400">{d.id}</td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-white">{d.clientName}</p>
                          <p className="text-xs text-slate-400">{d.clientAddress}</p>
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-300">{d.distanceKm} km ({d.estimatedTimeMin} min)</td>
                        <td className="py-4 px-4 font-bold text-white">R$ {d.grossPrice.toFixed(2)}</td>
                        <td className="py-4 px-4 text-slate-300">{d.courierName || <span className="text-slate-500 italic">Aguardando...</span>}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            d.status === 'entregue' ? 'bg-emerald-500/20 text-emerald-400' :
                            d.status === 'em_andamento' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {d.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button 
                            data-testid={`chat-btn-${d.id}`}
                            onClick={() => setActiveChatDelivery(d)}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COURIER VIEW */}
        {currentRole === 'courier' && (
          <div className="space-y-6" data-testid="courier-dashboard">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Ganhos Líquidos Hoje</p>
                <h3 data-testid="courier-earnings" className="text-2xl font-black text-emerald-400 mt-1">
                  R$ {currentUser.netEarningsToday.toFixed(2)}
                </h3>
                <p className="text-xs text-slate-500 mt-2">Taxa admin R$ 1,00 deduzida</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Entregas Realizadas</p>
                <h3 className="text-2xl font-black text-white mt-1">{currentUser.totalDeliveries}</h3>
                <p className="text-xs text-amber-400 mt-2">Avaliação ⭐ {currentUser.rating}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Veículo Cadastrado</p>
                <h3 className="text-lg font-bold text-white mt-1">{currentUser.vehicle}</h3>
                <p className="text-xs text-emerald-400 mt-2">Status: Ativo na Base</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Gestão de Lotes</p>
                <h3 className="text-lg font-bold text-amber-400 mt-1">Até 3 Simultâneas</h3>
                <p className="text-xs text-slate-400 mt-2">Mesma loja autorizada</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                  <Bike className="w-5 h-5 text-amber-400" />
                  <span>Chamados de Entrega Disponíveis na Região</span>
                </h3>
                {!currentUser.statusOnline && (
                  <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full font-bold border border-rose-500/30">
                    Você está OFFLINE. Fique online para aceitar corridas.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deliveries.map(d => {
                  const isAssignedToMe = d.courierId === currentUser.id;
                  const isAvailable = d.status === 'pendente';

                  if (!isAvailable && !isAssignedToMe) return null;

                  return (
                    <div key={d.id} className={`bg-slate-950 border rounded-2xl p-5 space-y-4 ${isAssignedToMe ? 'border-amber-500/60 shadow-lg shadow-amber-500/10' : 'border-slate-800'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">{d.id}</span>
                        <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-full">{d.storeName}</span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-slate-400">Retirada (Loja):</p>
                            <p className="font-medium text-white">{d.storeAddress}</p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-slate-400">Entrega (Cliente): {d.clientName}</p>
                            <p className="font-medium text-white">{d.clientAddress}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="text-slate-400">Distância / Tempo:</p>
                          <p className="font-mono font-bold text-white">{d.distanceKm} km (~{d.estimatedTimeMin} min)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400">Valor Líquido (Motoboy):</p>
                          <p className="font-mono font-bold text-emerald-400 text-base">R$ {d.netCourier.toFixed(2)}</p>
                          <span className="text-[10px] text-slate-500">(Taxa admin R$ 1,00 deduzida)</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 pt-2">
                        {isAvailable && (
                          <button 
                            data-testid={`accept-delivery-btn-${d.id}`}
                            disabled={!currentUser.statusOnline}
                            onClick={() => handleAcceptDelivery(d.id)}
                            className={`flex-1 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition ${
                              currentUser.statusOnline 
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20' 
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Aceitar Corrida</span>
                          </button>
                        )}

                        {isAssignedToMe && d.status === 'em_andamento' && (
                          <button 
                            data-testid={`complete-delivery-btn-${d.id}`}
                            onClick={() => handleCompleteDelivery(d.id)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition"
                          >
                            <Check className="w-4 h-4" />
                            <span>Concluir Entrega</span>
                          </button>
                        )}

                        <button 
                          data-testid={`courier-chat-btn-${d.id}`}
                          onClick={() => setActiveChatDelivery(d)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ADMIN VIEW */}
        {currentRole === 'admin' && (
          <div className="space-y-6" data-testid="admin-dashboard">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Taxas Plataforma (R$ 1,00/cada)</p>
                <h3 data-testid="admin-fees-collected" className="text-2xl font-black text-amber-400 mt-1">R$ 3.420,00</h3>
                <p className="text-xs text-slate-500 mt-2">Monetização automática ativa</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Total de Usuários</p>
                <h3 className="text-2xl font-black text-white mt-1">{usersList.length} cadastrados</h3>
                <p className="text-xs text-emerald-400 mt-2">Lojas, Motoboys e Clientes</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Entregas Totais</p>
                <h3 className="text-2xl font-black text-white mt-1">{deliveries.length} corridas</h3>
                <p className="text-xs text-amber-400 mt-2">Histórico permanente</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Chamados de Suporte</p>
                <h3 className="text-2xl font-black text-rose-400 mt-1">{tickets.length} ocorrências</h3>
                <p className="text-xs text-slate-500 mt-2">Central de mediação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <span>Configuração Bancária do Administrador</span>
                </h3>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Banco:</span>
                    <span className="font-semibold text-white">{adminBank.bank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agência / Conta:</span>
                    <span className="font-semibold text-white">{adminBank.agency} / {adminBank.account}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chave PIX:</span>
                    <span className="font-semibold text-amber-400">{adminBank.pixKey}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-400">Taxa por Entrega:</span>
                    <span className="font-bold text-emerald-400">R$ {adminFeeVal.toFixed(2)} (Automática)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>Conferência de Comprovantes (Fechamento Semanal)</span>
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {statements.map(stmt => (
                    <div key={stmt.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white text-sm">{stmt.storeName}</p>
                        <p className="text-xs text-slate-400">{stmt.cycle}</p>
                        <p className="text-xs font-mono text-amber-400 mt-1">R$ {stmt.totalGrossAmount.toFixed(2)} ({stmt.totalDeliveriesCount} entregas)</p>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          stmt.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' :
                          stmt.status === 'comprovante_enviado' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {stmt.status.toUpperCase()}
                        </span>

                        {stmt.status === 'comprovante_enviado' && (
                          <button 
                            data-testid={`approve-statement-btn-${stmt.id}`}
                            onClick={() => handleAdminApproveStatement(stmt.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded text-xs transition"
                          >
                            Aprovar Repasse
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>Gestão Total de Usuários (Lojas e Motoboys)</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono">
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">Perfil</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ações Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                          <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" />
                          <span>{u.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs uppercase bg-slate-800 px-2 py-1 rounded text-amber-400 font-mono">{u.role}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">ATIVO</span>
                        </td>
                        <td className="py-3 px-4 flex items-center space-x-2">
                          <button 
                            data-testid={`block-user-${u.id}`}
                            onClick={() => showToast(`Usuário ${u.name} bloqueado/editado com sucesso.`)}
                            className="bg-slate-800 hover:bg-rose-900/40 text-rose-400 px-3 py-1 rounded text-xs border border-slate-700 transition"
                          >
                            Bloquear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                <Headphones className="w-5 h-5 text-amber-400" />
                <span>Central de Chamados e Ocorrências</span>
              </h3>

              <div className="space-y-3">
                {tickets.map(t => (
                  <div key={t.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{t.id}</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Entrega: {t.deliveryId}</span>
                        <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold uppercase">{t.priority}</span>
                      </div>
                      <p className="font-bold text-white text-sm mt-1">{t.subject}</p>
                      <p className="text-xs text-slate-400">Aberto por: {t.openedByName} ({t.openedByRole})</p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">
                        {t.status.toUpperCase()}
                      </span>
                      <button 
                        data-testid={`resolve-ticket-${t.id}`}
                        onClick={() => {
                          const updated = tickets.map(item => item.id === t.id ? {...item, status: 'resolvido'} : item);
                          setTickets(updated);
                          showToast(`Chamado ${t.id} marcado como resolvido.`);
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                      >
                        Intermediar / Resolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLIENT VIEW */}
        {currentRole === 'client' && (
          <div className="space-y-6" data-testid="client-dashboard">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl text-white">Rastreamento de Entregas em Tempo Real</h3>
                  <p className="text-xs text-slate-400 mt-1">Acompanhe seus pedidos GiroExpress</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/30">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-4">
                {deliveries.map(d => (
                  <div key={d.id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{d.id}</span>
                        <span className="text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded">{d.storeName}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        d.status === 'entregue' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-900 p-4 rounded-xl">
                      <div>
                        <p className="text-xs text-slate-400">Endereço de Destino:</p>
                        <p className="font-medium text-white">{d.clientAddress}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Motoboy Responsável:</p>
                        <p className="font-medium text-amber-400">{d.courierName || "Aguardando atribuição"}</p>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button 
                        data-testid={`client-chat-btn-${d.id}`}
                        onClick={() => setActiveChatDelivery(d)}
                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Falar com Motoboy / Loja</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* NEW DELIVERY MODAL */}
      {showNewDeliveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                <span>Solicitar Nova Entrega (GiroExpress)</span>
              </h3>
              <button onClick={() => setShowNewDeliveryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Endereço de Retirada (Loja)</label>
                <input 
                  type="text" 
                  value={newPickup} 
                  onChange={(e) => setNewPickup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Nome do Cliente Final</label>
                <input 
                  data-testid="new-delivery-client-name"
                  type="text" 
                  placeholder="Ex: Carlos Alberto" 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Endereço de Entrega (Cliente Final)</label>
                <input 
                  data-testid="new-delivery-client-address"
                  type="text" 
                  placeholder="Ex: Rua Augusta, 1500 - Consolação" 
                  value={newClientAddress} 
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Distância Estimada (Raio):</span>
                  <span className="font-mono font-bold text-amber-400">{newDistanceKm} km (~{pricingPreview.timeMin} min)</span>
                </div>
                <input 
                  data-testid="distance-slider"
                  type="range" 
                  min="0.5" 
                  max="15.0" 
                  step="0.5" 
                  value={newDistanceKm} 
                  onChange={(e) => setNewDistanceKm(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Valor Bruto da Corrida (Tabela):</span>
                  <span className="font-mono font-bold text-white">R$ {pricingPreview.grossPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Taxa do Administrador (Automática):</span>
                  <span className="font-mono font-bold text-rose-400">- R$ {pricingPreview.adminFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-300 font-semibold">Valor Líquido do Motoboy:</span>
                  <span className="font-mono font-bold text-emerald-400">R$ {pricingPreview.netCourier.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowNewDeliveryModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button 
                  data-testid="submit-new-delivery-btn"
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
                >
                  Confirmar e Solicitar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {activeChatDelivery && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full h-[500px] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-white text-sm">Chat GiroExpress</h3>
                  <span className="font-mono text-xs text-amber-400">{activeChatDelivery.id}</span>
                </div>
                <p className="text-xs text-slate-400">{activeChatDelivery.storeName} ➔ {activeChatDelivery.clientName}</p>
              </div>
              <button onClick={() => setActiveChatDelivery(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900/50">
              {(chats[activeChatDelivery.id] || []).map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-1">{msg.sender} • {msg.time}</span>
                  <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${
                    msg.sender === currentUser.name ? 'bg-amber-500 text-slate-950 font-medium' : 'bg-slate-800 text-slate-200'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
              <input 
                data-testid="chat-input-field"
                type="text" 
                placeholder="Digite sua mensagem..." 
                value={chatInputText} 
                onChange={(e) => setChatInputText(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') handleSendChatMessage(activeChatDelivery.id, chatInputText); }}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button 
                data-testid="chat-send-btn"
                onClick={() => handleSendChatMessage(activeChatDelivery.id, chatInputText)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-2.5 rounded-xl transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Headphones className="w-5 h-5 text-amber-400" />
                <span>Abrir Chamado / Ocorrência de Suporte</span>
              </h3>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Assunto / Motivo da Ocorrência</label>
                <input 
                  data-testid="ticket-subject-input"
                  type="text" 
                  placeholder="Ex: Atraso na entrega, avaria, divergência de valor..." 
                  value={ticketSubject} 
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Prioridade</label>
                <select 
                  value={ticketPriority} 
                  onChange={(e) => setTicketPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta (Urgente)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button 
                  data-testid="submit-ticket-btn"
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
                >
                  Enviar Chamado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICING TABLE MODAL */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full h-[600px] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Tabela Oficial de Precificação Automática</h3>
                <p className="text-xs text-slate-400">Cálculo por distância (raio) com taxa fixa de R$ 1,00 para o Admin</p>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-2">
              <div className="grid grid-cols-3 font-mono text-xs text-slate-400 border-b border-slate-800 pb-2 px-3">
                <span>Distância (Raio)</span>
                <span>Preço Bruto</span>
                <span>Tempo Est.</span>
              </div>
              {PRICING_TABLE.map((row, idx) => (
                <div key={idx} className="grid grid-cols-3 text-sm p-3 rounded-xl bg-slate-950 hover:bg-slate-800/50 transition border border-slate-800/60 font-mono">
                  <span className="text-amber-400 font-bold">{row.km} km</span>
                  <span className="text-white font-semibold">R$ {row.price.toFixed(2)}</span>
                  <span className="text-slate-400">{row.timeMin} min</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowPricingModal(false)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
