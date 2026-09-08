import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Layout from "@/components/Layout";
import ChatModal from "@/components/ChatModal";
import TicketModal from "@/components/TicketModal";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  apiError,
  createUserWebSocket,
} from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import {
  Bike,
  MapPin,
  MessageSquare,
  Play,
  Check,
  Headphones,
  DollarSign,
  Loader2,
  ExternalLink,
  Package,
  Bell,
  BellOff,
  CreditCard,
  Save,
  X,
} from "lucide-react";

const MAX_ACTIVE_DELIVERIES = 8;

const ACTIVE_DELIVERY_STATUSES = [
  "accepted",
  "in_transit",
  "picked_up",
  "in_progress",
];

/*
 * ============================================================
 * ÁUDIO DE NOTIFICAÇÃO
 * ============================================================
 */

let notificationAudioContext = null;

function getAudioContext() {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      console.warn(
        "[GiroExpress] Web Audio API não disponível."
      );

      return null;
    }

    if (!notificationAudioContext) {
      notificationAudioContext =
        new AudioContext();
    }

    return notificationAudioContext;
  } catch (error) {
    console.warn(
      "[GiroExpress] Erro ao criar AudioContext:",
      error
    );

    return null;
  }
}

async function unlockNotificationAudio() {
  try {
    const ctx = getAudioContext();

    if (!ctx) {
      return false;
    }

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    return ctx.state === "running";
  } catch (error) {
    console.warn(
      "[GiroExpress] Não foi possível liberar o áudio:",
      error
    );

    return false;
  }
}

function playBeepSound(ctx) {
  try {
    const now = ctx.currentTime;

    const oscillator1 =
      ctx.createOscillator();

    const gain1 =
      ctx.createGain();

    oscillator1.type = "sine";

    oscillator1.frequency.setValueAtTime(
      880,
      now
    );

    oscillator1.connect(gain1);
    gain1.connect(ctx.destination);

    gain1.gain.setValueAtTime(
      0.001,
      now
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.35,
      now + 0.025
    );

    gain1.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.28
    );

    oscillator1.start(now);
    oscillator1.stop(now + 0.3);

    const secondStart =
      now + 0.18;

    const oscillator2 =
      ctx.createOscillator();

    const gain2 =
      ctx.createGain();

    oscillator2.type = "sine";

    oscillator2.frequency.setValueAtTime(
      1320,
      secondStart
    );

    oscillator2.connect(gain2);
    gain2.connect(ctx.destination);

    gain2.gain.setValueAtTime(
      0.001,
      secondStart
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.35,
      secondStart + 0.025
    );

    gain2.gain.exponentialRampToValueAtTime(
      0.001,
      secondStart + 0.32
    );

    oscillator2.start(secondStart);
    oscillator2.stop(
      secondStart + 0.35
    );
  } catch (error) {
    console.warn(
      "[GiroExpress] Erro ao reproduzir beep:",
      error
    );
  }
}

async function playBeep() {
  try {
    const ctx = getAudioContext();

    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (ctx.state !== "running") {
      return;
    }

    playBeepSound(ctx);
  } catch (error) {
    console.warn(
      "[GiroExpress] Não foi possível reproduzir o som:",
      error
    );
  }
}

/*
 * ============================================================
 * NOTIFICAÇÃO DO NAVEGADOR
 * ============================================================
 */

function showBrowserNotification(
  senderName,
  messageText
) {
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
        "GiroExpress • Nova mensagem",
        {
          body: `${senderName}: ${messageText}`,
          icon: "/favicon.ico",
          tag: `giroexpress-chat-${Date.now()}`,
        }
      );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      try {
        notification.close();
      } catch {
        // Ignora
      }
    }, 7000);
  } catch (error) {
    console.warn(
      "[GiroExpress] Erro ao criar notificação:",
      error
    );
  }
}

/*
 * ============================================================
 * DASHBOARD DO MOTOBOY
 * ============================================================
 */

