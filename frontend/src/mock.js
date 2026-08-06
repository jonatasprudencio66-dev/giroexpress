import json
from datetime import datetime, timezone

# 1. PRICING TABLE (0.5 km to 15.0 km)
export const PRICING_TABLE = [
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

export function calculatePriceByDistance(km) {
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

export const INITIAL_USERS = [
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

export const INITIAL_DELIVERIES = [
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

export const INITIAL_STATEMENTS = [
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

export const INITIAL_TICKETS = [
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

export const INITIAL_CHATS = {
  "DEL-9001": [
    { sender: "Burger King Paulista", text: "Olá Carlos, o pedido está saindo quente agora!", time: "14:31" },
    { sender: "Carlos Motoboy", text: "Perfeito, chego na loja em 3 minutos.", time: "14:32" }
  ]
};
