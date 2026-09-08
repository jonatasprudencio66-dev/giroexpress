import React, { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function ChatModal({ delivery, onClose }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [newMessageId, setNewMessageId] = useState(null);

  const initializedRef = useRef(false);
  const previousMessageIdsRef = useRef(new Set());
  const audioContextRef = useRef(null);

  // Controle da rolagem do chat
  const messagesContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);

  /*
   * ============================================================
   * GERAR IDENTIFICADOR ESTÁVEL DA MENSAGEM
   * ============================================================
   */

  const getMessageKey = (message, index = 0) => {
    if (!message) {
      return `message-${index}`;
    }

    if (message.id) {
      return String(message.id);
    }

    if (message._id) {
      return String(message._id);
    }

    return [
      message.sender_id || "user",
      message.created_at || "time",
      message.message || "",
      index,
    ].join("-");
  };

  /*
   * ============================================================
   * CONTROLE DA ROLAGEM
   * ============================================================
   */

  const scrollToBottom = (behavior = "smooth") => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    });
  };

  /*
   * Verifica se o usuário está próximo do final.
   *
   * Se estiver lendo mensagens antigas, não forçamos a rolagem.
   */

  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      shouldAutoScrollRef.current = true;
      return;
    }

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom <= 100;
  };

  /*
   * ============================================================
   * ALERTA SONORO
   * ============================================================
   */

  const playNotificationSound = () => {
    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        880,
        audioContext.currentTime
      );

      oscillator.frequency.setValueAtTime(
        1175,
        audioContext.currentTime + 0.12
      );

      gainNode.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.45
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime + 0.5
      );
    } catch (error) {
      console.warn(
        "[GiroExpress] Não foi possível reproduzir o som:",
        error
      );
    }
  };

  /*
   * ============================================================
   * LIBERAR ÁUDIO
   * ============================================================
   */

  const unlockAudio = async () => {
    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch (error) {
      console.warn(
        "[GiroExpress] Não foi possível liberar o áudio:",
        error
      );
    }
  };

  /*
   * ============================================================
   * PERMISSÃO PARA NOTIFICAÇÃO DO NAVEGADOR
   * ============================================================
   */

  const requestNotificationPermission = async () => {
    try {
      if (
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        await Notification.requestPermission();
      }
    } catch (error) {
      console.warn(
        "[GiroExpress] Permissão de notificação indisponível:",
        error
      );
    }
  };

  /*
   * ============================================================
   * NOTIFICAÇÃO DO NAVEGADOR
   * ============================================================
   */

  const showBrowserNotification = (message) => {
    try {
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const senderName =
        message?.sender_name || "Nova mensagem";

      const messageText =
        message?.message ||
        message?.text ||
        "Você recebeu uma nova mensagem.";

      const notification = new Notification(
        `GiroExpress • ${senderName}`,
        {
          body: messageText,
          icon: "/favicon.ico",
          tag: `giroexpress-chat-${
            delivery?.id || "chat"
          }`,
        }
      );

      notification.onclick = () => {
        try {
          window.focus();
          notification.close();
        } catch (_) {}
      };

      setTimeout(() => {
        try {
          notification.close();
        } catch (_) {}
      }, 7000);
    } catch (error) {
      console.warn(
        "[GiroExpress] Não foi possível mostrar notificação:",
        error
      );
    }
  };

  /*
   * ============================================================
   * VERIFICA SE A MENSAGEM É MINHA
   * ============================================================
   */

  const isMine = (message) => {
    const currentUserId =
      user?.id || user?._id;

    if (!currentUserId || !message?.sender_id) {
      return false;
    }

    return (
      String(message.sender_id) ===
      String(currentUserId)
    );
  };

  /*
   * ============================================================
   * CARREGAR MENSAGENS
   * ============================================================
   */

  const load = async () => {
    if (!delivery?.id) {
      return;
    }

    try {
      const { data } = await api.get(
        `/deliveries/${delivery.id}/chat`
      );

      const incomingMessages = Array.isArray(data)
        ? data
        : [];

      /*
       * ========================================================
       * PRIMEIRA CARGA
       * ========================================================
       */

      if (!initializedRef.current) {
        const ids = new Set(
          incomingMessages.map(
            (message, index) =>
              getMessageKey(message, index)
          )
        );

        previousMessageIdsRef.current = ids;
        initializedRef.current = true;

        setMessages(incomingMessages);

        /*
         * Primeira abertura:
         * sempre vai para a última mensagem.
         */
        shouldAutoScrollRef.current = true;

        requestAnimationFrame(() => {
          scrollToBottom("auto");
        });

        previousMessagesLengthRef.current =
          incomingMessages.length;

        return;
      }

      /*
       * ========================================================
       * PROCURAR MENSAGENS NOVAS
       * ========================================================
       */

      const previousIds =
        previousMessageIdsRef.current;

      const newMessages =
        incomingMessages.filter(
          (message, index) =>
            !previousIds.has(
              getMessageKey(message, index)
            )
        );

      /*
       * ========================================================
       * ATUALIZAR IDS
       * ========================================================
       */

      previousMessageIdsRef.current = new Set(
        incomingMessages.map(
          (message, index) =>
            getMessageKey(message, index)
        )
      );

      /*
       * ========================================================
       * NOTIFICAR NOVA MENSAGEM
       * ========================================================
       */

      if (newMessages.length > 0) {
        const incomingNewMessages =
          newMessages.filter(
            (message) => !isMine(message)
          );

        if (incomingNewMessages.length > 0) {
          const lastMessage =
            incomingNewMessages[
              incomingNewMessages.length - 1
            ];

          const lastMessageKey =
            getMessageKey(
              lastMessage,
              incomingMessages.length - 1
            );

          setNewMessageId(lastMessageKey);

          /*
           * Som
           */
          playNotificationSound();

          /*
           * Toast
           */
          toast.success(
            `${
              lastMessage.sender_name ||
              "Nova mensagem"
            } enviou uma mensagem`,
            {
              duration: 4000,
              icon: <Bell size={18} />,
            }
          );

          /*
           * Notificação do navegador
           */
          showBrowserNotification(lastMessage);

          /*
           * Remover destaque depois de 3 segundos.
           */
          setTimeout(() => {
            setNewMessageId(null);
          }, 3000);
        }
      }

      /*
       * ========================================================
       * ATUALIZAR MENSAGENS
       * ========================================================
       */

      setMessages(incomingMessages);

      /*
       * ========================================================
       * ROLAGEM AUTOMÁTICA
       * ========================================================
       *
       * Se o usuário estiver no final:
       * acompanha as novas mensagens.
       *
       * Se estiver lendo mensagens antigas:
       * NÃO mexe na posição.
       */

      if (
        newMessages.length > 0 &&
        shouldAutoScrollRef.current
      ) {
        requestAnimationFrame(() => {
          scrollToBottom("smooth");
        });
      }

      previousMessagesLengthRef.current =
        incomingMessages.length;
    } catch (error) {
      console.warn(
        "[GiroExpress] Erro ao carregar mensagens:",
        error
      );
    }
  };

  /*
   * ============================================================
   * INICIALIZAÇÃO
   * ============================================================
   */

  useEffect(() => {
    if (!delivery?.id) {
      return;
    }

    initializedRef.current = false;
    previousMessageIdsRef.current = new Set();
    previousMessagesLengthRef.current = 0;

    /*
     * Ao abrir um novo chat, começa no final.
     */
    shouldAutoScrollRef.current = true;

    /*
     * Solicita permissão para notificações.
     */
    requestNotificationPermission();

    /*
     * Carrega mensagens imediatamente.
     */
    load();

    /*
     * Verifica novas mensagens a cada 4 segundos.
     */
    const interval = setInterval(() => {
      load();
    }, 4000);

    /*
     * ESC fecha o modal.
     */
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      onKey
    );

    /*
     * Limpeza.
     */
    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "keydown",
        onKey
      );
    };
  }, [delivery?.id]);

  /*
   * ============================================================
   * GARANTIR ROLAGEM APÓS ATUALIZAÇÃO DA LISTA
   * ============================================================
   */

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    /*
     * Quando a quantidade de mensagens aumenta,
     * acompanha automaticamente a última.
     */
    if (
      messages.length >
      previousMessagesLengthRef.current
    ) {
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    }

    previousMessagesLengthRef.current =
      messages.length;
  }, [messages]);

  /*
   * ============================================================
   * ENVIO DE MENSAGEM
   * ============================================================
   */

  const send = async () => {
    const message = text.trim();

    if (!message || !delivery || busy) {
      return;
    }

    setBusy(true);

    /*
     * Depois de enviar, queremos ficar no final.
     */
    shouldAutoScrollRef.current = true;

    try {
      /*
       * A interação do usuário libera o áudio.
       */
      await unlockAudio();

      /*
       * Solicita permissão para notificações.
       */
      await requestNotificationPermission();

      /*
       * Envia mensagem.
       */
      await api.post(
        `/deliveries/${delivery.id}/chat`,
        {
          message,
        }
      );

      /*
       * Limpa campo.
       */
      setText("");

      /*
       * Atualiza imediatamente o histórico.
       */
      await load();

      /*
       * Garante que a mensagem enviada fique visível.
       */
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    } catch (error) {
      console.error(
        "[GiroExpress] Erro ao enviar mensagem:",
        error
      );

      toast.error(
        "Não foi possível enviar a mensagem."
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * ============================================================
   * SEM DELIVERY
   * ============================================================
   */

  if (!delivery) {
    return null;
  }

  /*
   * ============================================================
   * DADOS DO PEDIDO
   * ============================================================
   */

  const deliveryCode = String(
    delivery.code || "PEDIDO"
  )
    .replace(/^#+/, "")
    .trim();

  const storeName = String(
    delivery.store_name || "Loja"
  )
    .replace(/^#+/, "")
    .trim();

  const clientName = String(
    delivery.client_name || "Cliente"
  )
    .replace(/^#+/, "")
    .trim();

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full h-[500px] flex flex-col shadow-2xl overflow-hidden"
        data-testid="chat-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        {/* ================================================== */}
        {/* CABEÇALHO */}
        {/* ================================================== */}

        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Chat GiroExpress

              {newMessageId && (
                <span className="flex items-center gap-1 text-[10px] text-orange-400 animate-pulse">
                  <Bell className="w-3 h-3" />
                  Nova mensagem
                </span>
              )}
            </h3>

            <p className="text-xs text-slate-400">
              {deliveryCode} • {storeName} ➔{" "}
              {clientName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            data-testid="chat-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================== */}
        {/* MENSAGENS */}
        {/* ================================================== */}

        <div
          ref={messagesContainerRef}
          onScroll={checkIfNearBottom}
          className="flex-1 p-4 overflow-y-auto space-y-3"
        >
          {messages.length === 0 && (
            <p className="text-xs text-slate-500 text-center mt-4">
              Sem mensagens ainda. Envie a
              primeira!
            </p>
          )}

          {messages.map((message, index) => {
            const mine = isMine(message);

            const messageKey =
              getMessageKey(
                message,
                index
              );

            const senderName = String(
              message?.sender_name ||
                "Usuário"
            )
              .replace(/^#+/, "")
              .trim();

            const senderRole = String(
              message?.sender_role || ""
            )
              .replace(/^#+/, "")
              .trim();

            const messageText = String(
              message?.message ||
                message?.text ||
                ""
            ).trim();

            const isNew =
              String(messageKey) ===
              String(newMessageId);

            return (
              <div
                key={messageKey}
                className={`flex flex-col ${
                  mine
                    ? "items-end"
                    : "items-start"
                }`}
              >
                <span className="text-[10px] text-slate-500 mb-1">
                  {senderName}

                  {senderRole
                    ? ` (${senderRole})`
                    : ""}

                  {" • "}

                  {message?.created_at
                    ? new Date(
                        message.created_at
                      ).toLocaleTimeString(
                        "pt-BR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : ""}
                </span>

                <div
                  className={`
                    p-3
                    rounded-2xl
                    text-sm
                    max-w-[80%]
                    transition-all
                    ${
                      mine
                        ? "bg-orange-500 text-slate-950 font-medium"
                        : "bg-slate-800 text-slate-100"
                    }
                    ${
                      isNew
                        ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900 animate-pulse"
                        : ""
                    }
                  `}
                >
                  {messageText}
                </div>
              </div>
            );
          })}
        </div>

        {/* ================================================== */}
        {/* CAMPO DE ENVIO */}
        {/* ================================================== */}

        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
          <input
            data-testid="chat-input"
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            onFocus={() => {
              unlockAudio();
              requestNotificationPermission();
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />

          <button
            type="button"
            data-testid="chat-send-btn"
            onClick={send}
            disabled={
              busy || !text.trim()
            }
            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 p-2.5 rounded-xl transition"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}