export default function CourierDashboard() {
  const { user, refresh } =
    useAuth();

  const [deliveries, setDeliveries] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [online, setOnline] =
    useState(
      user?.online ?? false
    );

  const [chatDelivery, setChatDelivery] =
    useState(null);

  const [unreadMessages, setUnreadMessages] =
    useState({});

  const [showTicket, setShowTicket] =
    useState(false);

  const [ticketForId, setTicketForId] =
    useState(null);

  const [notifyOn, setNotifyOn] =
    useState(true);

  const [flashCount, setFlashCount] =
    useState(0);

  /*
   * ============================================================
   * CONTA / PIX
   * ============================================================
   */

  const [showAccount, setShowAccount] =
    useState(false);

  const [accountLoading, setAccountLoading] =
    useState(false);

  const [accountSaving, setAccountSaving] =
    useState(false);

  const [accountForm, setAccountForm] =
    useState({
      holder_name: "",
      document: "",
      bank: "",
      agency: "",
      account: "",
      account_type: "corrente",
      pix_key_type: "cpf",
      pix_key: "",
    });

  /*
   * ============================================================
   * REFS
   * ============================================================
   */

  const seenPending =
    useRef(new Set());

  const firstLoad =
    useRef(true);

  const onlineRef =
    useRef(online);

  const notifyOnRef =
    useRef(notifyOn);

  const lastDeliverySignature =
    useRef("");

  const activeChatDeliveryRef =
    useRef(null);

  const websocketRef =
    useRef(null);

  const websocketGenerationRef =
    useRef(0);

  const userId =
    user?.id || user?._id;

  useEffect(() => {
    onlineRef.current =
      online;
  }, [online]);

  useEffect(() => {
    notifyOnRef.current =
      notifyOn;
  }, [notifyOn]);

  useEffect(() => {
    activeChatDeliveryRef.current =
      chatDelivery;
  }, [chatDelivery]);

  /*
   * ============================================================
   * ÁUDIO
   * ============================================================
   */

  useEffect(() => {
    let unlocked = false;

    const unlockAudio =
      async () => {
        if (unlocked) {
          return;
        }

        const success =
          await unlockNotificationAudio();

        if (success) {
          unlocked = true;

          window.removeEventListener(
            "pointerdown",
            unlockAudio
          );

          window.removeEventListener(
            "keydown",
            unlockAudio
          );

          window.removeEventListener(
            "touchstart",
            unlockAudio
          );
        }
      };

    unlockAudio();

    window.addEventListener(
      "pointerdown",
      unlockAudio,
      { passive: true }
    );

    window.addEventListener(
      "keydown",
      unlockAudio,
      { passive: true }
    );

    window.addEventListener(
      "touchstart",
      unlockAudio,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlockAudio
      );

      window.removeEventListener(
        "keydown",
        unlockAudio
      );

      window.removeEventListener(
        "touchstart",
        unlockAudio
      );
    };
  }, []);

  /*
   * ============================================================
   * WEBSOCKET
   * ============================================================
   */

  useEffect(() => {
    if (!userId) {
      return;
    }

    let stopped = false;
    let reconnectTimer = null;

    const generation =
      ++websocketGenerationRef.current;

    let ws = null;

    const isCurrentConnection =
      () =>
        !stopped &&
        generation ===
          websocketGenerationRef.current;

    const clearReconnectTimer =
      () => {
        if (reconnectTimer) {
          clearTimeout(
            reconnectTimer
          );

          reconnectTimer = null;
        }
      };

    const scheduleReconnect =
      () => {
        if (
          !isCurrentConnection()
        ) {
          return;
        }

        clearReconnectTimer();

        reconnectTimer =
          setTimeout(() => {
            reconnectTimer = null;

            if (
              isCurrentConnection()
            ) {
              connectWebSocket();
            }
          }, 3000);
      };

    const connectWebSocket =
      () => {
        if (
          !isCurrentConnection()
        ) {
          return;
        }

        if (
          websocketRef.current &&
          (
            websocketRef.current.readyState ===
              WebSocket.OPEN ||
            websocketRef.current.readyState ===
              WebSocket.CONNECTING
          )
        ) {
          return;
        }

        try {
          ws =
            createUserWebSocket(
              userId
            );

          if (!ws) {
            scheduleReconnect();
            return;
          }

          websocketRef.current =
            ws;

          ws.onopen = () => {
            if (
              !isCurrentConnection() ||
              websocketRef.current !==
                ws
            ) {
              try {
                ws.close();
              } catch {
                // Ignora
              }

              return;
            }
          };

          ws.onmessage = (
            event
          ) => {
            if (
              !isCurrentConnection() ||
              websocketRef.current !==
                ws
            ) {
              return;
            }

            try {
              const data =
                JSON.parse(
                  event.data
                );

              if (
                data.type !==
                "chat_message"
              ) {
                return;
              }

              const senderId =
                data.sender_id;

              if (
                senderId &&
                String(
                  senderId
                ) ===
                  String(
                    userId
                  )
              ) {
                return;
              }

              const senderName =
                String(
                  data.sender_name ||
                    "Usuário"
                )
                  .replace(
                    /^#+/,
                    ""
                  )
                  .trim();

              const messageText =
                String(
                  data.text ||
                    data.message ||
                    "Nova mensagem"
                ).trim();

              const deliveryId =
                data.delivery_id
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

              if (
                !notifyOnRef.current
              ) {
                return;
              }

              playBeep();

              toast.success(
                `💬 ${senderName}: ${messageText}`,
                {
                  duration: 7000,
                  position:
                    "top-right",
                }
              );

              showBrowserNotification(
                senderName,
                messageText
              );
            } catch (error) {
              console.error(
                "[GiroExpress] Erro WebSocket:",
                error
              );
            }
          };

          ws.onerror = () => {
            // Reconexão será feita no onclose.
          };

          ws.onclose = () => {
            const isCurrent =
              websocketRef.current ===
              ws;

            if (isCurrent) {
              websocketRef.current =
                null;
            }

            if (
              !isCurrentConnection()
            ) {
              return;
            }

            scheduleReconnect();
          };
        } catch (error) {
          console.error(
            "[GiroExpress] Erro WebSocket:",
            error
          );

          scheduleReconnect();
        }
      };

    connectWebSocket();

    return () => {
      stopped = true;

      clearReconnectTimer();

      if (
        websocketGenerationRef.current ===
        generation
      ) {
        websocketGenerationRef.current++;
      }

      const socket =
        websocketRef.current;

      if (
        socket === ws
      ) {
        websocketRef.current =
          null;
      }

      if (socket) {
        try {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onerror = null;
          socket.onclose = null;

          if (
            socket.readyState ===
              WebSocket.OPEN ||
            socket.readyState ===
              WebSocket.CONNECTING
          ) {
            socket.close();
          }
        } catch {
          // Ignora
        }
      }
    };
  }, [userId]);

  /*
   * ============================================================
   * CARREGAR CORRIDAS
   * ============================================================
   */

  const load =
    useCallback(
      async () => {
        try {
          const { data } =
            await api.get(
              "/deliveries"
            );

          const nextDeliveries =
            Array.isArray(data)
              ? data
              : [];

          const pending =
            nextDeliveries.filter(
              (d) =>
                d.status ===
                  "pending" &&
                !d.courier_id
            );

          if (
            !firstLoad.current &&
            onlineRef.current &&
            notifyOnRef.current
          ) {
            const fresh =
              pending.filter(
                (d) =>
                  !seenPending.current.has(
                    d.id
                  )
              );

            if (fresh.length) {
              playBeep();

              setFlashCount(
                (count) =>
                  count +
                  fresh.length
              );

              fresh.forEach(
                (d) => {
                  const orderCode =
                    String(
                      d.code ||
                        "PEDIDO"
                    )
                      .replace(
                        /^#+/,
                        ""
                      )
                      .trim();

                  const storeName =
                    String(
                      d.store_name ||
                        "Loja"
                    )
                      .replace(
                        /^#+/,
                        ""
                      )
                      .trim();

                  toast.info(
                    `🚚 Nova corrida! ${orderCode} • ${storeName} • ${formatBRL(
                      d.gross_price
                    )}`,
                    {
                      duration: 8000,
                    }
                  );
                }
              );
            }
          }

          seenPending.current =
            new Set(
              pending.map(
                (d) => d.id
              )
            );

          firstLoad.current =
            false;

          const signature =
            JSON.stringify(
              nextDeliveries.map(
                (d) => ({
                  id: d.id,
                  status:
                    d.status,
                  courier_id:
                    d.courier_id,
                  delivered_at:
                    d.delivered_at,
                  updated_at:
                    d.updated_at,
                  created_at:
                    d.created_at,
                  net_courier:
                    d.net_courier,
                  gross_price:
                    d.gross_price,
                  distance_km:
                    d.distance_km,
                  estimated_min:
                    d.estimated_min,
                })
              )
            );

          if (
            signature !==
            lastDeliverySignature.current
          ) {
            lastDeliverySignature.current =
              signature;

            setDeliveries(
              nextDeliveries
            );
          }
        } catch (error) {
          toast.error(
            apiError(error)
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    load();

    const timer =
      setInterval(
        load,
        6000
      );

    return () =>
      clearInterval(timer);
  }, [load]);

  /*
   * ============================================================
   * ONLINE / OFFLINE
   * ============================================================
   */

  const toggleOnline =
    async () => {
      const next =
        !online;

      if (!next) {
        try {
          await api.post(
            "/couriers/me/online",
            {
              online: false,
            }
          );

          setOnline(false);

          await refresh();

          toast.success(
            "Você ficou OFFLINE."
          );
        } catch (error) {
          toast.error(
            apiError(error)
          );
        }

        return;
      }

      const userStatus =
        String(
          user?.status || ""
        ).toLowerCase();

      const isApproved =
        user?.approved === true ||
        user?.is_approved ===
          true ||
        userStatus ===
          "active" ||
        userStatus ===
          "approved";

      if (!isApproved) {
        toast.error(
          "Aguardando aprovação do admin para ficar online."
        );

        return;
      }

      try {
        await api.post(
          "/couriers/me/online",
          {
            online: true,
          }
        );

        setOnline(true);

        await refresh();

        toast.success(
          "Você está ONLINE. Aceitando corridas!"
        );
      } catch (error) {
        toast.error(
          apiError(error)
        );
      }
    };

  /*
   * ============================================================
   * CONTA / PIX
   * ============================================================
   */

  const loadAccount =
    useCallback(
      async () => {
        try {
          setAccountLoading(
            true
          );

          const { data } =
            await api.get(
              "/me/account"
            );

          const account =
            data?.account || {};

          setAccountForm({
            holder_name:
              account.holder_name ||
              user?.name ||
              "",
            document:
              account.document ||
              "",
            bank:
              account.bank ||
              "",
            agency:
              account.agency ||
              "",
            account:
              account.account ||
              "",
            account_type:
              account.account_type ||
              "corrente",
            pix_key_type:
              account.pix_key_type ||
              "cpf",
            pix_key:
              account.pix_key ||
              "",
          });
        } catch (error) {
          toast.error(
            apiError(error)
          );
        } finally {
          setAccountLoading(
            false
          );
        }
      },
      [user]
    );

  const openAccount =
    async () => {
      setShowAccount(true);
      await loadAccount();
    };

  const updateAccountField =
    (field, value) => {
      setAccountForm(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );
    };

  const saveAccount =
    async (event) => {
      event.preventDefault();

      if (
        !accountForm.holder_name.trim()
      ) {
        toast.error(
          "Informe o titular da conta."
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
        !accountForm.pix_key.trim()
      ) {
        toast.error(
          "Informe a chave PIX."
        );
        return;
      }

      try {
        setAccountSaving(
          true
        );

        await api.put(
          "/me/account",
          {
            ...accountForm,
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
            pix_key:
              accountForm.pix_key.trim(),
          }
        );

        toast.success(
          "Conta e PIX salvos com sucesso!"
        );

        setShowAccount(
          false
        );
      } catch (error) {
        toast.error(
          apiError(error)
        );
      } finally {
        setAccountSaving(
          false
        );
      }
    };

  /*
   * ============================================================
   * CHAT
   * ============================================================
   */

  const openChat = (
    delivery
  ) => {
    const deliveryId =
      delivery?.id ||
      delivery?._id;

    if (deliveryId) {
      const id =
        String(
          deliveryId
        );

      setUnreadMessages(
        (previous) => {
          const updated = {
            ...previous,
          };

          delete updated[id];

          return updated;
        }
      );
    }

    setChatDelivery(
      delivery
    );
  };

  /*
   * ============================================================
   * AÇÕES DA CORRIDA
   * ============================================================
   */

  const act =
    async (
      id,
      action
    ) => {
      try {
        /*
         * Segurança no frontend:
         * nunca deixa aceitar mais de 8.
         */
        if (
          action === "accept" &&
          activeCount >=
            MAX_ACTIVE_DELIVERIES
        ) {
          toast.error(
            `Você já está com ${MAX_ACTIVE_DELIVERIES} pedidos ativos. Conclua um pedido para aceitar outro.`
          );

          return;
        }

        await api.post(
          `/deliveries/${id}/${action}`
        );

        toast.success(
          action === "accept"
            ? "Corrida aceita!"
            : action ===
              "complete"
            ? "Entrega concluída!"
            : "Ok"
        );

        await load();
      } catch (error) {
        toast.error(
          apiError(error)
        );
      }
    };

  /*
   * ============================================================
   * GANHOS DO DIA
   * ============================================================
   */

  const netToday =
    useMemo(() => {
      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      const currentUserId =
        user?.id ||
        user?._id;

      return deliveries
        .filter((d) => {
          const statusOk =
            [
              "delivered",
              "completed",
              "COMPLETED",
              "DELIVERED",
            ].includes(
              d.status
            );

          const mine =
            String(
              d.courier_id
            ) ===
            String(
              currentUserId
            );

          const dateStr =
            d.delivered_at ||
            d.updated_at ||
            d.created_at ||
            "";

          const dateOk =
            dateStr.startsWith(
              today
            ) || !dateStr;

          return (
            statusOk &&
            mine &&
            dateOk
          );
        })
        .reduce(
          (
            sum,
            d
          ) =>
            sum +
            (Number(
              d.net_courier
            ) ||
              Number(
                d.gross_price
              ) -
                1 ||
              7),
          0
        );
    }, [deliveries, user]);

  /*
   * ============================================================
   * LISTAS
   * ============================================================
   */

  const currentUserId =
    user?.id ||
    user?._id;

  const activeDeliveries =
    deliveries.filter(
      (d) =>
        String(
          d.courier_id
        ) ===
          String(
            currentUserId
          ) &&
        ACTIVE_DELIVERY_STATUSES.includes(
          d.status
        )
    );

  const activeCount =
    activeDeliveries.length;

  const remainingSlots =
    Math.max(
      0,
      MAX_ACTIVE_DELIVERIES -
        activeCount
    );

  const hasAvailableSlots =
    activeCount <
    MAX_ACTIVE_DELIVERIES;

  /*
   * ============================================================
   * CORRIDAS DISPONÍVEIS
   *
   * A corrida mais nova fica SEMPRE NO TOPO.
   * Primeiro usamos created_at.
   * Caso não exista, usamos updated_at.
   * ============================================================
   */

  const available =
    hasAvailableSlots
      ? [...deliveries]
          .filter(
            (d) =>
              d.status ===
                "pending" &&
              !d.courier_id
          )
          .sort(
            (a, b) => {
              const dateA =
                new Date(
                  a.created_at ||
                    a.updated_at ||
                    0
                ).getTime();

              const dateB =
                new Date(
                  b.created_at ||
                    b.updated_at ||
                    0
                ).getTime();

              return (
                dateB - dateA
              );
            }
          )
      : [];

  const mine =
    deliveries.filter(
      (d) =>
        String(
          d.courier_id
        ) ===
          String(
            currentUserId
          ) &&
        ![
          "delivered",
          "completed",
          "cancelled",
        ].includes(
          d.status
        )
    );

  const history =
    deliveries.filter(
      (d) =>
        String(
          d.courier_id
        ) ===
          String(
            currentUserId
          ) &&
        [
          "delivered",
          "completed",
          "cancelled",
        ].includes(
          d.status
        )
    );

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <Layout
      subtitle="Painel do Motoboy"
      right={
        <div className="flex items-center space-x-2">
          {/* CONTA / PIX */}
          <button
            type="button"
            onClick={
              openAccount
            }
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition"
            title="Conta e PIX"
          >
            <CreditCard className="w-4 h-4" />

            <span className="text-xs font-bold hidden sm:inline">
              Conta / PIX
            </span>
          </button>

          {/* NOTIFICAÇÕES */}
          <button
            data-testid="toggle-notify-btn"
            onClick={async () => {
              const next =
                !notifyOn;

              setNotifyOn(
                next
              );

              if (next) {
                await unlockNotificationAudio();

                if (
                  "Notification" in
                  window
                ) {
                  if (
                    Notification.permission ===
                    "default"
                  ) {
                    try {
                      await Notification.requestPermission();
                    } catch {
                      // Ignora
                    }
                  }
                }

                await playBeep();

                toast.success(
                  "🔔 Notificações ativadas."
                );
              } else {
                toast.success(
                  "🔕 Notificações silenciadas."
                );
              }
            }}
            title={
              notifyOn
                ? "Silenciar"
                : "Ativar som"
            }
            className={`p-2 rounded-xl border ${
              notifyOn
                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                : "bg-slate-900 text-slate-500 border-slate-800"
            }`}
          >
            {notifyOn ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>

          {/* ONLINE */}
          <div className="flex items-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                online
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-slate-600"
              }`}
            />

            <span className="text-xs font-bold text-slate-300 hidden sm:inline">
              {online
                ? "ONLINE"
                : "OFFLINE"}
            </span>

            <button
              data-testid="toggle-online-btn"
              onClick={
                toggleOnline
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                online
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {online
                ? "Ficar Offline"
                : "Ficar Online"}
            </button>
          </div>
        </div>
      }
    >
      {user?.status ===
        "pending" && (
        <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 p-4 rounded-2xl mb-6">
          <p className="font-bold">
            Conta pendente de
            aprovação
          </p>

          <p className="text-sm">
            Aguarde o
            administrador
            aprovar seu cadastro
            para ficar Online e
            aceitar corridas.
          </p>
        </div>
      )}

      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        data-testid="courier-dashboard"
      >
        <StatCard
          icon={
            <DollarSign className="w-5 h-5" />
          }
          label="Ganhos Líquidos Hoje"
          value={formatBRL(
            netToday
          )}
          sub="Taxa admin de R$ 1,00 já descontada"
          testid="courier-earnings"
        />

        <StatCard
          icon={
            <Package className="w-5 h-5" />
          }
          label="Corridas Ativas"
          value={`${activeCount}/${MAX_ACTIVE_DELIVERIES}`}
          sub={
            remainingSlots >
            0
              ? `${remainingSlots} vaga${
                  remainingSlots >
                  1
                    ? "s"
                    : ""
                } disponível${
                  remainingSlots >
                  1
                    ? "eis"
                    : ""
                }`
              : "Limite atingido — conclua uma entrega"
          }
        />

        <StatCard
          icon={
            <Bike className="w-5 h-5" />
          }
          label="Veículo"
          value={
            user?.vehicle ||
            "—"
          }
          sub="Cadastrado"
        />

        <StatCard
          icon={
            <MapPin className="w-5 h-5" />
          }
          label="Disponíveis na Região"
          value={
            available.length
          }
          sub="Prontas para aceitar"
        />
      </div>

      <div
        className={`mb-6 rounded-2xl border p-4 ${
          hasAvailableSlots
            ? "border-orange-500/30 bg-orange-500/10"
            : "border-rose-500/40 bg-rose-500/10"
        }`}
        data-testid="courier-capacity"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">
              Pedidos na sua rota:{" "}
              {activeCount}/
              {MAX_ACTIVE_DELIVERIES}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Você pode aceitar pedidos de qualquer loja até completar 8 pedidos ativos.
            </p>
          </div>

          <div className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            {hasAvailableSlots
              ? `${remainingSlots} ${
                  remainingSlots ===
                  1
                    ? "vaga"
                    : "vagas"
                } restante${
                  remainingSlots ===
                  1
                    ? ""
                    : "s"
                }`
              : "8/8 — limite atingido"}
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              hasAvailableSlots
                ? "bg-orange-500"
                : "bg-rose-500"
            }`}
            style={{
              width: `${Math.min(
                100,
                (activeCount /
                  MAX_ACTIVE_DELIVERIES) *
                  100
              )}%`,
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Corridas Disponíveis"
            empty="Nenhuma corrida disponível no momento."
            data={available}
            badge={
              flashCount > 0
                ? flashCount
                : null
            }
            onSeen={() =>
              setFlashCount(0)
            }
          >
            {(d) => (
              <DeliveryCard
                key={d.id}
                d={d}
                me={user}
                online={online}
                unreadCount={
                  unreadMessages[
                    String(
                      d.id ||
                        d._id
                    )
                  ] || 0
                }
                onAccept={() =>
                  act(
                    d.id,
                    "accept"
                  )
                }
                acceptDisabled={
                  !hasAvailableSlots
                }
                onChat={() =>
                  openChat(d)
                }
                onTicket={() => {
                  setTicketForId(
                    d.id
                  );

                  setShowTicket(
                    true
                  );
                }}
              />
            )}
          </Section>

          <Section
            title="Minhas Corridas em Andamento"
            empty="Aceite uma corrida acima para começar."
            data={mine}
          >
            {(d) => (
              <DeliveryCard
                key={d.id}
                d={d}
                me={user}
                online={online}
                unreadCount={
                  unreadMessages[
                    String(
                      d.id ||
                        d._id
                    )
                  ] || 0
                }
                onStart={
                  d.status ===
                  "accepted"
                    ? () =>
                        act(
                          d.id,
                          "start"
                        )
                    : null
                }
                onComplete={
                  [
                    "accepted",
                    "in_transit",
                    "picked_up",
                    "in_progress",
                  ].includes(
                    d.status
                  )
                    ? () =>
                        act(
                          d.id,
                          "complete"
                        )
                    : null
                }
                onChat={() =>
                  openChat(d)
                }
                onTicket={() => {
                  setTicketForId(
                    d.id
                  );

                  setShowTicket(
                    true
                  );
                }}
              />
            )}
          </Section>

          <Section
            title="Histórico"
            empty="Sem histórico ainda."
            data={history}
          >
            {(d) => (
              <DeliveryCard
                key={d.id}
                d={d}
                me={user}
                online={online}
                unreadCount={
                  unreadMessages[
                    String(
                      d.id ||
                        d._id
                    )
                  ] || 0
                }
                onChat={() =>
                  openChat(d)
                }
                onTicket={() => {
                  setTicketForId(
                    d.id
                  );

                  setShowTicket(
                    true
                  );
                }}
              />
            )}
          </Section>
        </div>
      )}

      {/* ======================================================
          MODAL CONTA / PIX
      ====================================================== */}

      {showAccount && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  Conta / PIX
                </h2>

                <p className="text-sm text-slate-400 mt-1">
                  Cadastre onde você deseja receber seus pagamentos.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAccount(
                    false
                  )
                }
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accountLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <form
                onSubmit={
                  saveAccount
                }
                className="p-6 space-y-5"
              >
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-sm font-bold text-emerald-300">
                    💰 Dados para recebimento
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Confira os dados antes de salvar.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Titular da conta"
                    value={
                      accountForm.holder_name
                    }
                    onChange={(value) =>
                      updateAccountField(
                        "holder_name",
                        value
                      )
                    }
                    placeholder="Nome completo"
                    required
                  />

                  <Field
                    label="CPF / CNPJ"
                    value={
                      accountForm.document
                    }
                    onChange={(value) =>
                      updateAccountField(
                        "document",
                        value
                      )
                    }
                    placeholder="CPF ou CNPJ"
                  />

                  <Field
                    label="Banco"
                    value={
                      accountForm.bank
                    }
                    onChange={(value) =>
                      updateAccountField(
                        "bank",
                        value
                      )
                    }
                    placeholder="Nome ou código do banco"
                    required
                  />

                  <Field
                    label="Agência"
                    value={
                      accountForm.agency
                    }
                    onChange={(value) =>
                      updateAccountField(
                        "agency",
                        value
                      )
                    }
                    placeholder="Ex.: 0001"
                  />

                  <Field
                    label="Número da conta"
                    value={
                      accountForm.account
                    }
                    onChange={(value) =>
                      updateAccountField(
                        "account",
                        value
                      )
                    }
                    placeholder="Número da conta"
                  />

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">
                      Tipo de conta
                    </label>

                    <select
                      value={
                        accountForm.account_type
                      }
                      onChange={(event) =>
                        updateAccountField(
                          "account_type",
                          event.target.value
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="corrente">
                        Conta Corrente
                      </option>

                      <option value="poupanca">
                        Conta Poupança
                      </option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-5">
                  <h3 className="text-sm font-black text-white mb-4">
                    Chave PIX
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">
                        Tipo da chave PIX
                      </label>

                      <select
                        value={
                          accountForm.pix_key_type
                        }
                        onChange={(event) =>
                          updateAccountField(
                            "pix_key_type",
                            event.target.value
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-orange-500"
                      >
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
                          Telefone
                        </option>

                        <option value="random">
                          Chave aleatória
                        </option>
                      </select>
                    </div>

                    <Field
                      label="Chave PIX"
                      value={
                        accountForm.pix_key
                      }
                      onChange={(value) =>
                        updateAccountField(
                          "pix_key",
                          value
                        )
                      }
                      placeholder="Digite sua chave PIX"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAccount(
                        false
                      )
                    }
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      accountSaving
                    }
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2"
                  >
                    {accountSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}

                    {accountSaving
                      ? "Salvando..."
                      : "Salvar Conta / PIX"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {chatDelivery && (
        <ChatModal
          delivery={
            chatDelivery
          }
          onClose={() =>
            setChatDelivery(null)
          }
        />
      )}

      <TicketModal
        open={showTicket}
        onClose={() =>
          setShowTicket(false)
        }
        deliveryId={
          ticketForId
        }
        onCreated={load}
      />
    </Layout>
  );
}

/*
 * ============================================================
 * CAMPO DO FORMULÁRIO
 * ============================================================
 */

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300 mb-2">
        {label}
        {required && (
          <span className="text-rose-400 ml-1">
            *
          </span>
        )}
      </label>

      <input
        type="text"
        value={value}
        required={required}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-orange-500 placeholder:text-slate-600"
      />
    </div>
  );
}

/*
 * ============================================================
 * STAT CARD
 * ============================================================
 */

function StatCard({
  icon,
  label,
  value,
  sub,
  testid,
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
      <div className="flex items-center space-x-2 text-orange-400">
        {icon}

        <p className="text-xs uppercase font-bold tracking-wide">
          {label}
        </p>
      </div>

      <h3
        data-testid={testid}
        className="text-2xl font-black text-white mt-2"
      >
        {value}
      </h3>

      {sub && (
        <p className="text-xs text-slate-400 mt-2">
          {sub}
        </p>
      )}
    </div>
  );
}

/*
 * ============================================================
 * SECTION
 * ============================================================
 */

function Section({
  title,
  data,
  empty,
  children,
  badge = null,
  onSeen,
}) {
  return (
    <section
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
      onMouseEnter={
        onSeen
      }
    >
      <h3 className="font-bold text-lg text-white mb-4 flex items-center space-x-2">
        <span>
          {title}
        </span>

        <span className="text-xs text-slate-500 font-normal">
          ({data.length})
        </span>

        {badge ? (
          <span
            data-testid="new-delivery-badge"
            className="text-[10px] font-black bg-orange-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse"
          >
            +{badge} NOVA
            {badge > 1
              ? "S"
              : ""}
          </span>
        ) : null}
      </h3>

      {data.length ===
      0 ? (
        <p className="text-sm text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(
            children
          )}
        </div>
      )}
    </section>
  );
}

