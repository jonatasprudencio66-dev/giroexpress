
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
  CalendarDays,
  DollarSign,
  Package,
  Loader2,
  CreditCard,
  Save,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  apiError,
  createUserWebSocket,
} from "../lib/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

function formatCycleDate(value) {
  if (!value) return "—";

  const text = String(value);
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return text;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeAccountData(data) {
  const account =
    data?.account ||
    data?.payment_account ||
    data?.data ||
    data ||
    {};

  return {
    holder_name:
      account.holder_name ||
      account.account_holder ||
      account.holder ||
      "",

    document:
      account.document ||
      account.cpf_cnpj ||
      account.cpf ||
      account.cnpj ||
      "",

    bank:
      account.bank ||
      account.bank_name ||
      "",

    agency:
      account.agency ||
      "",

    account:
      account.account ||
      account.account_number ||
      "",

    account_type:
      account.account_type ||
      "corrente",

    pix_key_type:
      account.pix_key_type ||
      account.pix_type ||
      "",

    pix_key:
      account.pix_key ||
      account.pix ||
      "",
  };
}

export default function StoreDashboard() {
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] =
    useState("deliveries");

  const [deliveries, setDeliveries] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [billingCycle, setBillingCycle] =
    useState(null);

  const [billingLoading, setBillingLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [accountLoading, setAccountLoading] =
    useState(false);

  const [accountSaving, setAccountSaving] =
    useState(false);

  const [accountSaved, setAccountSaved] =
    useState(false);

  const [accountForm, setAccountForm] =
    useState({
      holder_name: "",
      document: "",
      bank: "",
      agency: "",
      account: "",
      account_type: "corrente",
      pix_key_type: "",
      pix_key: "",
    });

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

  const deliveriesRef =
    useRef([]);

  const firstLoadRef =
    useRef(true);

  // ============================================================
  // FORMULÁRIO DE ENTREGA
  // ============================================================

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

  // ============================================================
  // FORMULÁRIO DE PRODUTO
  // ============================================================

  const [productForm, setProductForm] =
    useState({
      name: "",
      description: "",
      price: "",
      category: "Geral",
    });

  // ============================================================
  // ÁUDIO
  // ============================================================

  const audioContextRef =
    useRef(null);

  // ============================================================
  // CHAT ABERTO
  // ============================================================

  useEffect(() => {
    activeChatDeliveryRef.current =
      activeChatDelivery;
  }, [activeChatDelivery]);

  // ============================================================
  // REFERÊNCIA DAS ENTREGAS
  // ============================================================

  useEffect(() => {
    deliveriesRef.current =
      deliveries;
  }, [deliveries]);

  // ============================================================
  // CARREGAR CONTA / PIX
  // ============================================================

  const loadAccount = useCallback(
    async () => {
      try {
        setAccountLoading(true);

        const response =
          await api.get(
            "/me/account"
          );

        const normalized =
          normalizeAccountData(
            response?.data
          );

        setAccountForm(
          normalized
        );

        setAccountSaved(
          Boolean(
            normalized.holder_name ||
              normalized.pix_key ||
              normalized.bank
          )
        );
      } catch (error) {
        console.warn(
          "[GiroExpress] Não foi possível carregar Conta/PIX:",
          error
        );
      } finally {
        setAccountLoading(false);
      }
    },
    []
  );

  // ============================================================
  // SALVAR CONTA / PIX
  // ============================================================

  const handleSaveAccount =
    async (event) => {
      event.preventDefault();

      if (
        !accountForm.holder_name.trim()
      ) {
        toast.error(
          "Informe o nome do titular."
        );
        return;
      }

      if (
        !accountForm.document.trim()
      ) {
        toast.error(
          "Informe o CPF/CNPJ."
        );
        return;
      }

      if (
        !accountForm.bank.trim()
      ) {
        toast.error(
          "Informe o banco."
        );
        return;
      }

      if (
        !accountForm.agency.trim()
      ) {
        toast.error(
          "Informe a agência."
        );
        return;
      }

      if (
        !accountForm.account.trim()
      ) {
        toast.error(
          "Informe o número da conta."
        );
        return;
      }

      if (
        !accountForm.pix_key_type
      ) {
        toast.error(
          "Selecione o tipo da chave PIX."
        );
        return;
      }

      if (
        !accountForm.pix_key.trim()
      ) {
        toast.error(
          "Informe a chave PIX."
        );
        return;
      }

      try {
        setAccountSaving(true);

        await api.post(
          "/me/account",
          {
            holder_name:
              accountForm.holder_name.trim(),

            document:
              accountForm.document.trim(),

            bank:
              accountForm.bank.trim(),

            agency:
              accountForm.agency.trim(),

            account:
              accountForm.account.trim(),

            account_type:
              accountForm.account_type,

            pix_key_type:
              accountForm.pix_key_type,

            pix_key:
              accountForm.pix_key.trim(),
          }
        );

        setAccountSaved(true);

        toast.success(
          "Conta / PIX salvo com sucesso!"
        );
      } catch (error) {
        console.error(
          "[GiroExpress] Erro ao salvar Conta/PIX:",
          error
        );

        toast.error(
          apiError(error)
        );
      } finally {
        setAccountSaving(false);
      }
    };

  // ============================================================
  // CARREGAR DADOS
  // ============================================================

  const loadData =
    useCallback(async () => {
      try {
        if (
          firstLoadRef.current
        ) {
          setLoading(true);
        }

        const [
          delRes,
          prodRes,
          billingRes,
        ] = await Promise.all([
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

          api
            .get(
              "/billing/store/current"
            )
            .catch(() => ({
              data: null,
            })),
        ]);

        const delData =
          delRes?.data;

        const prodData =
          prodRes?.data;

        const billingData =
          billingRes?.data;

        if (billingData?.ok) {
          setBillingCycle(
            billingData
          );
        } else if (
          billingData?.period_start
        ) {
          setBillingCycle(
            billingData
          );
        }

        if (
          Array.isArray(delData)
        ) {
          setDeliveries(
            delData
          );
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

        if (
          Array.isArray(prodData)
        ) {
          setProducts(
            prodData
          );
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

        firstLoadRef.current =
          false;
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
  // LIBERAR ÁUDIO
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

          if (
            !audioContextRef.current
          ) {
            audioContextRef.current =
              new AudioContext();
          }

          if (
            audioContextRef.current
              .state ===
            "suspended"
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
  // NOTIFICAÇÕES
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
  // SOM
  // ============================================================

  const playBeep =
    useCallback(() => {
      try {
        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) {
          return;
        }

        if (
          !audioContextRef.current
        ) {
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
            return;
          }

          if (
            Notification.permission !==
            "granted"
          ) {
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
                    deliveriesRef.current.find(
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
                        const updated =
                          {
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
        } catch (error) {
          console.warn(
            "[GiroExpress] Erro na notificação:",
            error
          );
        }
      },
      []
    );

  // ============================================================
  // WEBSOCKET
  // ============================================================

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    const userId =
      currentUser.id ||
      currentUser._id;

    if (!userId) {
      return undefined;
    }

    const normalizedUserId =
      String(userId);

    let ws = null;
    let reconnectTimer = null;
    let isUnmounted = false;

    const connectWebSocket =
      () => {
        if (isUnmounted) {
          return;
        }

        if (
          ws &&
          (
            ws.readyState ===
              WebSocket.OPEN ||
            ws.readyState ===
              WebSocket.CONNECTING
          )
        ) {
          return;
        }

        try {
          ws =
            createUserWebSocket(
              normalizedUserId
            );

          if (!ws) {
            reconnectTimer =
              setTimeout(
                connectWebSocket,
                3000
              );

            return;
          }

          ws.onopen = () => {
            if (isUnmounted) {
              return;
            }

            console.log(
              "[GiroExpress] ✅ WebSocket da loja conectado."
            );
          };

          ws.onmessage = (
            event
          ) => {
            try {
              let data;

              try {
                data = JSON.parse(
                  event.data
                );
              } catch (_) {
                return;
              }

              const messageType =
                String(
                  data?.type || ""
                ).toLowerCase();

              const acceptedType =
                messageType ===
                  "chat_message" ||
                messageType ===
                  "message" ||
                messageType ===
                  "";

              if (!acceptedType) {
                return;
              }

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
                return;
              }

              const rawText =
                data?.text ??
                data?.message ??
                "";

              const messageText =
                String(
                  rawText
                ).trim();

              if (!messageText) {
                return;
              }

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
                }
              }

              playBeep();

              toast.success(
                `💬 Nova mensagem de ${senderName}: ${messageText}`,
                {
                  duration: 6000,
                  position:
                    "top-right",
                }
              );

              showBrowserNotification(
                senderName,
                messageText,
                deliveryId
              );

              loadData();
            } catch (error) {
              console.error(
                "[GiroExpress] Erro ao processar WebSocket:",
                error
              );
            }
          };

          ws.onerror = (
            error
          ) => {
            console.warn(
              "[GiroExpress] WebSocket apresentou erro:",
              error
            );
          };

          ws.onclose = () => {
            ws = null;

            if (
              !isUnmounted
            ) {
              reconnectTimer =
                setTimeout(
                  connectWebSocket,
                  3000
                );
            }
          };
        } catch (error) {
          ws = null;

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

    connectWebSocket();

    return () => {
      isUnmounted = true;

      if (reconnectTimer) {
        clearTimeout(
          reconnectTimer
        );

        reconnectTimer = null;
      }

      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;

          if (
            ws.readyState ===
              WebSocket.OPEN ||
            ws.readyState ===
              WebSocket.CONNECTING
          ) {
            ws.close();
          }
        } catch (_) {}

        ws = null;
      }
    };
  }, [
    currentUser,
    loadData,
    playBeep,
    showBrowserNotification,
  ]);

  // ============================================================
  // POLLING
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
  // CARREGAR CONTA QUANDO USUÁRIO ESTIVER LOGADO
  // ============================================================

  useEffect(() => {
    if (currentUser) {
      loadAccount();
    }
  }, [
    currentUser,
    loadAccount,
  ]);

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

            price:
              finalPrice,

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

            price:
              productPrice,
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
            "deliveries" && (
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
          )}

          {activeTab ===
            "products" && (
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

        <div className="flex border-b border-slate-800 space-x-4 md:space-x-6 overflow-x-auto">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "deliveries"
              )
            }
            className={`pb-3 whitespace-nowrap font-medium text-sm transition border-b-2 ${
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
            className={`pb-3 whitespace-nowrap font-medium text-sm transition border-b-2 ${
              activeTab ===
              "products"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Gerenciar Cardápio /
            Produtos
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "billing"
              )
            }
            className={`pb-3 whitespace-nowrap font-medium text-sm transition border-b-2 ${
              activeTab ===
              "billing"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Faturamento
          </button>

          {/* NOVA ABA CONTA / PIX */}

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "account"
              )
            }
            className={`pb-3 whitespace-nowrap font-medium text-sm transition border-b-2 flex items-center gap-1.5 ${
              activeTab ===
              "account"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Conta / PIX
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
                  {deliveries.length}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-slate-400 text-sm">
                  Em Andamento
                </span>

                <p className="text-2xl font-bold text-white mt-2">
                  {
                    deliveries.filter(
                      (delivery) =>
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
                      (delivery) =>
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
                    (delivery) => {
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

                      const requestDate =
                        delivery.created_at ||
                        delivery.completed_at ||
                        delivery.delivered_at ||
                        delivery.updated_at ||
                        "";

                      const formattedRequestDate =
                        requestDate
                          ? new Date(
                              requestDate
                            ).toLocaleDateString(
                              "pt-BR"
                            )
                          : "—";

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

                            <div className="flex items-center gap-2 flex-wrap">

                              <span className="font-semibold text-orange-400 text-sm">
                                {
                                  orderCode
                                }
                              </span>

                              <span className="text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 whitespace-nowrap">
                                📅{" "}
                                {
                                  formattedRequestDate
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
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const id =
                                  String(
                                    deliveryId
                                  );

                                setUnreadMessages(
                                  (
                                    previous
                                  ) => {
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
            FATURAMENTO
        ====================================================== */}

        {activeTab ===
          "billing" && (
          <div className="space-y-6">

            {billingLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <>

                <div className="bg-slate-900 border border-orange-500/20 rounded-2xl p-6">

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                    <div>

                      <div className="flex items-center gap-2">

                        <CalendarDays className="w-5 h-5 text-orange-400" />

                        <h2 className="text-xl font-black text-white">
                          Ciclo atual
                        </h2>

                      </div>

                      <p className="text-sm text-slate-400 mt-1">
                        {billingCycle?.period_start &&
                        billingCycle?.period_end
                          ? `${formatCycleDate(
                              billingCycle.period_start
                            )} a ${formatCycleDate(
                              billingCycle.period_end
                            )}`
                          : "Carregando período..."}
                      </p>

                    </div>

                    <span className="text-xs font-bold px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300">
                      Fechamento:{" "}
                      {
                        billingCycle?.closing_weekday_label ||
                        "—"
                      }
                    </span>

                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

                    <div className="flex items-center gap-2 text-orange-400">
                      <Package className="w-5 h-5" />
                      <span className="text-xs uppercase font-bold tracking-wide">
                        Corridas
                      </span>
                    </div>

                    <p className="text-2xl font-black text-white mt-2">
                      {
                        Number(
                          billingCycle?.total_deliveries ||
                            0
                        )
                      }
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      No ciclo atual
                    </p>

                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

                    <div className="flex items-center gap-2 text-emerald-400">
                      <DollarSign className="w-5 h-5" />
                      <span className="text-xs uppercase font-bold tracking-wide">
                        Bruto
                      </span>
                    </div>

                    <p className="text-2xl font-black text-white mt-2">
                      R${" "}
                      {Number(
                        billingCycle?.total_gross ||
                          0
                      )
                        .toFixed(2)
                        .replace(
                          ".",
                          ","
                        )}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Movimentação das corridas
                    </p>

                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

                    <div className="flex items-center gap-2 text-orange-400">
                      <DollarSign className="w-5 h-5" />

                      <span className="text-xs uppercase font-bold tracking-wide">
                        Valor a pagar
                      </span>
                    </div>

                    <p className="text-2xl font-black text-white mt-2">
                      R${" "}
                      {Number(
                        billingCycle?.total_to_pay ||
                          0
                      )
                        .toFixed(2)
                        .replace(
                          ".",
                          ","
                        )}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Calculado pelas corridas do ciclo
                    </p>

                  </div>

                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

                  <div className="flex items-center justify-between gap-3 mb-4">

                    <div>
                      <h3 className="font-bold text-lg text-white">
                        Movimentação do ciclo
                      </h3>

                      <p className="text-xs text-slate-500 mt-1">
                        Cada corrida concluída aparece com a data e o entregador.
                      </p>
                    </div>

                  </div>

                  {(
                    billingCycle?.delivery_details ||
                    []
                  ).length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">
                      Nenhuma corrida concluída neste ciclo.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 text-left">
                            <th className="py-3 pr-4">
                              Data
                            </th>

                            <th className="py-3 pr-4">
                              Corrida
                            </th>

                            <th className="py-3 pr-4">
                              Entregador
                            </th>

                            <th className="py-3 text-right">
                              Valor
                            </th>
                          </tr>
                        </thead>

                        <tbody>

                          {(
                            billingCycle?.delivery_details ||
                            []
                          ).map(
                            (item) => (
                              <tr
                                key={
                                  item.id ||
                                  item.code
                                }
                                className="border-b border-slate-900 last:border-0"
                              >

                                <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">
                                  {formatCycleDate(
                                    item.date
                                  )}
                                </td>

                                <td className="py-3 pr-4 text-white font-bold">
                                  {
                                    item.code ||
                                    "—"
                                  }
                                </td>

                                <td className="py-3 pr-4 text-slate-300">
                                  {
                                    item.courier_name ||
                                    "Entregador"
                                  }
                                </td>

                                <td className="py-3 text-right text-emerald-400 font-bold whitespace-nowrap">
                                  R${" "}
                                  {Number(
                                    item.gross_price ||
                                      0
                                  )
                                    .toFixed(2)
                                    .replace(
                                      ".",
                                      ","
                                    )}
                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>

              </>
            )}

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

        {/* =====================================================
            CONTA / PIX
        ====================================================== */}

        {activeTab ===
          "account" && (
          <div className="space-y-6">

            <div className="bg-slate-900 border border-orange-500/20 rounded-2xl p-6">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                <div>

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-orange-400" />
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-white">
                        Conta / PIX
                      </h2>

                      <p className="text-sm text-slate-400 mt-1">
                        Cadastre os dados para recebimento dos pagamentos.
                      </p>
                    </div>

                  </div>

                </div>

                {accountSaved ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                    Dados cadastrados
                  </div>
                ) : (
                  <div className="text-orange-300 text-sm font-bold bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl">
                    Cadastro pendente
                  </div>
                )}

              </div>

            </div>

            {accountLoading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <form
                onSubmit={
                  handleSaveAccount
                }
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6"
              >

                <div>
                  <h3 className="text-lg font-bold text-white">
                    Dados do titular
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Informe os dados bancários da conta que receberá os pagamentos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      Nome do titular
                    </label>

                    <input
                      type="text"
                      value={
                        accountForm.holder_name
                      }
                      onChange={(
                        event
                      ) =>
                        setAccountForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            holder_name:
                              event.target.value,
                          })
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                      placeholder="Nome completo ou razão social"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      CPF / CNPJ
                    </label>

                    <input
                      type="text"
                      value={
                        accountForm.document
                      }
                      onChange={(
                        event
                      ) =>
                        setAccountForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            document:
                              event.target.value,
                          })
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                      placeholder="CPF ou CNPJ"
                    />
                  </div>

                </div>

                <div className="border-t border-slate-800 pt-6">

                  <h3 className="text-lg font-bold text-white mb-4">
                    Dados bancários
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Banco
                      </label>

                      <input
                        type="text"
                        value={
                          accountForm.bank
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              bank:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        placeholder="Ex: Nubank, Itaú, Bradesco..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Tipo de conta
                      </label>

                      <select
                        value={
                          accountForm.account_type
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              account_type:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="corrente">
                          Conta Corrente
                        </option>

                        <option value="poupanca">
                          Conta Poupança
                        </option>

                        <option value="pagamento">
                          Conta de Pagamento
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Agência
                      </label>

                      <input
                        type="text"
                        value={
                          accountForm.agency
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              agency:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        placeholder="Ex: 0001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Número da conta
                      </label>

                      <input
                        type="text"
                        value={
                          accountForm.account
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              account:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        placeholder="Número da conta"
                      />
                    </div>

                  </div>

                </div>

                <div className="border-t border-slate-800 pt-6">

                  <h3 className="text-lg font-bold text-white mb-4">
                    Chave PIX
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Tipo da chave PIX
                      </label>

                      <select
                        value={
                          accountForm.pix_key_type
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              pix_key_type:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="">
                          Selecione
                        </option>

                        <option value="cpf">
                          CPF
                        </option>

                        <option value="cnpj">
                          CNPJ
                        </option>

                        <option value="email">
                          E-mail
                        </option>

                        <option value="phone">
                          Celular
                        </option>

                        <option value="random">
                          Chave aleatória
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">
                        Chave PIX
                      </label>

                      <input
                        type="text"
                        value={
                          accountForm.pix_key
                        }
                        onChange={(
                          event
                        ) =>
                          setAccountForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              pix_key:
                                event.target.value,
                            })
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                        placeholder="Informe sua chave PIX"
                      />
                    </div>

                  </div>

                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">

                  <button
                    type="submit"
                    disabled={
                      accountSaving
                    }
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition"
                  >
                    {accountSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Salvar Conta / PIX
                      </>
                    )}
                  </button>

                </div>

              </form>
            )}

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">

              <div className="flex items-start gap-3">

                <CreditCard className="w-5 h-5 text-orange-400 mt-0.5" />

                <div>

                  <p className="text-sm font-bold text-white">
                    Importante
                  </p>

                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Mantenha os dados bancários e a chave PIX atualizados para evitar problemas no recebimento dos pagamentos.
                  </p>

                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* =======================================================
          MODAL NOVA ENTREGA
      ======================================================== */}

      {deliveryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 z-[60]">

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
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() => {
                          setDeliveryForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              pickup_address:
                                "Loja",
                              price:
                                String(
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 z-[60]">

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
                        name:
                          event.target
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
