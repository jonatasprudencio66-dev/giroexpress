import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Layout from "../components/Layout";
import ChatModal from "../components/ChatModal";
import {
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";
import {
  api,
  apiError,
  createUserWebSocket,
} from "../lib/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

export default function StoreDashboard() {
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] =
    useState("deliveries");

  const [deliveries, setDeliveries] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [deliveryModal, setDeliveryModal] =
    useState(false);

  const [productModal, setProductModal] =
    useState(false);

  const [
    activeChatDelivery,
    setActiveChatDelivery,
  ] = useState(null);

  // ============================================================
  // MENSAGENS NÃO LIDAS
  // ============================================================

  const [unreadMessages, setUnreadMessages] =
    useState({});

  const activeChatDeliveryRef =
    useRef(null);

  const [deliveryForm, setDeliveryForm] =
    useState({
      pickup_address: "Loja",
      dropoff_address: "",
      client_name: "",
      client_phone: "",
      distance_km: 2,
      price: "8.00",
      notes: "",
      delivery_type: "city",
    });

  const [productForm, setProductForm] =
    useState({
      name: "",
      description: "",
      price: "",
      category: "Geral",
    });

  // ============================================================
  // REFERÊNCIA DO ÁUDIO
  // ============================================================

  const audioContextRef =
    useRef(null);

  // ============================================================
  // REFERÊNCIA DO CHAT ABERTO
  // ============================================================

  useEffect(() => {
    activeChatDeliveryRef.current =
      activeChatDelivery;
  }, [activeChatDelivery]);

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [delRes, prodRes] =
        await Promise.all([
          api
            .get("/deliveries")
            .catch(() => ({
              data: [],
            })),

          api
            .get("/products")
            .catch(() => ({
              data: [],
            })),
        ]);

      const delData =
        delRes?.data;

      const prodData =
        prodRes?.data;

      if (Array.isArray(delData)) {
        setDeliveries(delData);
      } else if (
        Array.isArray(
          delData?.deliveries
        )
      ) {
        setDeliveries(
          delData.deliveries
        );
      } else {
        setDeliveries([]);
      }

      if (Array.isArray(prodData)) {
        setProducts(prodData);
      } else if (
        Array.isArray(
          prodData?.products
        )
      ) {
        setProducts(
          prodData.products
        );
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error(
        "Erro ao carregar dados:",
        error
      );

      toast.error(
        apiError(error)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // LIBERAR ÁUDIO APÓS INTERAÇÃO DO USUÁRIO
  // ============================================================

  useEffect(() => {
    const unlockAudio =
      async () => {
        try {
          const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

          if (!AudioContext) {
            return;
          }

          if (!audioContextRef.current) {
            audioContextRef.current =
              new AudioContext();
          }

          if (
            audioContextRef.current
              .state === "suspended"
          ) {
            await audioContextRef.current.resume();
          }

          console.log(
            "[GiroExpress] Áudio liberado."
          );
        } catch (error) {
          console.warn(
            "[GiroExpress] Não foi possível liberar o áudio:",
            error
          );
        }
      };

    const handleUserInteraction =
      () => {
        unlockAudio();
      };

    window.addEventListener(
      "pointerdown",
      handleUserInteraction,
      { passive: true }
    );

    window.addEventListener(
      "keydown",
      handleUserInteraction
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleUserInteraction
      );

      window.removeEventListener(
        "keydown",
        handleUserInteraction
      );
    };
  }, []);

  // ============================================================
  // PEDIR PERMISSÃO DE NOTIFICAÇÃO
  // ============================================================

  useEffect(() => {
    const requestPermission =
      async () => {
        try {
          if (
            !("Notification" in window)
          ) {
            return;
          }

          if (
            Notification.permission ===
            "default"
          ) {
            const permission =
              await Notification.requestPermission();

            console.log(
              "[GiroExpress] Permissão de notificação:",
              permission
            );
          }
        } catch (error) {
          console.warn(
            "[GiroExpress] Não foi possível solicitar permissão:",
            error
          );
        }
      };

    const handleInteraction =
      () => {
        requestPermission();
      };

    window.addEventListener(
      "pointerdown",
      handleInteraction,
      {
        once: true,
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleInteraction
      );
    };
  }, []);

  // ============================================================
  // SOM DA NOTIFICAÇÃO
  // ============================================================

  const playBeep =
    useCallback(() => {
      try {
        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) {
          console.warn(
            "[GiroExpress] AudioContext não disponível."
          );

          return;
        }

        if (!audioContextRef.current) {
          audioContextRef.current =
            new AudioContext();
        }

        const audioContext =
          audioContextRef.current;

        if (
          audioContext.state ===
          "suspended"
        ) {
          audioContext
            .resume()
            .catch(() => {});
        }

        const now =
          audioContext.currentTime;

        const oscillator =
          audioContext.createOscillator();

        const gainNode =
          audioContext.createGain();

        oscillator.type =
          "sine";

        oscillator.frequency.setValueAtTime(
          880,
          now
        );

        oscillator.frequency.setValueAtTime(
          1175,
          now + 0.12
        );

        gainNode.gain.setValueAtTime(
          0.0001,
          now
        );

        gainNode.gain.exponentialRampToValueAtTime(
          0.25,
          now + 0.02
        );

        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.45
        );

        oscillator.connect(
          gainNode
        );

        gainNode.connect(
          audioContext.destination
        );

        oscillator.start(now);

        oscillator.stop(
          now + 0.5
        );

        console.log(
          "[GiroExpress] 🔊 Som de nova mensagem executado."
        );
      } catch (error) {
        console.warn(
          "[GiroExpress] Não foi possível reproduzir o som:",
          error
        );
      }
    }, []);

  // ============================================================
  // NOTIFICAÇÃO DO NAVEGADOR
  // ============================================================

  const showBrowserNotification =
    useCallback(
      (
        senderName,
        message,
        deliveryId
      ) => {
        try {
          if (
            !("Notification" in window)
          ) {
            console.warn(
              "[GiroExpress] Este navegador não suporta notificações."
            );

            return;
          }

          if (
            Notification.permission !==
            "granted"
          ) {
            console.warn(
              "[GiroExpress] Notificação sem permissão. Permissão atual:",
              Notification.permission
            );

            return;
          }

          const notification =
            new Notification(
              `💬 Nova mensagem de ${senderName}`,
              {
                body: message,
                icon: "/favicon.ico",
                tag: `giroexpress-chat-${
                  deliveryId ||
                  "chat"
                }`,
                renotify: true,
              }
            );

          notification.onclick =
            () => {
              try {
                window.focus();

                notification.close();

                if (deliveryId) {
                  const delivery =
                    deliveries.find(
                      (item) =>
                        String(
                          item.id ||
                            item._id
                        ) ===
                        String(
                          deliveryId
                        )
                    );

                  if (delivery) {
                    setUnreadMessages(
                      (previous) => {
                        const updated = {
                          ...previous,
                        };

                        delete updated[
                          String(
                            deliveryId
                          )
                        ];

                        return updated;
                      }
                    );

                    setActiveChatDelivery(
                      delivery
                    );
                  }
                }
              } catch (_) {}
            };

          setTimeout(() => {
            try {
              notification.close();
            } catch (_) {}
          }, 7000);

          console.log(
            "[GiroExpress] 🔔 Notificação do navegador exibida."
          );
        } catch (error) {
          console.warn(
            "[GiroExpress] Erro na notificação:",
            error
          );
        }
      },
      [deliveries]
    );

  // ============================================================
  // WEBSOCKET DA LOJA
  // MOTOBOY -> LOJA
  // ============================================================

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    const userId =
      currentUser.id ||
      currentUser._id;

    if (!userId) {
      console.warn(
        "[GiroExpress] Usuário da loja sem ID para WebSocket."
      );

      return undefined;
    }

    const normalizedUserId =
      String(userId);

    let ws = null;
    let reconnectTimer = null;
    let isUnmounted = false;

    // ==========================================================
    // CONECTAR
    // ==========================================================

    const connectWebSocket =
      () => {
        if (isUnmounted) {
          return;
        }

        try {
          console.log(
            "[GiroExpress] ======================================="
          );

          console.log(
            "[GiroExpress] Conectando WebSocket da loja..."
          );

          console.log(
            "[GiroExpress] ID da loja:",
            normalizedUserId
          );

          ws =
            createUserWebSocket(
              normalizedUserId
            );

          if (!ws) {
            console.warn(
              "[GiroExpress] WebSocket não foi criado."
            );

            reconnectTimer =
              setTimeout(
                connectWebSocket,
                3000
              );

            return;
          }

          // ====================================================
          // CONECTADO
          // ====================================================

          ws.onopen = () => {
            console.log(
              "[GiroExpress] ✅ WebSocket da loja conectado."
            );

            console.log(
              "[GiroExpress] Aguardando mensagens do motoboy..."
            );
          };

          // ====================================================
          // MENSAGEM RECEBIDA
          // ====================================================

          ws.onmessage = (
            event
          ) => {
            try {
              console.log(
                "[GiroExpress] 📩 Evento WebSocket recebido:",
                event.data
              );

              let data;

              try {
                data = JSON.parse(
                  event.data
                );
              } catch (
                parseError
              ) {
                console.warn(
                  "[GiroExpress] Mensagem WebSocket não é JSON:",
                  event.data
                );

                return;
              }

              console.log(
                "[GiroExpress] 📩 Dados recebidos:",
                data
              );

              // ==================================================
              // TIPO DA MENSAGEM
              // ==================================================

              const messageType =
                String(
                  data?.type || ""
                ).toLowerCase();

              console.log(
                "[GiroExpress] Tipo recebido:",
                messageType
              );

              const acceptedType =
                messageType ===
                  "chat_message" ||
                messageType ===
                  "message" ||
                messageType === "";

              if (!acceptedType) {
                console.log(
                  "[GiroExpress] Evento ignorado por tipo:",
                  messageType
                );

                return;
              }

              // ==================================================
              // NÃO ALERTAR A PRÓPRIA LOJA
              // ==================================================

              const senderId =
                data?.sender_id
                  ? String(
                      data.sender_id
                    )
                  : "";

              if (
                senderId &&
                senderId ===
                  normalizedUserId
              ) {
                console.log(
                  "[GiroExpress] Mensagem enviada pela própria loja. Ignorando alerta."
                );

                return;
              }

              // ==================================================
              // TEXTO
              // ==================================================

              const rawText =
                data?.text ??
                data?.message ??
                "";

              const messageText =
                String(
                  rawText
                ).trim();

              if (!messageText) {
                console.warn(
                  "[GiroExpress] Evento recebido sem texto:",
                  data
                );

                return;
              }

              // ==================================================
              // REMETENTE
              // ==================================================

              const senderName =
                String(
                  data?.sender_name ||
                    data?.sender_role ||
                    "Motoboy"
                )
                  .replace(
                    /^#+/,
                    ""
                  )
                  .trim();

              const deliveryId =
                data?.delivery_id
                  ? String(
                      data.delivery_id
                    )
                  : null;

              console.log(
                "[GiroExpress] ======================================="
              );

              console.log(
                "[GiroExpress] 💬 NOVA MENSAGEM DO MOTOBOY"
              );

              console.log(
                "[GiroExpress] Remetente:",
                senderName
              );

              console.log(
                "[GiroExpress] Mensagem:",
                messageText
              );

              console.log(
                "[GiroExpress] Entrega:",
                deliveryId
              );

              // ==================================================
              // MARCAR COMO NÃO LIDA
              // ==================================================

              if (deliveryId) {
                const activeDelivery =
                  activeChatDeliveryRef.current;

                const activeId =
                  activeDelivery
                    ? String(
                        activeDelivery.id ||
                          activeDelivery._id ||
                          ""
                      )
                    : "";

                if (
                  activeId !==
                  deliveryId
                ) {
                  setUnreadMessages(
                    (previous) => ({
                      ...previous,

                      [deliveryId]:
                        (previous[
                          deliveryId
                        ] || 0) + 1,
                    })
                  );

                  console.log(
                    "[GiroExpress] 🔴 Mensagem marcada como não lida:",
                    deliveryId
                  );
                } else {
                  console.log(
                    "[GiroExpress] Chat está aberto. Não criando contador."
                  );
                }
              }

              // ==================================================
              // 1. SOM
              // ==================================================

              playBeep();

              // ==================================================
              // 2. TOAST
              // ==================================================

              toast.success(
                `💬 Nova mensagem de ${senderName}: ${messageText}`,
                {
                  duration: 6000,
                  position:
                    "top-right",
                }
              );

              // ==================================================
              // 3. NOTIFICAÇÃO DO NAVEGADOR
              // ==================================================

              showBrowserNotification(
                senderName,
                messageText,
                deliveryId
              );

              // ==================================================
              // 4. ATUALIZAR DADOS
              // ==================================================

              loadData();

              // ==================================================
              // 5. CHAT ABERTO
              // ==================================================

              if (
                deliveryId &&
                activeChatDeliveryRef.current
              ) {
                const activeId =
                  String(
                    activeChatDeliveryRef.current
                      .id ||
                      activeChatDeliveryRef.current
                        ._id ||
                      ""
                  );

                if (
                  activeId ===
                  deliveryId
                ) {
                  console.log(
                    "[GiroExpress] Mensagem pertence ao chat aberto."
                  );
                }
              }
            } catch (error) {
              console.error(
                "[GiroExpress] ❌ Erro ao processar mensagem WebSocket:",
                error
              );
            }
          };

          // ====================================================
          // ERRO
          // ====================================================

          ws.onerror = (
            error
          ) => {
            console.warn(
              "[GiroExpress] ⚠️ WebSocket da loja apresentou erro:",
              error
            );
          };

          // ====================================================
          // FECHADO
          // ====================================================

          ws.onclose = (
            event
          ) => {
            console.log(
              "[GiroExpress] WebSocket da loja desconectado.",
              {
                code: event?.code,
                reason:
                  event?.reason,
              }
            );

            if (
              !isUnmounted
            ) {
              reconnectTimer =
                setTimeout(
                  () => {
                    console.log(
                      "[GiroExpress] Tentando reconectar WebSocket da loja..."
                    );

                    connectWebSocket();
                  },
                  3000
                );
            }
          };
        } catch (error) {
          console.warn(
            "[GiroExpress] Não foi possível conectar ao WebSocket da loja:",
            error
          );

          if (
            !isUnmounted
          ) {
            reconnectTimer =
              setTimeout(
                connectWebSocket,
                3000
              );
          }
        }
      };

    // ==========================================================
    // INICIAR
    // ==========================================================

    connectWebSocket();

    // ==========================================================
    // LIMPEZA
    // ==========================================================

    return () => {
      isUnmounted = true;

      if (reconnectTimer) {
        clearTimeout(
          reconnectTimer
        );
      }

      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;

          ws.close();
        } catch (error) {
          console.warn(
            "[GiroExpress] Erro ao fechar WebSocket:",
            error
          );
        }
      }
    };
  }, [
    currentUser,
    loadData,
    playBeep,
    showBrowserNotification,
  ]);

  // ============================================================
  // ATUALIZAÇÃO AUTOMÁTICA
  // ============================================================

  useEffect(() => {
    loadData();

    const interval =
      setInterval(() => {
        loadData();
      }, 5000);

    return () => {
      clearInterval(
        interval
      );
    };
  }, [loadData]);

  // ============================================================
  // CRIAR ENTREGA
  // ============================================================

  const handleCreateDelivery =
    async (event) => {
      event.preventDefault();

      const finalPrice =
        Number(
          deliveryForm.price
        );

      if (
        !Number.isFinite(
          finalPrice
        ) ||
        finalPrice <= 0
      ) {
        toast.error(
          "Informe um valor de entrega válido."
        );

        return;
      }

      if (
        !deliveryForm.client_name.trim()
      ) {
        toast.error(
          "Informe o nome do cliente."
        );

        return;
      }

      if (
        !deliveryForm.dropoff_address.trim()
      ) {
        toast.error(
          "Informe o endereço de destino."
        );

        return;
      }

      try {
        await api.post(
          "/deliveries",
          {
            ...deliveryForm,

            pickup_address:
              deliveryForm.pickup_address.trim(),

            dropoff_address:
              deliveryForm.dropoff_address.trim(),

            client_name:
              deliveryForm.client_name.trim(),

            client_phone:
              deliveryForm.client_phone.trim(),

            notes:
              deliveryForm.notes.trim(),

            price: finalPrice,

            distance_km:
              Number(
                deliveryForm.distance_km
              ) || 0,
          }
        );

        toast.success(
          "Corrida solicitada com sucesso!"
        );

        setDeliveryModal(
          false
        );

        setDeliveryForm({
          pickup_address: "Loja",
          dropoff_address: "",
          client_name: "",
          client_phone: "",
          distance_km: 2,
          price: "8.00",
          notes: "",
          delivery_type: "city",
        });

        await loadData();
      } catch (error) {
        console.error(
          "Erro ao criar entrega:",
          error
        );

        toast.error(
          apiError(error)
        );
      }
    };

  // ============================================================
  // CRIAR PRODUTO
  // ============================================================

  const handleCreateProduct =
    async (event) => {
      event.preventDefault();

      const productPrice =
        Number(
          productForm.price
        );

      if (
        !Number.isFinite(
          productPrice
        ) ||
        productPrice <= 0
      ) {
        toast.error(
          "Informe um preço válido para o produto."
        );

        return;
      }

      if (
        !productForm.name.trim()
      ) {
        toast.error(
          "Informe o nome do produto."
        );

        return;
      }

      try {
        await api.post(
          "/products",
          {
            ...productForm,

            name:
              productForm.name.trim(),

            description:
              productForm.description.trim(),

            category:
              productForm.category.trim() ||
              "Geral",

            price: productPrice,
          }
        );

        toast.success(
          "Produto cadastrado no cardápio!"
        );

        setProductModal(
          false
        );

        setProductForm({
          name: "",
          description: "",
          price: "",
          category: "Geral",
        });

        await loadData();
      } catch (error) {
        console.error(
          "Erro ao criar produto:",
          error
        );

        toast.error(
          apiError(error)
        );
      }
    };

  // ============================================================
  // EXCLUIR PRODUTO
  // ============================================================

  const handleDeleteProduct =
    async (id) => {
      if (!id) {
        toast.error(
          "Produto inválido."
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Deseja remover este produto?"
        );

      if (!confirmed) {
        return;
      }

      try {
        await api.delete(
          `/products/${id}`
        );

        toast.success(
          "Produto removido."
        );

        await loadData();
      } catch (error) {
        console.error(
          "Erro ao excluir produto:",
          error
        );

        toast.error(
          apiError(error)
        );
      }
    };

  // ============================================================
  // OPÇÕES DE ENTREGA
  // ============================================================

  const deliveryOptions = [
    {
      id: "city",
      label:
        "Entregas dentro da cidade",
      price: 8,
      address:
        "Cidade - ",
    },

    {
      id: "city_condominium",
      label:
        "Condomínio dentro da cidade",
      price: 10,
      address:
        "Condomínio (Cidade) - ",
    },

    {
      id: "nearby_condominium",
      label:
        "Condomínios próximo (Raízes e Botânico)",
      price: 12,
      address:
        "Cond. Raízes / Botânico - ",
    },

    {
      id: "reserva_bosque",
      label:
        "Condomínio Reserva do Bosque",
      price: 15,
      address:
        "Cond. Reserva do Bosque - ",
    },

    {
      id: "distant_condominium",
      label:
        "Condomínios afastados (Bella Vitta e Garden RNI)",
      price: 20,
      address:
        "Cond. Bella Vitta / Garden RNI - ",
    },
  ];

  // ============================================================
  // TELA
  // ============================================================

  return (
    <Layout
      subtitle="Painel da Loja"
      right={
        <div className="flex space-x-3">
          {activeTab ===
          "deliveries" ? (
            <button
              type="button"
              onClick={() =>
                setDeliveryModal(
                  true
                )
              }
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-medium transition"
            >
              <Plus className="w-5 h-5" />

              <span>
                Nova Entrega
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setProductModal(
                  true
                )
              }
              className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-medium transition"
            >
              <Plus className="w-5 h-5" />

              <span>
                Novo Produto
              </span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">

        {/* =====================================================
            ABAS
        ====================================================== */}

        <div className="flex border-b border-slate-800 space-x-6">
          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "deliveries"
              )
            }
            className={`pb-3 font-medium text-sm transition border-b-2 ${
              activeTab ===
              "deliveries"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Acompanhar Entregas
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "products"
              )
            }
            className={`pb-3 font-medium text-sm transition border-b-2 ${
              activeTab ===
              "products"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Gerenciar Cardápio /
            Produtos
          </button>
        </div>

        {/* =====================================================
            ENTREGAS
        ====================================================== */}

        {activeTab ===
          "deliveries" && (
          <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">
                  Total de Entregas
                </span>

                <p className="text-2xl font-bold text-white mt-2">
                  {
                    deliveries.length
                  }
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">
                  Em Andamento
                </span>

                <p className="text-2xl font-bold text-white mt-2">
                  {
                    deliveries.filter(
                      (
                        delivery
                      ) =>
                        [
                          "pending",
                          "accepted",
                          "picked_up",
                        ].includes(
                          String(
                            delivery.status ||
                              ""
                          ).toLowerCase()
                        )
                    ).length
                  }
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">
                  Concluídas
                </span>

                <p className="text-2xl font-bold text-white mt-2">
                  {
                    deliveries.filter(
                      (
                        delivery
                      ) =>
                        [
                          "delivered",
                          "completed",
                        ].includes(
                          String(
                            delivery.status ||
                              ""
                          ).toLowerCase()
                        )
                    ).length
                  }
                </p>
              </div>

            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

              <h2 className="text-lg font-bold text-white mb-4">
                Lista de Pedidos e
                Corridas
              </h2>

              {loading ? (
                <p className="text-slate-500 text-center py-8">
                  Carregando...
                </p>
              ) : deliveries.length ===
                0 ? (
                <p className="text-slate-500 text-center py-8">
                  Nenhuma entrega
                  registrada ainda.
                </p>
              ) : (
                <div className="space-y-4">

                  {deliveries.map(
                    (
                      delivery
                    ) => {
                      const deliveryId =
                        delivery.id ||
                        delivery._id;

                      const orderCode =
                        String(
                          delivery.code ||
                            "PEDIDO"
                        )
                          .replace(
                            /^#+/,
                            ""
                          )
                          .trim();

                      const status =
                        String(
                          delivery.status ||
                            "pendente"
                        ).toUpperCase();

                      const deliveryPrice =
                        Number(
                          delivery.price ||
                            delivery.gross_price ||
                            0
                        );

                      const courierName =
                        delivery.courier_name
                          ? String(
                              delivery.courier_name
                            )
                              .replace(
                                /^#+/,
                                ""
                              )
                              .trim()
                          : "";

                      const unreadCount =
                        unreadMessages[
                          String(
                            deliveryId
                          )
                        ] || 0;

                      return (
                        <div
                          key={
                            deliveryId
                          }
                          className="border border-slate-800 bg-slate-950/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >

                          <div>

                            <div className="flex items-center space-x-2">

                              <span className="font-semibold text-orange-400 text-sm">
                                {
                                  orderCode
                                }
                              </span>

                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {
                                  status
                                }
                              </span>

                            </div>

                            <p className="text-white font-medium mt-1">
                              Cliente:{" "}
                              {
                                delivery.client_name ||
                                "-"
                              }
                            </p>

                            <p className="text-slate-400 text-sm">
                              Destino:{" "}
                              {
                                delivery.dropoff_address ||
                                "-"
                              }
                            </p>

                            {courierName && (
                              <p className="text-slate-500 text-xs mt-1">
                                Motoboy:{" "}
                                {
                                  courierName
                                }
                              </p>
                            )}

                          </div>

                          <div className="flex items-center space-x-4">

                            <div className="text-right">

                              <p className="text-emerald-400 font-bold">
                                R${" "}
                                {deliveryPrice.toFixed(
                                  2
                                )}
                              </p>

                              <span className="text-xs text-slate-500">
                                Taxa adm:
                                R$ 1,00
                              </span>

                            </div>

                            {/* =================================================
                                BOTÃO CHAT COM INDICADOR DE NOVA MENSAGEM
                            ================================================== */}

                            <button
                              type="button"
                              onClick={() => {
                                const id =
                                  String(
                                    deliveryId
                                  );

                                setUnreadMessages(
                                  (previous) => {
                                    const updated =
                                      {
                                        ...previous,
                                      };

                                    delete updated[
                                      id
                                    ];

                                    return updated;
                                  }
                                );

                                setActiveChatDelivery(
                                  delivery
                                );
                              }}
                              className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium transition border ${
                                unreadCount >
                                0
                                  ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/60 shadow-lg shadow-orange-500/10 animate-pulse"
                                  : "bg-slate-800 hover:bg-slate-700 text-orange-400 border-slate-700"
                              }`}
                            >
                              <MessageSquare className="w-4 h-4" />

                              <span>
                                Chat
                              </span>

                              {unreadCount >
                                0 && (
                                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-slate-950 shadow-lg">
                                  {unreadCount >
                                  99
                                    ? "99+"
                                    : unreadCount}
                                </span>
                              )}
                            </button>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>
          </div>
        )}

        {/* =====================================================
            PRODUTOS
        ====================================================== */}

        {activeTab ===
          "products" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

            <h2 className="text-lg font-bold text-white mb-4">
              Itens Cadastrados no
              Cardápio
            </h2>

            {products.length ===
            0 ? (
              <p className="text-slate-500 text-center py-8">
                Nenhum produto
                cadastrado.
                Clique em "Novo
                Produto" acima.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {products.map(
                  (product) => {
                    const productId =
                      product.id ||
                      product._id;

                    return (
                      <div
                        key={
                          productId
                        }
                        className="border border-slate-800 bg-slate-950 p-4 rounded-xl flex flex-col justify-between"
                      >

                        <div>

                          <div className="flex justify-between items-start gap-3">

                            <h3 className="text-white font-bold">
                              {
                                product.name
                              }
                            </h3>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteProduct(
                                  productId
                                )
                              }
                              className="text-slate-500 hover:text-red-400 transition"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>

                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                            {
                              product.description ||
                              "Sem descrição"
                            }
                          </p>

                          <span className="inline-block bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded mt-2">
                            {
                              product.category ||
                              "Geral"
                            }
                          </span>

                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">

                          <span className="text-emerald-400 font-bold">
                            R${" "}
                            {Number(
                              product.price ||
                                0
                            ).toFixed(
                              2
                            )}
                          </span>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </div>
        )}

      </div>

      {/* =======================================================
          MODAL NOVA ENTREGA
      ======================================================== */}

      {deliveryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">

            <h3 className="text-xl font-bold text-white">
              Solicitar Nova Entrega
            </h3>

            <form
              onSubmit={
                handleCreateDelivery
              }
              className="space-y-4"
            >

              <div>

                <label className="block text-sm text-slate-400 mb-2">
                  1. Selecione a Região /
                  Taxa de Entrega
                </label>

                <div className="grid grid-cols-1 gap-2">

                  {deliveryOptions.map(
                    (item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDeliveryForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              pickup_address:
                                "Loja",
                              price: String(
                                item.price
                              ),
                              dropoff_address:
                                item.address,
                              notes: `${item.label} - R$ ${item.price},00`,
                              delivery_type:
                                item.id,
                            })
                          );
                        }}
                        className={`text-left px-3 py-2.5 rounded-xl text-xs flex justify-between items-center transition border ${
                          deliveryForm.delivery_type ===
                          item.id
                            ? "bg-orange-600/20 border-orange-500 text-orange-300 font-medium"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >

                        <span>
                          {
                            item.label
                          }
                        </span>

                        <span className="font-bold text-emerald-400 text-sm">
                          R${" "}
                          {item.price
                            .toFixed(
                              2
                            )
                            .replace(
                              ".",
                              ","
                            )}
                        </span>

                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryForm(
                        (
                          previous
                        ) => ({
                          ...previous,
                          pickup_address:
                            "Loja",
                          price: "",
                          notes:
                            "Entrega personalizada",
                          delivery_type:
                            "custom",
                        })
                      );
                    }}
                    className={`text-left px-3 py-2.5 rounded-xl text-xs flex justify-between items-center transition border ${
                      deliveryForm.delivery_type ===
                      "custom"
                        ? "bg-orange-600/20 border-orange-500 text-orange-300 font-medium"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >

                    <span>
                      Entrega
                      Personalizada
                    </span>

                    <span className="font-bold text-emerald-400 text-sm">
                      Definir valor
                    </span>

                  </button>

                </div>

                {deliveryForm.delivery_type ===
                  "custom" && (
                  <div className="mt-3 p-4 rounded-xl bg-orange-600/10 border border-orange-500/30 space-y-3">

                    <p className="text-orange-300 text-xs">
                      Use esta opção
                      para destinos
                      mais distantes
                      ou que não
                      estejam nas
                      regiões
                      cadastradas.
                    </p>

                    <div>

                      <label className="block text-sm text-slate-400 mb-1">
                        Valor personalizado
                        da entrega
                        (R$)
                      </label>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={
                          deliveryForm.price
                        }
                        onChange={(
                          event
                        ) =>
                          setDeliveryForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              price:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-orange-500/50 rounded-xl px-4 py-2 text-white font-bold text-emerald-400 focus:outline-none focus:border-orange-500"
                        placeholder="Ex: 25.00"
                      />

                    </div>

                  </div>
                )}

              </div>

              <div className="pt-2 border-t border-slate-800 space-y-4">

                <div>

                  <label className="block text-sm text-slate-400 mb-1">
                    Nome do Cliente
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      deliveryForm.client_name
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryForm(
                        (
                          previous
                        ) => ({
                          ...previous,
                          client_name:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Ex: João da Silva"
                  />

                </div>

                <div>

                  <label className="block text-sm text-slate-400 mb-1">
                    Endereço Completo
                    (Rua, Número,
                    Lote...)
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      deliveryForm.dropoff_address
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryForm(
                        (
                          previous
                        ) => ({
                          ...previous,
                          dropoff_address:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Ex: Rua Tiradentes, 281 (ou Lote 12)"
                  />

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm text-slate-400 mb-1">
                      Telefone
                    </label>

                    <input
                      type="text"
                      value={
                        deliveryForm.client_phone
                      }
                      onChange={(
                        event
                      ) =>
                        setDeliveryForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            client_phone:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                      placeholder="(17) 9..."
                    />

                  </div>

                  <div>

                    <label className="block text-sm text-slate-400 mb-1">
                      Valor Final
                      (R$)
                    </label>

                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={
                        deliveryForm.price
                      }
                      disabled={
                        deliveryForm.delivery_type !==
                        "custom"
                      }
                      onChange={(
                        event
                      ) =>
                        setDeliveryForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            price:
                              event.target
                                .value,
                          })
                        )
                      }
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-emerald-400 focus:outline-none focus:border-orange-500 ${
                        deliveryForm.delivery_type !==
                        "custom"
                          ? "opacity-70 cursor-not-allowed"
                          : ""
                      }`}
                    />

                    {deliveryForm.delivery_type !==
                      "custom" && (
                      <p className="text-xs text-slate-500 mt-1">
                        O valor é
                        definido pela
                        região
                        selecionada.
                      </p>
                    )}

                  </div>

                </div>

              </div>

              <div className="flex justify-end space-x-3 pt-3">

                <button
                  type="button"
                  onClick={() =>
                    setDeliveryModal(
                      false
                    )
                  }
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

      {/* =======================================================
          MODAL PRODUTO
      ======================================================== */}

      {productModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">

            <h3 className="text-xl font-bold text-white">
              Cadastrar Novo Produto
            </h3>

            <form
              onSubmit={
                handleCreateProduct
              }
              className="space-y-4"
            >

              <div>

                <label className="block text-sm text-slate-400 mb-1">
                  Nome do Produto
                </label>

                <input
                  type="text"
                  required
                  value={
                    productForm.name
                  }
                  onChange={(
                    event
                  ) =>
                    setProductForm(
                      (
                        previous
                      ) => ({
                        ...previous,
                        name: event.target
                          .value,
                      })
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Porção de Frango com Fritas"
                />

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="block text-sm text-slate-400 mb-1">
                    Preço (R$)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={
                      productForm.price
                    }
                    onChange={(
                      event
                    ) =>
                      setProductForm(
                        (
                          previous
                        ) => ({
                          ...previous,
                          price:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="49.90"
                  />

                </div>

                <div>

                  <label className="block text-sm text-slate-400 mb-1">
                    Categoria
                  </label>

                  <input
                    type="text"
                    value={
                      productForm.category
                    }
                    onChange={(
                      event
                    ) =>
                      setProductForm(
                        (
                          previous
                        ) => ({
                          ...previous,
                          category:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                    placeholder="Porções, Bebidas..."
                  />

                </div>

              </div>

              <div>

                <label className="block text-sm text-slate-400 mb-1">
                  Descrição
                </label>

                <textarea
                  value={
                    productForm.description
                  }
                  onChange={(
                    event
                  ) =>
                    setProductForm(
                      (
                        previous
                      ) => ({
                        ...previous,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                  placeholder="Ingredientes e detalhes..."
                  rows={2}
                />

              </div>

              <div className="flex justify-end space-x-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setProductModal(
                      false
                    )
                  }
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

      {/* =======================================================
          CHAT
      ======================================================== */}

      {activeChatDelivery && (
        <ChatModal
          delivery={
            activeChatDelivery
          }
          onClose={() => {
            setActiveChatDelivery(
              null
            );
          }}
        />
      )}
    </Layout>
  );
}