/*
 * ============================================================
 * DELIVERY CARD
 * ============================================================
 */

function DeliveryCard({
  d,
  me,
  online,
  unreadCount = 0,
  onAccept,
  acceptDisabled = false,
  onStart,
  onComplete,
  onChat,
  onTicket,
}) {
  const currentUserId =
    me?.id ||
    me?._id;

  const isMine =
    String(
      d.courier_id
    ) ===
    String(
      currentUserId
    );

  const statusStyle = {
    pending:
      "text-slate-300 bg-slate-800",

    accepted:
      "text-blue-400 bg-blue-500/20",

    in_transit:
      "text-amber-400 bg-amber-500/20",

    delivered:
      "text-emerald-400 bg-emerald-500/20",

    completed:
      "text-emerald-400 bg-emerald-500/20",

    cancelled:
      "text-rose-400 bg-rose-500/20",
  }[d.status] ||
    "text-slate-300 bg-slate-800";

  const gmapsRoute =
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      d.pickup_address || ""
    )}&destination=${encodeURIComponent(
      d.dropoff_address || ""
    )}&travelmode=driving`;

  const orderCode =
    String(
      d.code ||
        "PEDIDO"
    )
      .replace(
        /^#+/,
        ""
      )
      .trim();

  const storeName =
    String(
      d.store_name ||
        "Loja"
    )
      .replace(
        /^#+/,
        ""
      )
      .trim();

  const pickupAddress =
    String(
      d.pickup_address ||
        "Loja"
    )
      .replace(
        /^#+/,
        ""
      )
      .trim();

  const clientName =
    String(
      d.client_name ||
        "Cliente"
    )
      .replace(
        /^#+/,
        ""
      )
      .trim();

  const dropoffAddress =
    String(
      d.dropoff_address ||
        "-"
    )
      .replace(
        /^#+/,
        ""
      )
      .trim();

  const distanceKm =
    d.distance_km ?? 0;

  const estimatedMin =
    d.estimated_min ?? 0;

  return (
    <div
      className={`bg-slate-950 border rounded-2xl p-5 space-y-4 ${
        isMine
          ? "border-orange-500/60 shadow-lg shadow-orange-500/10"
          : "border-slate-800"
      }`}
      data-testid={`courier-delivery-${d.id}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/20">
          {orderCode}
        </span>

        <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-full">
          {storeName}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start space-x-2">
          <MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />

          <div>
            <p className="text-xs text-slate-400">
              Retirada:
            </p>

            <p className="font-medium text-white">
              {pickupAddress}
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />

          <div>
            <p className="text-xs text-slate-400">
              Cliente:{" "}
              {clientName}
            </p>

            <p className="font-medium text-white">
              {dropoffAddress}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-3 rounded-xl flex items-center justify-between text-xs">
        <div>
          <p className="text-slate-400">
            Distância / Tempo:
          </p>

          <p className="font-mono font-bold text-white">
            {distanceKm} km
            (~
            {estimatedMin}{" "}
            min)
          </p>
        </div>

        <div className="text-right">
          <p className="text-slate-400">
            Líquido:
          </p>

          <p className="font-mono font-bold text-emerald-400 text-base">
            {formatBRL(
              d.net_courier
            )}
          </p>

          <p className="text-[10px] text-slate-500">
            Taxa R$ 1,00
            deduzida
          </p>
        </div>
      </div>

      <span
        className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${statusStyle}`}
      >
        {d.status
          ?.replace(
            "_",
            " "
          )
          .toUpperCase()}
      </span>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {onAccept && (
          <button
            data-testid={`accept-${d.id}`}
            disabled={
              !online ||
              acceptDisabled
            }
            onClick={
              onAccept
            }
            className={`flex-1 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition ${
              online &&
              !acceptDisabled
                ? "bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-lg shadow-orange-500/30"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Play className="w-4 h-4 fill-current" />

            <span>
              {acceptDisabled
                ? "Limite 8 atingido"
                : "Aceitar"}
            </span>
          </button>
        )}

        {onStart && (
          <button
            data-testid={`start-${d.id}`}
            onClick={
              onStart
            }
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs"
          >
            Iniciar Rota
          </button>
        )}

        {onComplete && (
          <button
            data-testid={`complete-${d.id}`}
            onClick={
              onComplete
            }
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1"
          >
            <Check className="w-4 h-4" />

            <span>
              Concluir
            </span>
          </button>
        )}

        {isMine &&
          [
            "accepted",
            "in_transit",
          ].includes(
            d.status
          ) && (
            <a
              data-testid={`navigate-${d.id}`}
              href={
                gmapsRoute
              }
              target="_blank"
              rel="noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-orange-400 px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />

              <span>
                Google Maps
              </span>
            </a>
          )}

        <button
          data-testid={`chat-${d.id}`}
          onClick={
            onChat
          }
          className={`relative flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border transition ${
            unreadCount > 0
              ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/60 shadow-lg shadow-orange-500/10 animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 text-orange-400 border-slate-700"
          }`}
          title={
            unreadCount > 0
              ? `${unreadCount} mensagem${
                  unreadCount > 1
                    ? "s"
                    : ""
                } não lida${
                  unreadCount > 1
                    ? "s"
                    : ""
                }`
              : "Chat"
          }
        >
          <MessageSquare className="w-4 h-4" />

          {unreadCount >
            0 && (
            <span
              data-testid={`chat-unread-${d.id}`}
              className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-slate-950 shadow-lg"
            >
              {unreadCount >
              99
                ? "99+"
                : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={
            onTicket
          }
          className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2.5 rounded-xl border border-slate-700"
          title="Suporte"
        >
          <Headphones className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}