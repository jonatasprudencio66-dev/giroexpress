
import React, { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, apiError, API_BASE } from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  Users,
  Store,
  DollarSign,
  Package,
  Headphones,
  ExternalLink,
  Save,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  CreditCard,
  Eye,
  X,
} from "lucide-react";

const WEEKDAYS = [
  { i: 0, label: "Segunda-feira" },
  { i: 1, label: "Terça-feira" },
  { i: 2, label: "Quarta-feira" },
  { i: 3, label: "Quinta-feira" },
  { i: 4, label: "Sexta-feira" },
  { i: 5, label: "Sábado" },
  { i: 6, label: "Domingo" },
];

const DEFAULT_OPS = {
  active: true,
  disabled_days: [],
  open_time: "00:00",
  close_time: "23:59",
  holidays: [],
};

const DEFAULT_BANK = {
  bank: "",
  agency: "",
  account: "",
  pix_key: "",
};

const DEFAULT_BILLING = {
  stores: [],
  current_cycles: [],
  history: [],
  couriers: [],
  courier_current_cycles: [],
  courier_history: [],
  weekdays: WEEKDAYS.map((day) => ({
    value: day.i,
    label: day.label,
  })),
};

const normalizeText = (value, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value)
    .replace(/^#+\s*/, "")
    .trim();
};

const getUserId = (user) => {
  return String(user?.id || user?._id || "");
};

const getStoreName = (store) => {
  return normalizeText(
    store?.name || store?.store_name,
    "Loja"
  );
};

const getStatusLabel = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") return "Pago";
  if (normalized === "closed") return "Fechado";

  if (
    normalized === "approved" ||
    normalized === "active"
  ) {
    return "Ativo";
  }

  if (
    normalized === "under_review" ||
    normalized === "pending"
  ) {
    return "Em análise";
  }

  if (normalized === "blocked") return "Bloqueado";
  if (normalized === "open") return "Em aberto";
  if (normalized === "resolved") return "Resolvido";

  return normalizeText(status, "Desconhecido");
};

const getBillingStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }

  if (normalized === "closed") {
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }

  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
};

const getUserStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "active" ||
    normalized === "approved"
  ) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }

  if (normalized === "blocked") {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }

  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
};

const formatDateBR = (value) => {
  if (!value) return "-";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value, "-");
  }

  return date.toLocaleDateString("pt-BR");
};

const formatDateTimeBR = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value, "-");
  }

  return date.toLocaleString("pt-BR");
};

const getRoleLabel = (role) => {
  const normalized = String(role || "").toLowerCase();

  if (
    normalized === "courier" ||
    normalized === "delivery" ||
    normalized === "entregador" ||
    normalized === "motoboy"
  ) {
    return "Entregador";
  }

  if (
    normalized === "store" ||
    normalized === "loja"
  ) {
    return "Loja";
  }

  if (normalized === "admin") {
    return "Administrador";
  }

  return normalizeText(role, "-");
};

const getPixTypeLabel = (type) => {
  const normalized = String(type || "").toLowerCase();

  if (normalized === "cpf") return "CPF";
  if (normalized === "cnpj") return "CNPJ";

  if (
    normalized === "phone" ||
    normalized === "telefone"
  ) {
    return "Telefone";
  }

  if (normalized === "email") return "E-mail";

  if (
    normalized === "random" ||
    normalized === "aleatoria" ||
    normalized === "aleatória"
  ) {
    return "Aleatória";
  }

  return normalizeText(type, "-");
};

const getAccountTypeLabel = (type) => {
  const normalized = String(type || "").toLowerCase();

  if (
    normalized === "corrente" ||
    normalized === "checking"
  ) {
    return "Conta corrente";
  }

  if (
    normalized === "poupanca" ||
    normalized === "poupança" ||
    normalized === "savings"
  ) {
    return "Conta poupança";
  }

  if (
    normalized === "salario" ||
    normalized === "salário"
  ) {
    return "Conta salário";
  }

  return normalizeText(type, "-");
};

const getDeliveryStatusLabel = (status) => {
  const normalized = String(status || "").toLowerCase();
  const labels = {
    pending: "Pendente",
    accepted: "Aceita",
    picked_up: "Retirada",
    in_progress: "Em andamento",
    completed: "Concluída",
    delivered: "Entregue",
    cancelled: "Cancelada",
    canceled: "Cancelada",
  };
  return labels[normalized] || normalizeText(status, "Desconhecido");
};

const getDeliveryStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["completed", "delivered"].includes(normalized)) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (["cancelled", "canceled"].includes(normalized)) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }
  if (["accepted", "picked_up", "in_progress"].includes(normalized)) {
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }
  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
};

const hasPaymentAccount = (user) => {
  const account = user?.payment_account;

  if (!account || typeof account !== "object") {
    return false;
  }

  return Boolean(
    String(account.holder_name || "").trim() ||
      String(account.document || "").trim() ||
      String(account.bank || "").trim() ||
      String(account.agency || "").trim() ||
      String(account.account || "").trim() ||
      String(account.pix_key || "").trim()
  );
};

const withTimeout = (promise, milliseconds = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `A requisição excedeu o tempo limite de ${milliseconds / 1000}s.`
          )
        );
      }, milliseconds);
    }),
  ]);
};


function getCurrentWeekLabel() {
  const now = new Date();
  const day = now.getDay();

  const sunday = new Date(now);
  sunday.setHours(12, 0, 0, 0);
  sunday.setDate(now.getDate() - day);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const format = (value) => {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return `${format(sunday)} até ${format(saturday)}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [statements, setStatements] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [settings, setSettings] = useState({
    bank: {},
  });

  const [bank, setBank] = useState(DEFAULT_BANK);
  const [ops, setOps] = useState(DEFAULT_OPS);
  const [billing, setBilling] = useState(DEFAULT_BILLING);

  const [newHoliday, setNewHoliday] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [savingStoreDay, setSavingStoreDay] = useState(null);
  const [closingStore, setClosingStore] = useState(null);
  const [closingCourier, setClosingCourier] = useState(null);
  const [payingCycle, setPayingCycle] = useState(null);
  const [storeCloseConfirmation, setStoreCloseConfirmation] = useState(null);
  const [courierCloseConfirmation, setCourierCloseConfirmation] = useState(null);
  const [courierPayConfirmation, setCourierPayConfirmation] = useState(null);
  const [savingBank, setSavingBank] = useState(false);
  const [savingOps, setSavingOps] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [adminDeliveries, setAdminDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [deliveryDateStart, setDeliveryDateStart] = useState("");
  const [deliveryDateEnd, setDeliveryDateEnd] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [expandedBillingCycles, setExpandedBillingCycles] = useState({});
  const [showAllConfirmedPayments, setShowAllConfirmedPayments] = useState(false);
  const [showAllConfirmedStorePayments, setShowAllConfirmedStorePayments] = useState(false);
  const [showGiroCycleHistory, setShowGiroCycleHistory] = useState(false);
  const [billingView, setBillingView] = useState("current");

  const getTodayInputDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getMonthStartInputDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  };

  const getCurrentWeekInputDates = () => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(12, 0, 0, 0);
    start.setDate(today.getDate() - today.getDay());

    const finish = new Date(start);
    finish.setDate(start.getDate() + 6);

    const toInputDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      start: toInputDate(start),
      end: toInputDate(finish),
    };
  };


  // Filtros independentes dos relatórios por ciclo.
  // As datas começam automaticamente na semana atual.
  const [giroCycleStart, setGiroCycleStart] = useState(
    () => getCurrentWeekInputDates().start
  );
  const [giroCycleEnd, setGiroCycleEnd] = useState(
    () => getCurrentWeekInputDates().end
  );
  const [giroCycleAppliedStart, setGiroCycleAppliedStart] = useState(
    () => getCurrentWeekInputDates().start
  );
  const [giroCycleAppliedEnd, setGiroCycleAppliedEnd] = useState(
    () => getCurrentWeekInputDates().end
  );

  const [financialCycleStart, setFinancialCycleStart] = useState(
    () => getCurrentWeekInputDates().start
  );
  const [financialCycleEnd, setFinancialCycleEnd] = useState(
    () => getCurrentWeekInputDates().end
  );
  const [financialCycleAppliedStart, setFinancialCycleAppliedStart] = useState(
    () => getCurrentWeekInputDates().start
  );
  const [financialCycleAppliedEnd, setFinancialCycleAppliedEnd] = useState(
    () => getCurrentWeekInputDates().end
  );


  const [periodStart, setPeriodStart] = useState(
    () => getCurrentWeekInputDates().start
  );
  const [periodEnd, setPeriodEnd] = useState(
    () => getCurrentWeekInputDates().end
  );
  const [periodQueryVisible, setPeriodQueryVisible] = useState(false);
  const [periodBilling, setPeriodBilling] = useState(null);
  const [periodBillingLoading, setPeriodBillingLoading] = useState(false);

  const loadBilling = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setBillingLoading(true);
        }

        const response = await withTimeout(
          api.get("/admin/billing"),
          10000
        );

        const data = response?.data || {};

        setBilling({
          stores: Array.isArray(data.stores)
            ? data.stores
            : [],

          current_cycles: Array.isArray(
            data.current_cycles
          )
            ? data.current_cycles
            : [],

          history: Array.isArray(data.history)
            ? data.history
            : [],

          couriers: Array.isArray(data.couriers)
            ? data.couriers
            : [],

          courier_current_cycles: Array.isArray(
            data.courier_current_cycles || data.courier_cycles
          )
            ? (data.courier_current_cycles || data.courier_cycles)
            : [],

          courier_history: Array.isArray(
            data.courier_history || data.courier_billing_history
          )
            ? (data.courier_history || data.courier_billing_history)
            : [],

          weekdays:
            Array.isArray(data.weekdays) &&
            data.weekdays.length > 0
              ? data.weekdays.map((day) => ({
                  value: Number(day?.value ?? day?.i ?? 6),
                  label: day?.label || getBillingDayLabel(day?.value ?? day?.i ?? 6),
                }))
              : WEEKDAYS.map((day) => ({
                  value: day.i,
                  label: day.label,
                })),
        });
      } catch (e) {
        console.error(
          "Erro ao carregar faturamento:",
          e
        );

        if (showLoader) {
          toast.error(
            `Erro ao carregar fechamentos: ${apiError(e)}`
          );
        }
      } finally {
        if (showLoader) {
          setBillingLoading(false);
        }
      }
    },
    []
  );

  const loadAdminDeliveries = useCallback(async (
    showLoader = false,
    startDateOverride = null,
    endDateOverride = null
  ) => {
    try {
      if (showLoader) {
        setDeliveriesLoading(true);
      }

      const response = await withTimeout(
        api.get("/admin/deliveries", {
          params: {
            limit: 500,
            search: deliverySearch.trim() || undefined,
            status: deliveryStatusFilter !== "all" ? deliveryStatusFilter : undefined,
            start_date:
              startDateOverride ||
              deliveryDateStart ||
              periodStart ||
              undefined,
            end_date:
              endDateOverride ||
              deliveryDateEnd ||
              periodEnd ||
              undefined,
          },
        }),
        10000
      );

      setAdminDeliveries(
        Array.isArray(response?.data)
          ? response.data
          : []
      );
    } catch (e) {
      console.error("Erro em /admin/deliveries:", e);
      if (showLoader) {
        toast.error(`Erro ao carregar corridas: ${apiError(e)}`);
      }
    } finally {
      if (showLoader) {
        setDeliveriesLoading(false);
      }
    }
  }, [
    deliverySearch,
    deliveryStatusFilter,
    deliveryDateStart,
    deliveryDateEnd,
    periodStart,
    periodEnd,
  ]);

  const periodCompletedDeliveries = adminDeliveries.filter((delivery) => {
    const status = String(delivery?.status || "").toLowerCase();
    return ["completed", "delivered", "concluida", "concluída"].includes(status);
  });

  const periodCompletedCount = periodCompletedDeliveries.length;
  const periodTotalCount = adminDeliveries.length;
  const periodPlatformFees = periodCompletedCount * 1;

  const loadStats = useCallback(async () => {
    try {
      const response = await withTimeout(
        api.get("/admin/stats"),
        10000
      );

      setStats(response?.data || null);
    } catch (e) {
      console.error(
        "Erro ao atualizar estatísticas:",
        e
      );
    }
  }, []);

  const loadAll = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const results =
          await Promise.allSettled([
            withTimeout(
              api.get("/admin/stats"),
              10000
            ),

            withTimeout(
              api.get("/admin/users"),
              10000
            ),

            withTimeout(
              api.get("/statements"),
              10000
            ),

            withTimeout(
              api.get("/tickets"),
              10000
            ),

            withTimeout(
              api.get("/admin/settings"),
              10000
            ),

            withTimeout(
              api.get(
                "/admin/settings/operations"
              ),
              10000
            ),

            withTimeout(
              api.get("/admin/billing"),
              10000
            ),

            withTimeout(
              api.get("/admin/deliveries", {
                params: { limit: 500 },
              }),
              10000
            ),
          ]);

        const [
          statsResult,
          usersResult,
          statementsResult,
          ticketsResult,
          settingsResult,
          operationsResult,
          billingResult,
          deliveriesResult,
        ] = results;

        if (
          statsResult.status === "fulfilled"
        ) {
          setStats(
            statsResult.value?.data || null
          );
        } else {
          console.error(
            "Erro em /admin/stats:",
            statsResult.reason
          );
        }

        if (
          usersResult.status === "fulfilled"
        ) {
          setUsers(
            Array.isArray(
              usersResult.value?.data
            )
              ? usersResult.value.data
              : []
          );
        } else {
          console.error(
            "Erro em /admin/users:",
            usersResult.reason
          );
        }

        if (
          statementsResult.status ===
          "fulfilled"
        ) {
          setStatements(
            Array.isArray(
              statementsResult.value?.data
            )
              ? statementsResult.value.data
              : []
          );
        } else {
          console.error(
            "Erro em /statements:",
            statementsResult.reason
          );
        }

        if (
          ticketsResult.status === "fulfilled"
        ) {
          setTickets(
            Array.isArray(
              ticketsResult.value?.data
            )
              ? ticketsResult.value.data
              : []
          );
        } else {
          console.error(
            "Erro em /tickets:",
            ticketsResult.reason
          );
        }

        if (
          settingsResult.status ===
          "fulfilled"
        ) {
          const configData =
            settingsResult.value?.data || {
              bank: {},
            };

          setSettings(configData);

          setBank({
            bank:
              configData?.bank?.bank ||
              "",
            agency:
              configData?.bank?.agency ||
              "",
            account:
              configData?.bank?.account ||
              "",
            pix_key:
              configData?.bank?.pix_key ||
              "",
          });
        } else {
          console.error(
            "Erro em /admin/settings:",
            settingsResult.reason
          );
        }

        if (
          operationsResult.status ===
          "fulfilled"
        ) {
          const operationsData =
            operationsResult.value?.data || {};

          setOps({
            ...DEFAULT_OPS,
            ...operationsData,

            disabled_days: Array.isArray(
              operationsData?.disabled_days
            )
              ? operationsData.disabled_days
              : [],

            holidays: Array.isArray(
              operationsData?.holidays
            )
              ? operationsData.holidays
              : [],
          });
        } else {
          console.error(
            "Erro em /admin/settings/operations:",
            operationsResult.reason
          );
        }

        if (
          billingResult.status === "fulfilled"
        ) {
          const data =
            billingResult.value?.data || {};

          setBilling({
            stores: Array.isArray(
              data.stores
            )
              ? data.stores
              : [],

            current_cycles: Array.isArray(
              data.current_cycles
            )
              ? data.current_cycles
              : [],

            history: Array.isArray(
              data.history
            )
              ? data.history
              : [],

            couriers: Array.isArray(
              data.couriers
            )
              ? data.couriers
              : [],

            courier_current_cycles: Array.isArray(
              data.courier_current_cycles ||
                data.courier_cycles
            )
              ? (data.courier_current_cycles ||
                data.courier_cycles)
              : [],

            courier_history: Array.isArray(
              data.courier_history ||
                data.courier_billing_history
            )
              ? (data.courier_history ||
                data.courier_billing_history)
              : [],

            weekdays:
              Array.isArray(data.weekdays) &&
              data.weekdays.length > 0
                ? data.weekdays.map((day) => ({
                    value: Number(day?.value ?? day?.i ?? 6),
                    label: day?.label || getBillingDayLabel(day?.value ?? day?.i ?? 6),
                  }))
                : WEEKDAYS.map((day) => ({
                    value: day.i,
                    label: day.label,
                  })),
          });
        } else {
          console.error(
            "Erro em /admin/billing:",
            billingResult.reason
          );
        }

        if (deliveriesResult.status === "fulfilled") {
          setAdminDeliveries(
            Array.isArray(deliveriesResult.value?.data)
              ? deliveriesResult.value.data
              : []
          );
        } else {
          console.error(
            "Erro em /admin/deliveries:",
            deliveriesResult.reason
          );
        }
      } catch (e) {
        console.error(
          "Erro inesperado ao carregar painel:",
          e
        );

        toast.error(
          `Erro ao carregar painel: ${apiError(e)}`
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!mounted) {
        return;
      }

      await loadAll(true);
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [loadAll]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadStats();
      loadBilling(false);
      loadAdminDeliveries(false);
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadStats, loadBilling, loadAdminDeliveries]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      await loadAll(false);

      toast.success("Painel atualizado");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const patchUser = async (
    identifier,
    update,
    message
  ) => {
    if (!identifier) {
      toast.error(
        "Identificador do usuário inválido"
      );
      return;
    }

    try {
      await api.patch(
        `/admin/users/${encodeURIComponent(
          identifier
        )}`,
        update
      );

      toast.success(
        message ||
          "Usuário atualizado com sucesso"
      );

      const response = await api.get(
        "/admin/users"
      );

      setUsers(
        Array.isArray(response?.data)
          ? response.data
          : []
      );
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const deleteUser = async (identifier, user) => {
    if (!identifier) {
      toast.error("Identificador do usuário inválido");
      return;
    }

    const role = String(user?.role || "").toLowerCase();
    if (role === "admin") {
      toast.error("Contas de administrador não podem ser excluídas.");
      return;
    }

    const roleLabel =
      role === "store" || role === "loja"
        ? "loja"
        : "entregador";

    const name = normalizeText(user?.name, roleLabel);
    const confirmed = window.confirm(
      `Tem certeza que deseja EXCLUIR a conta de ${roleLabel} "${name}"?\n\nEssa ação remove o acesso da conta. O histórico de entregas e faturamentos será preservado.`
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/admin/users/${encodeURIComponent(identifier)}`
      );

      toast.success("Conta excluída com sucesso");

      const response = await api.get("/admin/users");
      setUsers(
        Array.isArray(response?.data)
          ? response.data
          : []
      );

      await loadStats();
      await loadBilling(true);
    } catch (e) {
      toast.error(`Não foi possível excluir a conta: ${apiError(e)}`);
    }
  };

  const loadPeriodBilling = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Informe a data inicial e a data final.");
      return;
    }

    if (periodStart > periodEnd) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }

    setPeriodQueryVisible(true);

    try {
      setPeriodBillingLoading(true);

      const response = await withTimeout(
        api.get("/admin/billing/period", {
          params: {
            start_date: periodStart,
            end_date: periodEnd,
          },
        }),
        15000
      );

      setPeriodBilling(response?.data || null);

      await loadAdminDeliveries(
        true,
        periodStart,
        periodEnd
      );

      toast.success("Dados do período atualizados");
    } catch (e) {
      console.error("Erro ao consultar faturamento por período:", e);
      toast.error(`Erro ao consultar período: ${apiError(e)}`);
    } finally {
      setPeriodBillingLoading(false);
    }
  };

  const approveUser = async (identifier) => {
    if (!identifier) {
      toast.error(
        "Identificador do usuário inválido"
      );
      return;
    }

    try {
      await api.post(
        `/admin/users/${encodeURIComponent(
          identifier
        )}/approve`
      );

      toast.success(
        "Usuário aprovado com sucesso"
      );

      const response = await api.get(
        "/admin/users"
      );

      setUsers(
        Array.isArray(response?.data)
          ? response.data
          : []
      );
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const approveStmt = async (
    id,
    approved
  ) => {
    if (!id) {
      toast.error(
        "Identificador do comprovante inválido"
      );
      return;
    }

    try {
      await api.post(
        `/statements/${encodeURIComponent(
          id
        )}/approve`,
        {
          approved,
        }
      );

      toast.success(
        approved
          ? "Comprovante aprovado"
          : "Comprovante rejeitado"
      );

      const response = await api.get(
        "/statements"
      );

      setStatements(
        Array.isArray(response?.data)
          ? response.data
          : []
      );

      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const resolveTicket = async (id) => {
    if (!id) {
      toast.error(
        "Identificador do chamado inválido"
      );
      return;
    }

    try {
      await api.post(
        `/tickets/${encodeURIComponent(
          id
        )}/resolve`
      );

      toast.success(
        "Chamado resolvido"
      );

      const response = await api.get(
        "/tickets"
      );

      setTickets(
        Array.isArray(response?.data)
          ? response.data
          : []
      );

      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const saveBank = async () => {
    try {
      setSavingBank(true);

      await api.put(
        "/admin/settings/bank",
        {
          bank: String(
            bank.bank || ""
          ).trim(),

          agency: String(
            bank.agency || ""
          ).trim(),

          account: String(
            bank.account || ""
          ).trim(),

          pix_key: String(
            bank.pix_key || ""
          ).trim(),
        }
      );

      toast.success(
        "Dados bancários salvos"
      );

      const response = await api.get(
        "/admin/settings"
      );

      setSettings(
        response?.data || {
          bank: {},
        }
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingBank(false);
    }
  };

  const saveOps = async (patch) => {
    try {
      setSavingOps(true);

      const nextOps = {
        ...ops,
        ...patch,

        disabled_days: Array.isArray(
          patch?.disabled_days ??
            ops.disabled_days
        )
          ? patch?.disabled_days ??
            ops.disabled_days
          : [],

        holidays: Array.isArray(
          patch?.holidays ??
            ops.holidays
        )
          ? patch?.holidays ??
            ops.holidays
          : [],
      };

      await api.put(
        "/admin/settings/operations",
        nextOps
      );

      setOps(nextOps);

      toast.success(
        "Configurações operacionais salvas"
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingOps(false);
    }
  };

  const toggleWeekday = (day) => {
    const current = Array.isArray(
      ops.disabled_days
    )
      ? ops.disabled_days
      : [];

    const exists = current.includes(day);

    const next = exists
      ? current.filter(
          (item) => item !== day
        )
      : [...current, day];

    saveOps({
      disabled_days: next,
    });
  };

  const addHoliday = () => {
    const value = String(
      newHoliday || ""
    ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        value
      )
    ) {
      toast.error(
        "Informe a data no formato YYYY-MM-DD"
      );
      return;
    }

    const current = Array.isArray(
      ops.holidays
    )
      ? ops.holidays
      : [];

    if (current.includes(value)) {
      toast.error(
        "Essa data já está cadastrada"
      );
      return;
    }

    setNewHoliday("");

    saveOps({
      holidays: [
        ...current,
        value,
      ].sort(),
    });
  };

  const removeHoliday = (holiday) => {
    const current = Array.isArray(
      ops.holidays
    )
      ? ops.holidays
      : [];

    saveOps({
      holidays: current.filter(
        (item) => item !== holiday
      ),
    });
  };

  const saveStoreClosingDay = async (
    storeId,
    closingWeekday
  ) => {
    if (!storeId) {
      toast.error(
        "Identificador da loja inválido"
      );
      return;
    }

    try {
      setSavingStoreDay(storeId);

      await api.put(
        `/admin/stores/${encodeURIComponent(
          storeId
        )}/billing`,
        {
          closing_weekday:
            Number(closingWeekday),
        }
      );

      toast.success(
        "Dia de fechamento atualizado"
      );

      await loadBilling(true);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingStoreDay(null);
    }
  };

  const closeBilling = async (storeId) => {
    if (!storeId) {
      toast.error(
        "Identificador da loja inválido"
      );
      return;
    }

    try {
      setClosingStore(storeId);

      await api.post(
        `/admin/billing/${encodeURIComponent(
          storeId
        )}/close`
      );

      toast.success(
        "Fechamento realizado com sucesso"
      );

      await loadBilling(true);
      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setClosingStore(null);
    }
  };

  const payBilling = async (cycleId) => {
    if (!cycleId) {
      toast.error(
        "Identificador do ciclo inválido"
      );
      return;
    }

    try {
      setPayingCycle(cycleId);

      await api.post(
        `/admin/billing/cycles/${encodeURIComponent(
          cycleId
        )}/pay`
      );

      toast.success(
        "Fechamento marcado como pago"
      );

      await loadBilling(true);
      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setPayingCycle(null);
    }
  };

  const closeCourierBilling = async (courierId) => {
    if (!courierId) {
      toast.error("Identificador do entregador inválido");
      return false;
    }

    try {
      setClosingCourier(courierId);

      await api.post(
        `/admin/billing/couriers/${encodeURIComponent(
          courierId
        )}/close`
      );

      toast.success("Fechamento do entregador realizado com sucesso");

      // Atualiza imediatamente os ciclos após o fechamento.
      await loadBilling(true);
      await loadStats();

      return true;
    } catch (e) {
      console.error("Erro ao fechar ciclo do entregador:", e);
      toast.error(apiError(e));
      return false;
    } finally {
      setClosingCourier(null);
    }
  };


  const payCourierBilling = async (cycleId) => {
    if (!cycleId) {
      toast.error("Este período ainda não foi fechado para pagamento.");
      return false;
    }

    try {
      setPayingCycle(cycleId);

      // Esta chamada é obrigatória: é ela que grava o ciclo como PAGO.
      await api.post(
        `/admin/billing/courier-cycles/${encodeURIComponent(
          cycleId
        )}/pay`
      );

      toast.success("Pagamento do entregador confirmado com sucesso");

      // O card "Último pagamento confirmado" lê courier_history.
      // Recarregamos imediatamente depois do POST /pay.
      await loadBilling(true);
      await loadStats();

      return true;
    } catch (e) {
      console.error("Erro ao confirmar pagamento do entregador:", e);
      toast.error(
        `Não foi possível confirmar o pagamento: ${apiError(e)}`
      );
      return false;
    } finally {
      setPayingCycle(null);
    }
  };


  const getLatestClosedStoreCycle = (storeId) => {
    const cycles = (billing.history || [])
      .filter(
        (cycle) =>
          String(cycle?.store_id || "") === String(storeId) &&
          String(cycle?.status || "").toLowerCase() === "closed"
      )
      .sort((a, b) =>
        String(b?.closed_at || b?.period_end || "").localeCompare(
          String(a?.closed_at || a?.period_end || "")
        )
      );

    return cycles[0] || null;
  };

  const getLatestClosedCourierCycle = (courierId) => {
    const cycles = (billing.courier_history || [])
      .filter(
        (cycle) =>
          String(cycle?.courier_id || "") === String(courierId) &&
          String(cycle?.status || "").toLowerCase() === "closed"
      )
      .sort((a, b) =>
        String(b?.closed_at || b?.period_end || "").localeCompare(
          String(a?.closed_at || a?.period_end || "")
        )
      );

    return cycles[0] || null;
  };

  const getCurrentCycleForStore = (
    storeId
  ) => {
    return (
      billing.current_cycles.find(
        (cycle) =>
          String(cycle?.store_id) ===
          String(storeId)
      ) || null
    );
  };

  const getBillingDayLabel = (
    weekday
  ) => {
    const found = WEEKDAYS.find(
      (item) =>
        Number(item.i) ===
        Number(weekday)
    );

    return (
      found?.label ||
      "Domingo"
    );
  };

  const couriers = users.filter((user) => {
    const role = String(
      user?.role || ""
    ).toLowerCase();

    return (
      role === "courier" ||
      role === "delivery" ||
      role === "entregador" ||
      role === "motoboy"
    );
  });

  const underReviewStatements =
    statements.filter(
      (statement) =>
        String(
          statement?.status || ""
        ).toLowerCase() ===
        "under_review"
    );

  const openTickets = tickets.filter(
    (ticket) =>
      String(
        ticket?.status || ""
      ).toLowerCase() === "open"
  );

  const totalBillingOpen =
    billing.current_cycles
      .filter(
        (cycle) =>
          String(
            cycle?.status || ""
          ).toLowerCase() ===
          "open"
      )
      .reduce(
        (sum, cycle) =>
          sum +
          Number(
            cycle?.total_gross ??
              cycle?.total_billing ??
              cycle?.total_fee ??
              0
          ),
        0
      );

  const cycleIsInSelectedPeriod = (cycle) => {
    if (!periodStart || !periodEnd) return false;

    const cycleStart = String(
      cycle?.period_start || cycle?.start_date || cycle?.cycle_start || ""
    ).slice(0, 10);

    const cycleEnd = String(
      cycle?.period_end || cycle?.end_date || cycle?.cycle_end || cycleStart
    ).slice(0, 10);

    if (!cycleStart) return false;

    return cycleStart <= periodEnd && cycleEnd >= periodStart;
  };

  const filteredStoreHistory = billing.history.filter(cycleIsInSelectedPeriod);
  const filteredCourierHistory =
    billing.courier_history.filter(cycleIsInSelectedPeriod);

  const totalBillingClosed =
    billing.history
      .filter(
        (cycle) =>
          String(
            cycle?.status || ""
          ).toLowerCase() ===
          "closed"
      )
      .reduce(
        (sum, cycle) =>
          sum +
          Number(
            cycle?.total_gross ??
              cycle?.total_billing ??
              cycle?.total_fee ??
              0
          ),
        0
      );

  const totalBillingPaid =
    billing.history
      .filter(
        (cycle) =>
          String(
            cycle?.status || ""
          ).toLowerCase() ===
          "paid"
      )
      .reduce(
        (sum, cycle) =>
          sum +
          Number(
            cycle?.total_gross ??
              cycle?.total_billing ??
              cycle?.total_fee ??
              0
          ),
        0
      );

  // =========================================================
  // RECEITA DO GIROEXPRESS
  // Regra: R$ 1,00 por entrega concluída.
  // O valor é calculado a partir das entregas do ciclo atual,
  // sem depender de valores fixos no frontend.
  // =========================================================
  const giroCurrentDeliveries = billing.current_cycles.reduce(
    (sum, cycle) =>
      sum + Number(cycle?.total_deliveries || 0),
    0
  );

  const giroCurrentReceivable = billing.current_cycles.reduce(
    (sum, cycle) =>
      sum + Number(
        cycle?.total_gross ??
        cycle?.total_billing ??
        cycle?.total_to_pay ??
        cycle?.total_amount ??
        cycle?.total_fee ??
        0
      ),
    0
  );

  const giroCurrentCourierPay = billing.courier_current_cycles.reduce(
    (sum, cycle) =>
      sum + Number(
        cycle?.total_to_pay ??
        cycle?.total_courier ??
        cycle?.total_amount ??
        0
      ),
    0
  );

  const giroCurrentRevenue = Number(
    (giroCurrentDeliveries * 1).toFixed(2)
  );

  // =========================================================
  // FATURAMENTO CONSOLIDADO POR CICLO
  // Loja paga o valor integral das corridas.
  // GiroExpress fica com R$ 1,00 por entrega concluída.
  // Entregador recebe o líquido calculado no ciclo dele.
  // Status "paid" da loja = valor efetivamente recebido.
  // Status "paid" do entregador = valor efetivamente pago.
  // =========================================================
  const getStoreCycleAmount = (cycle) =>
    Number(
      cycle?.total_gross ??
        cycle?.total_billing ??
        cycle?.total_to_pay ??
        cycle?.value_to_pay ??
        cycle?.total_amount ??
        cycle?.total_fee ??
        0
    );

  const getCourierCycleAmount = (cycle) =>
    Number(
      cycle?.total_to_pay ??
        cycle?.total_courier ??
        cycle?.value_to_pay ??
        cycle?.total_amount ??
        cycle?.amount ??
        0
    );

  const getCycleKey = (cycle) => {
    const start = String(
      cycle?.display_period_start ||
        cycle?.period_start ||
        cycle?.start_date ||
        ""
    ).slice(0, 10);
    const end = String(
      cycle?.display_period_end ||
        cycle?.period_end ||
        cycle?.end_date ||
        start
    ).slice(0, 10);
    return `${start}|${end}`;
  };

  const getCycleLabel = (cycle) => {
    const start =
      cycle?.display_period_start || cycle?.period_start || cycle?.start_date;
    const end =
      cycle?.display_period_end || cycle?.period_end || cycle?.end_date;

    if (start || end) {
      return `${formatDateBR(start)} até ${formatDateBR(end || start)}`;
    }

    return String(cycle?.cycle_label || "-").replace(
      /(\d{4})-(\d{2})-(\d{2})/g,
      (_, year, month, day) => `${day}/${month}/${year}`
    );
  };

  const cycleFinancialMap = {};

  (billing.history || []).forEach((cycle) => {
    const key = getCycleKey(cycle);
    if (!cycleFinancialMap[key]) {
      cycleFinancialMap[key] = {
        cycle_key: key,
        cycle_label: getCycleLabel(cycle),
        deliveries: 0,
        store_billing: 0,
        store_received: 0,
        store_pending: 0,
        courier_to_pay: 0,
        courier_paid: 0,
        courier_pending: 0,
        revenue: 0,
      };
    }

    const amount = getStoreCycleAmount(cycle);
    const deliveries = Number(cycle?.total_deliveries || 0);
    const status = String(cycle?.status || "").toLowerCase();

    cycleFinancialMap[key].deliveries += deliveries;
    cycleFinancialMap[key].store_billing += amount;
    cycleFinancialMap[key].revenue += Number(
      cycle?.total_platform_fee ?? deliveries * 1
    );

    if (status === "paid") {
      cycleFinancialMap[key].store_received += amount;
    } else {
      cycleFinancialMap[key].store_pending += amount;
    }
  });

  (billing.courier_history || []).forEach((cycle) => {
    const key = getCycleKey(cycle);
    if (!cycleFinancialMap[key]) {
      cycleFinancialMap[key] = {
        cycle_key: key,
        cycle_label: getCycleLabel(cycle),
        deliveries: 0,
        store_billing: 0,
        store_received: 0,
        store_pending: 0,
        courier_to_pay: 0,
        courier_paid: 0,
        courier_pending: 0,
        revenue: 0,
      };
    }

    const amount = getCourierCycleAmount(cycle);
    const status = String(cycle?.status || "").toLowerCase();
    cycleFinancialMap[key].courier_to_pay += amount;

    if (status === "paid") {
      cycleFinancialMap[key].courier_paid += amount;
    } else {
      cycleFinancialMap[key].courier_pending += amount;
    }
  });

  const giroHistory = Object.values(cycleFinancialMap)
    .map((item) => ({
      ...item,
      store_billing: Number(item.store_billing.toFixed(2)),
      store_received: Number(item.store_received.toFixed(2)),
      store_pending: Number(item.store_pending.toFixed(2)),
      courier_to_pay: Number(item.courier_to_pay.toFixed(2)),
      courier_paid: Number(item.courier_paid.toFixed(2)),
      courier_pending: Number(item.courier_pending.toFixed(2)),
      revenue: Number(item.revenue.toFixed(2)),
    }))
    .sort((a, b) => String(b.cycle_key).localeCompare(String(a.cycle_key)));

  const cycleItemIsInPeriod = (item, startDate, endDate) => {
    if (!startDate || !endDate) return true;

    const [cycleStartRaw, cycleEndRaw] = String(item?.cycle_key || "").split("|");
    const cycleStart = String(cycleStartRaw || "").slice(0, 10);
    const cycleEnd = String(cycleEndRaw || cycleStart || "").slice(0, 10);

    if (!cycleStart) return false;

    // Exibe o ciclo quando ele cruza o intervalo escolhido.
    return cycleStart <= endDate && cycleEnd >= startDate;
  };

  const filteredGiroHistory = giroHistory.filter((item) =>
    cycleItemIsInPeriod(item, giroCycleAppliedStart, giroCycleAppliedEnd)
  );

  const filteredFinancialHistory = giroHistory.filter((item) =>
    cycleItemIsInPeriod(
      item,
      financialCycleAppliedStart,
      financialCycleAppliedEnd
    )
  );

  const applyGiroCyclePeriod = () => {
    if (!giroCycleStart || !giroCycleEnd) {
      toast.error("Informe a data inicial e a data final.");
      return;
    }

    if (giroCycleStart > giroCycleEnd) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }

    setGiroCycleAppliedStart(giroCycleStart);
    setGiroCycleAppliedEnd(giroCycleEnd);
    setShowGiroCycleHistory(true);
  };

  const applyFinancialCyclePeriod = () => {
    if (!financialCycleStart || !financialCycleEnd) {
      toast.error("Informe a data inicial e a data final.");
      return;
    }

    if (financialCycleStart > financialCycleEnd) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }

    setFinancialCycleAppliedStart(financialCycleStart);
    setFinancialCycleAppliedEnd(financialCycleEnd);
  };

  const totalStoreReceived = (billing.history || [])
    .filter((cycle) => String(cycle?.status || "").toLowerCase() === "paid")
    .reduce((sum, cycle) => sum + getStoreCycleAmount(cycle), 0);

  const totalCourierPaid = (billing.courier_history || [])
    .filter((cycle) => String(cycle?.status || "").toLowerCase() === "paid")
    .reduce((sum, cycle) => sum + getCourierCycleAmount(cycle), 0);


  if (loading) {
    return (
      <Layout subtitle="Admin Master">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />

          <span>
            Carregando painel administrativo...
          </span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout subtitle="Painel Admin Master">
      <div className="space-y-6">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Shield className="w-6 h-6 text-slate-300" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white">
                  Admin Master
                </h1>

                <p className="text-sm text-slate-400">
                  Gestão geral do GiroExpress
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            {refreshing
              ? "Atualizando..."
              : "Atualizar"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Taxas coletadas no período
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {formatBRL(periodPlatformFees)}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  R$ 1,00 por entrega · período selecionado
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Usuários
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {stats?.total_users ?? 0}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  {stats?.total_stores ?? 0} lojas ·{" "}
                  {stats?.total_couriers ?? 0} motoboys
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Entregas concluídas no período
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {periodCompletedCount}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  De {periodTotalCount} entregas no período
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  Chamados abertos
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {stats?.open_tickets ??
                    openTickets.length}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  Suporte pendente
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </div>

        </div>

        {/* =====================================================
            CONSULTA ÚNICA POR PERÍODO
            ===================================================== */}
        <section className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Consultar dados por período
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                A semana atual já vem preenchida automaticamente. Você pode alterar as datas e clicar em Consultar.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Data inicial</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(event) => {
                    setPeriodStart(event.target.value);
                    setPeriodQueryVisible(false);
                    setPeriodBilling(null);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Data final</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => {
                    setPeriodEnd(event.target.value);
                    setPeriodQueryVisible(false);
                    setPeriodBilling(null);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={loadPeriodBilling}
                disabled={periodBillingLoading || !periodStart || !periodEnd}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {periodBillingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Consultar
              </button>

              {periodQueryVisible && (
                <button
                  type="button"
                  onClick={() => {
                    const currentWeek = getCurrentWeekInputDates();
                    setPeriodStart(currentWeek.start);
                    setPeriodEnd(currentWeek.end);
                    setPeriodQueryVisible(false);
                    setPeriodBilling(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {!periodQueryVisible && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-center">
              <p className="text-sm text-slate-400">
                A semana atual já está selecionada automaticamente. Clique em Consultar para abrir os relatórios detalhados.
              </p>
            </div>
          )}
        </section>

        {/* =====================================================
            MONITORAMENTO DE CORRIDAS — ADMIN MASTER
            ===================================================== */}
        {periodQueryVisible && (
          <section className="bg-slate-900 border border-blue-500/20 rounded-2xl p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
                      <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Eye className="w-5 h-5 text-blue-400" />
                          Monitoramento de corridas
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                          O Admin Master pode consultar as corridas e verificar o que aconteceu em cada etapa.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadAdminDeliveries(true)}
                        disabled={deliveriesLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${deliveriesLoading ? "animate-spin" : ""}`} />
                        Atualizar corridas
                      </button>
                    </div>
          
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                      <input
                        value={deliverySearch}
                        onChange={(e) => setDeliverySearch(e.target.value)}
                        placeholder="Buscar por ID, código, loja, cliente ou entregador"
                        className="xl:col-span-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                      />
                      <select
                        value={deliveryStatusFilter}
                        onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                      >
                        <option value="all">Todos os status</option>
                        <option value="pending">Pendentes</option>
                        <option value="accepted">Aceitas</option>
                        <option value="picked_up">Retiradas</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="completed">Concluídas</option>
                        <option value="cancelled">Canceladas</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={deliveryDateStart || periodStart}
                          onChange={(e) => setDeliveryDateStart(e.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <input
                          type="date"
                          value={deliveryDateEnd || periodEnd}
                          onChange={(e) => setDeliveryDateEnd(e.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
          
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => loadAdminDeliveries(true)}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                      >
                        🔎 Consultar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliverySearch("");
                          setDeliveryStatusFilter("all");
                          setDeliveryDateStart("");
                          setDeliveryDateEnd("");
                          setTimeout(() => loadAdminDeliveries(true), 0);
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        Limpar filtros
                      </button>
                      <span className="ml-auto text-xs text-slate-500">
                        {adminDeliveries.length} corrida(s) encontrada(s)
                      </span>
                    </div>
          
                    {deliveriesLoading ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Carregando corridas...
                      </div>
                    ) : adminDeliveries.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                        Nenhuma corrida encontrada com os filtros informados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950 text-left">
                              <th className="px-4 py-3 text-slate-500 font-medium">Data</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Corrida</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Loja</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Entregador</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Valor</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                              <th className="px-4 py-3 text-slate-500 font-medium">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminDeliveries.map((delivery, index) => {
                              const deliveryId = String(delivery?.id || delivery?._id || index);
                              const status = String(delivery?.status || "").toLowerCase();
                              const dateValue = delivery?.completed_at || delivery?.created_at;
                              return (
                                <tr key={`admin-delivery-${deliveryId}-${index}`} className="border-b border-slate-800/70 last:border-0">
                                  <td className="px-4 py-4 text-slate-300 whitespace-nowrap">
                                    {dateValue ? formatDateTimeBR(dateValue) : "—"}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="font-semibold text-white">{normalizeText(delivery?.code, deliveryId)}</div>
                                    <div className="text-[11px] text-slate-600 break-all">{deliveryId}</div>
                                  </td>
                                  <td className="px-4 py-4 text-white">{normalizeText(delivery?.store_name, "Loja")}</td>
                                  <td className="px-4 py-4 text-slate-300">{normalizeText(delivery?.courier_name, "Não informado")}</td>
                                  <td className="px-4 py-4 text-emerald-400 font-semibold">{formatBRL(Number(delivery?.gross_price ?? delivery?.price ?? 0))}</td>
                                  <td className="px-4 py-4">
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getDeliveryStatusClass(status)}`}>
                                      {getDeliveryStatusLabel(status)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDelivery(delivery)}
                                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Ver detalhes
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Resumo dos fechamentos
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Acompanhamento das cobranças semanais das lojas
                        </p>
                      </div>
          
                      <CircleDollarSign className="w-6 h-6 text-emerald-400" />
                    </div>
          
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">
                          Em aberto
                        </p>
          
                        <p className="text-xl font-bold text-amber-400 mt-1">
                          {formatBRL(totalBillingOpen)}
                        </p>
                      </div>
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">
                          Fechados
                        </p>
          
                        <p className="text-xl font-bold text-blue-400 mt-1">
                          {formatBRL(totalBillingClosed)}
                        </p>
                      </div>
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-sm text-slate-400">
                          Pagos
                        </p>
          
                        <p className="text-xl font-bold text-emerald-400 mt-1">
                          {formatBRL(totalBillingPaid)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-sm text-slate-400">
                          Recebido das lojas
                        </p>

                        <p className="text-xl font-bold text-emerald-400 mt-1">
                          {formatBRL(totalStoreReceived)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="text-sm text-slate-400">
                          Pago aos entregadores
                        </p>

                        <p className="text-xl font-bold text-amber-400 mt-1">
                          {formatBRL(totalCourierPaid)}
                        </p>
                      </div>
          
                    </div>
                  </section>
        )}

        {/* =====================================================
            FINANCEIRO DO GIROEXPRESS — CICLO ATUAL
            ===================================================== */}
        {periodQueryVisible && (
          <section className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6">
          
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
          
                      <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                          <CircleDollarSign className="w-5 h-5 text-emerald-400" />
                          Financeiro do GiroExpress
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Visão do ciclo atual. O GiroExpress recebe R$ 1,00 por cada entrega concluída.
                        </p>
                      </div>
          
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                        R$ 1,00 por entrega
                      </span>
          
                    </div>
          
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-500">
                          🛵 Corridas concluídas
                        </p>
          
                        <p className="text-2xl font-bold text-white mt-1">
                          {giroCurrentDeliveries}
                        </p>
          
                        <p className="text-xs text-slate-500 mt-1">
                          No ciclo atual
                        </p>
                      </div>
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-500">
                          🏪 A receber das lojas
                        </p>
          
                        <p className="text-2xl font-bold text-blue-400 mt-1">
                          {formatBRL(giroCurrentReceivable)}
                        </p>
          
                        <p className="text-xs text-slate-500 mt-1">
                          Cobranças do ciclo atual
                        </p>
                      </div>
          
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-500">
                          🚴 A pagar aos entregadores
                        </p>
          
                        <p className="text-2xl font-bold text-amber-400 mt-1">
                          {formatBRL(giroCurrentCourierPay)}
                        </p>
          
                        <p className="text-xs text-slate-500 mt-1">
                          Valores calculados no ciclo atual
                        </p>
                      </div>
          
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <p className="text-xs text-slate-500">
                          🟢 Receita do GiroExpress
                        </p>
          
                        <p className="text-2xl font-bold text-emerald-400 mt-1">
                          {formatBRL(giroCurrentRevenue)}
                        </p>
          
                        <p className="text-xs text-slate-500 mt-1">
                          {giroCurrentDeliveries} entrega{giroCurrentDeliveries === 1 ? "" : "s"} × R$ 1,00
                        </p>
                      </div>
          
                    </div>
          
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        Regra financeira
                      </p>
          
                      <p className="text-sm text-slate-300 mt-1">
                        A receita do GiroExpress é calculada exclusivamente pelas entregas concluídas:
                        <strong className="text-emerald-400">
                          {" "}quantidade de entregas × R$ 1,00
                        </strong>.
                      </p>
                    </div>
          
                  </section>
        )}

        {/* =====================================================
            FATURAMENTO GIROEXPRESS POR CICLO — RECOLHÍVEL
            Só usa ciclos de LOJAS já fechados/pagos do billing.history.
            Receita do GiroExpress = soma da taxa da plataforma do ciclo.
            ===================================================== */}
        <section className="bg-slate-900 border border-emerald-500/20 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowGiroCycleHistory((current) => !current)}
            className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Faturamento GiroExpress por ciclo
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Cada fechamento das lojas fica salvo por ciclo. Clique para consultar quanto o GiroExpress ganhou em cada período.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-sm text-emerald-400 font-semibold">
                {filteredGiroHistory.length} {filteredGiroHistory.length === 1 ? "ciclo" : "ciclos"}
              </span>
              <span className="text-slate-400 text-xl leading-none">
                {showGiroCycleHistory ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {showGiroCycleHistory && (
            <div className="border-t border-slate-800 p-6 pt-5">
              <div className="mb-5 rounded-xl border border-emerald-500/20 bg-slate-950/60 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Consultar ciclos por período
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      A semana atual já vem preenchida automaticamente. Você pode alterar as datas e clicar em Consultar.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Data inicial
                      </label>
                      <input
                        type="date"
                        value={giroCycleStart}
                        onChange={(event) => setGiroCycleStart(event.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Data final
                      </label>
                      <input
                        type="date"
                        value={giroCycleEnd}
                        onChange={(event) => setGiroCycleEnd(event.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={applyGiroCyclePeriod}
                      disabled={!giroCycleStart || !giroCycleEnd}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" />
                      Consultar
                    </button>
                  </div>
                </div>
              </div>

              {filteredGiroHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-slate-400">
                    Nenhum ciclo encontrado no período selecionado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGiroHistory.map((item, index) => (
                    <div
                      key={`giro-cycle-${item.cycle_key}-${index}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Ciclo semanal
                          </p>
                          <p className="text-white font-semibold mt-1">
                            {item.cycle_label}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">
                            {item.deliveries} {item.deliveries === 1 ? "entrega fechada" : "entregas fechadas"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 min-w-[210px]">
                          <p className="text-xs text-emerald-300">
                            Ganho GiroExpress no ciclo
                          </p>
                          <p className="text-2xl font-bold text-emerald-400 mt-1">
                            {formatBRL(item.revenue)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            R$ 1,00 por entrega concluída e fechada
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Faturado das lojas</p>
                          <p className="text-sm font-semibold text-blue-400 mt-1">{formatBRL(item.store_billing)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Recebido das lojas</p>
                          <p className="text-sm font-semibold text-emerald-400 mt-1">{formatBRL(item.store_received)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Pendente das lojas</p>
                          <p className="text-sm font-semibold text-amber-400 mt-1">{formatBRL(item.store_pending)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Pago aos entregadores</p>
                          <p className="text-sm font-semibold text-violet-400 mt-1">{formatBRL(item.courier_paid)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      </div>
          
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Faturamento por ciclo
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Valores cobrados, recebidos, pagos e receita do GiroExpress em cada ciclo fechado.
                        </p>
                      </div>
                    </div>
          
                    <div className="mb-5 rounded-xl border border-emerald-500/20 bg-slate-950/60 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-400" />
                            Consultar ciclos por período
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            A semana atual já vem preenchida automaticamente. Você pode alterar as datas e clicar em Consultar.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">
                              Data inicial
                            </label>
                            <input
                              type="date"
                              value={financialCycleStart}
                              onChange={(event) => setFinancialCycleStart(event.target.value)}
                              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-slate-500 mb-1">
                              Data final
                            </label>
                            <input
                              type="date"
                              value={financialCycleEnd}
                              onChange={(event) => setFinancialCycleEnd(event.target.value)}
                              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={applyFinancialCyclePeriod}
                            disabled={!financialCycleStart || !financialCycleEnd}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <Eye className="w-4 h-4" />
                            Consultar
                          </button>
                        </div>
                      </div>
                    </div>

                    {filteredFinancialHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                        <p className="text-slate-400">
                          Nenhum ciclo encontrado no período selecionado.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950 text-left">
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Ciclo
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Corridas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Faturado lojas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Recebido lojas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Pendente lojas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                A pagar entregadores
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Pago entregadores
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Receita GiroExpress
                              </th>
                            </tr>
                          </thead>
          
                          <tbody>
                            {filteredFinancialHistory.map((item, index) => (
                              <tr
                                key={`giro-history-${item.cycle_label}-${index}`}
                                className="border-b border-slate-800/70 last:border-0"
                              >
                                <td className="px-4 py-4 text-white font-medium">
                                  {item.cycle_label}
                                </td>
          
                                <td className="px-4 py-4 text-slate-300">
                                  {item.deliveries}
                                </td>
          
                                <td className="px-4 py-4 text-blue-400 font-semibold">
                                  {formatBRL(item.store_billing)}
                                </td>

                                <td className="px-4 py-4 text-emerald-400 font-semibold">
                                  {formatBRL(item.store_received)}
                                </td>

                                <td className="px-4 py-4 text-amber-400 font-semibold">
                                  {formatBRL(item.store_pending)}
                                </td>

                                <td className="px-4 py-4 text-amber-300 font-semibold">
                                  {formatBRL(item.courier_to_pay)}
                                </td>

                                <td className="px-4 py-4 text-violet-400 font-semibold">
                                  {formatBRL(item.courier_paid)}
                                </td>
          
                                <td className="px-4 py-4 text-emerald-400 font-bold">
                                  {formatBRL(item.revenue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
          
                  </section>

        {/* =====================================================
            FATURAMENTO SIMPLES — LOJAS E ENTREGADORES
            Fluxo: Ciclo atual -> Aguardando pagamento -> Histórico
            ===================================================== */}
        <section className="space-y-5">
          {(() => {
            const storeCurrent = Array.isArray(billing?.current_cycles) ? billing.current_cycles : [];
            const courierCurrent = Array.isArray(billing?.courier_current_cycles) ? billing.courier_current_cycles : [];
            const storeClosed = (billing?.history || []).filter((c) => String(c?.status || "").toLowerCase() === "closed");
            const courierClosed = (billing?.courier_history || []).filter((c) => String(c?.status || "").toLowerCase() === "closed");
            const storePaid = (billing?.history || []).filter((c) => String(c?.status || "").toLowerCase() === "paid");
            const courierPaid = (billing?.courier_history || []).filter((c) => String(c?.status || "").toLowerCase() === "paid");

            const storeName = (cycle) => normalizeText(
              cycle?.store_name ||
              (billing?.stores || []).find((s) => String(s?.id || s?._id || "") === String(cycle?.store_id || ""))?.name ||
              "Loja"
            );
            const courierName = (cycle) => normalizeText(
              cycle?.courier_name ||
              (billing?.couriers || []).find((c) => String(c?.id || c?._id || "") === String(cycle?.courier_id || ""))?.name ||
              couriers.find((c) => String(c?.id || c?._id || "") === String(cycle?.courier_id || ""))?.name ||
              "Entregador"
            );
            const storeGross = (c) => Number(c?.total_gross ?? c?.total_billing ?? c?.value_to_pay ?? c?.total_amount ?? 0);
            const platformFee = (c) => Number(c?.total_platform_fee ?? (Number(c?.total_deliveries || 0) * 1));
            const courierGross = (c) => Number(c?.total_gross ?? 0);
            const courierNet = (c) => Number(c?.total_courier ?? c?.total_to_pay ?? c?.value_to_pay ?? 0);
            const cyclePeriod = (c) => `${formatDateBR(c?.display_period_start || c?.period_start)} até ${formatDateBR(c?.display_period_end || c?.period_end)}`;

            const currentDeliveries = storeCurrent.reduce((sum, c) => sum + Number(c?.total_deliveries || 0), 0);
            const currentStores = storeCurrent.reduce((sum, c) => sum + storeGross(c), 0);
            const currentCouriers = courierCurrent.reduce((sum, c) => sum + courierNet(c), 0);
            const currentGiro = storeCurrent.reduce((sum, c) => sum + platformFee(c), 0);

            const DetailRows = ({ cycle, type }) => {
              const details = Array.isArray(cycle?.delivery_details) ? cycle.delivery_details : [];
              if (!details.length) return <p className="text-sm text-slate-500 py-3">Nenhuma corrida detalhada foi gravada neste ciclo.</p>;
              return (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-950 text-slate-500"><tr>
                      <th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Corrida</th><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-right">Valor</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {details.map((d, i) => <tr key={d?.id || d?.code || i}>
                        <td className="px-3 py-2 text-slate-400">{formatDateTimeBR(d?.completed_at || d?.created_at || d?.date)}</td>
                        <td className="px-3 py-2 text-white font-medium">{d?.code || d?.delivery_code || d?.id || "—"}</td>
                        <td className="px-3 py-2 text-slate-300">{normalizeText(d?.client_name || d?.customer_name || "—")}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-bold">{formatBRL(Number(d?.gross_price || d?.price || 0))}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              );
            };

            const StoreCard = ({ cycle, mode }) => {
              const key = `store-${cycle?.id || cycle?.store_id}-${cycle?.period_start || "current"}`;
              const open = !!expandedBillingCycles[key];
              return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-xl">🏪</span><h4 className="text-white font-bold truncate">{storeName(cycle)}</h4></div>
                    <p className="text-xs text-slate-500 mt-1">{cyclePeriod(cycle)}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm">
                      <span className="text-slate-300"><b className="text-white">{Number(cycle?.total_deliveries || 0)}</b> corridas</span>
                      <span className="text-slate-300">GiroExpress <b className="text-cyan-400">{formatBRL(platformFee(cycle))}</b></span>
                      <span className="text-slate-300">Loja paga <b className="text-emerald-400 text-base">{formatBRL(storeGross(cycle))}</b></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpandedBillingCycles((v) => ({...v, [key]: !v[key]}))} className="px-4 py-2 rounded-xl border border-slate-700 text-sm font-bold text-white hover:bg-slate-800">{open ? "Ocultar corridas" : "Ver corridas"}</button>
                    {mode === "current" && String(cycle?.status || "open").toLowerCase() !== "closed" && <button type="button" disabled={closingStore === cycle?.store_id || Number(cycle?.total_deliveries || 0) === 0} onClick={() => closeBilling(cycle?.store_id)} className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40">{closingStore === cycle?.store_id ? "Fechando..." : "Fechar ciclo"}</button>}
                    {mode === "current" && String(cycle?.status || "").toLowerCase() === "closed" && <button type="button" disabled={payingCycle === (cycle?.id || cycle?.pending_cycle_id)} onClick={() => payBilling(cycle?.id || cycle?.pending_cycle_id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{payingCycle === (cycle?.id || cycle?.pending_cycle_id) ? "Confirmando..." : "Confirmar pagamento da loja"}</button>}
                    {mode === "closed" && <button type="button" disabled={payingCycle === cycle?.id} onClick={() => payBilling(cycle?.id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{payingCycle === cycle?.id ? "Confirmando..." : "Confirmar recebimento"}</button>}
                    {mode === "paid" && <span className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold">✓ Pago</span>}
                  </div>
                </div>
                {mode === "current" && String(cycle?.status || "").toLowerCase() === "closed" && <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">Ciclo fechado • valores mantidos até a confirmação do pagamento</div>}
                {mode !== "current" && <div className="mt-3 text-xs text-slate-500">Fechado: {formatDateTimeBR(cycle?.closed_at)}{cycle?.paid_at ? ` • Pago: ${formatDateTimeBR(cycle?.paid_at)}` : " • Aguardando confirmação"}</div>}
                {open && <DetailRows cycle={cycle} type="store" />}
              </div>;
            };

            const CourierCard = ({ cycle, mode }) => {
              const key = `courier-${cycle?.id || cycle?.courier_id}-${cycle?.period_start || "current"}`;
              const open = !!expandedBillingCycles[key];
              return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="text-xl">🛵</span><h4 className="text-white font-bold truncate">{courierName(cycle)}</h4></div>
                    <p className="text-xs text-slate-500 mt-1">{cyclePeriod(cycle)}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm">
                      <span className="text-slate-300"><b className="text-white">{Number(cycle?.total_deliveries || 0)}</b> corridas</span>
                      <span className="text-slate-300">Bruto <b className="text-white">{formatBRL(courierGross(cycle))}</b></span>
                      <span className="text-slate-300">GiroExpress <b className="text-cyan-400">{formatBRL(platformFee(cycle))}</b></span>
                      <span className="text-slate-300">A pagar <b className="text-emerald-400 text-base">{formatBRL(courierNet(cycle))}</b></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpandedBillingCycles((v) => ({...v, [key]: !v[key]}))} className="px-4 py-2 rounded-xl border border-slate-700 text-sm font-bold text-white hover:bg-slate-800">{open ? "Ocultar corridas" : "Ver corridas"}</button>
                    {mode === "current" && String(cycle?.status || "open").toLowerCase() !== "closed" && <button type="button" disabled={closingCourier === cycle?.courier_id || Number(cycle?.total_deliveries || 0) === 0} onClick={() => closeCourierBilling(cycle?.courier_id)} className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40">{closingCourier === cycle?.courier_id ? "Fechando..." : "Fechar ciclo"}</button>}
                    {mode === "current" && String(cycle?.status || "").toLowerCase() === "closed" && <button type="button" disabled={payingCycle === cycle?.id} onClick={() => payCourierBilling(cycle?.id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{payingCycle === cycle?.id ? "Confirmando..." : "Confirmar que entregador recebeu"}</button>}
                    {mode === "closed" && <button type="button" disabled={payingCycle === cycle?.id} onClick={() => payCourierBilling(cycle?.id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">{payingCycle === cycle?.id ? "Confirmando..." : "Confirmar pagamento"}</button>}
                    {mode === "paid" && <span className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-bold">✓ Pago</span>}
                  </div>
                </div>
                {mode === "current" && String(cycle?.status || "").toLowerCase() === "closed" && <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">Ciclo fechado • valores mantidos até a confirmação do pagamento</div>}
                {mode !== "current" && <div className="mt-3 text-xs text-slate-500">Fechado: {formatDateTimeBR(cycle?.closed_at)}{cycle?.paid_at ? ` • Pago: ${formatDateTimeBR(cycle?.paid_at)}` : " • Aguardando confirmação"}</div>}
                {open && <DetailRows cycle={cycle} type="courier" />}
              </div>;
            };

            const activeStores = billingView === "current" ? storeCurrent : billingView === "pending" ? storeClosed : storePaid;
            const activeCouriers = billingView === "current" ? courierCurrent : billingView === "pending" ? courierClosed : courierPaid;
            const mode = billingView === "current" ? "current" : billingView === "pending" ? "closed" : "paid";

            return <>
              <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">GiroExpress Financeiro</p><h2 className="text-2xl font-black text-white mt-1">Controle de ciclos</h2><p className="text-sm text-slate-400 mt-1">Loja paga o valor integral. GiroExpress fica com R$ 1,00 por corrida. O restante é do entregador.</p></div>
                  <button type="button" onClick={() => loadBilling(true)} disabled={billingLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${billingLoading ? "animate-spin" : ""}`} />Atualizar</button>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"><p className="text-xs text-slate-500">Corridas do ciclo</p><p className="text-2xl font-black text-white mt-1">{currentDeliveries}</p></div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"><p className="text-xs text-slate-500">Lojas a receber</p><p className="text-2xl font-black text-emerald-400 mt-1">{formatBRL(currentStores)}</p></div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"><p className="text-xs text-slate-500">Entregadores a pagar</p><p className="text-2xl font-black text-amber-300 mt-1">{formatBRL(currentCouriers)}</p></div>
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-xs text-cyan-300">GiroExpress</p><p className="text-2xl font-black text-cyan-400 mt-1">{formatBRL(currentGiro)}</p></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
                {[{id:"current",label:"Ciclo atual",count:storeCurrent.length+courierCurrent.length},{id:"pending",label:"Aguardando pagamento",count:storeClosed.length+courierClosed.length},{id:"history",label:"Histórico",count:storePaid.length+courierPaid.length}].map((tab) => <button key={tab.id} type="button" onClick={() => setBillingView(tab.id)} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${billingView===tab.id ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{tab.label}<span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs">{tab.count}</span></button>)}
              </div>

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-lg font-black text-white">🏪 Lojas</h3><p className="text-xs text-slate-500">{billingView === "current" ? "Valores do ciclo em andamento" : billingView === "pending" ? "Ciclos fechados aguardando recebimento" : "Ciclos pagos e preservados"}</p></div><span className="text-xs font-bold text-slate-400">{activeStores.length} ciclo(s)</span></div><div className="space-y-3">{activeStores.length ? activeStores.map((c,i)=><StoreCard key={c?.id || `${c?.store_id}-${i}`} cycle={c} mode={mode}/>) : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Nenhum ciclo de loja nesta etapa.</div>}</div></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-lg font-black text-white">🛵 Entregadores</h3><p className="text-xs text-slate-500">{billingView === "current" ? "Ganhos do ciclo em andamento" : billingView === "pending" ? "Ciclos fechados aguardando pagamento" : "Pagamentos confirmados e preservados"}</p></div><span className="text-xs font-bold text-slate-400">{activeCouriers.length} ciclo(s)</span></div><div className="space-y-3">{activeCouriers.length ? activeCouriers.map((c,i)=><CourierCard key={c?.id || `${c?.courier_id}-${i}`} cycle={c} mode={mode}/>) : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Nenhum ciclo de entregador nesta etapa.</div>}</div></div>
              </div>
            </>;
          })()}
        </section>

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        Faturamento por período
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Resultado de {formatDateBR(periodStart)} até {formatDateBR(periodEnd)}.
                      </p>
                    </div>
          
                    {!periodBilling ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                        <p className="text-slate-400">
                          Selecione o período e clique em <strong className="text-slate-300">Consultar período</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">Entregas das lojas</p>
                            <p className="text-xl font-bold text-white mt-1">
                              {Number(periodBilling?.totals?.store_deliveries || 0)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">Faturamento das lojas</p>
                            <p className="text-xl font-bold text-emerald-400 mt-1">
                              {formatBRL(Number(periodBilling?.totals?.store_billing || 0))}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">Faturamento bruto entregadores</p>
                            <p className="text-xl font-bold text-white mt-1">
                              {formatBRL(Number(periodBilling?.totals?.courier_gross || 0))}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">Total a pagar aos entregadores</p>
                            <p className="text-xl font-bold text-emerald-400 mt-1">
                              {formatBRL(Number(periodBilling?.totals?.courier_to_pay || 0))}
                            </p>
                          </div>
                        </div>
          
                        <div>
                          <h3 className="text-base font-semibold text-white mb-3">Faturamento das lojas</h3>
                          {Array.isArray(periodBilling?.stores) && periodBilling.stores.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-800">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-800 bg-slate-950 text-left">
                                    <th className="px-4 py-3 text-slate-500 font-medium">Loja</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Entregas</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Faturamento</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {periodBilling.stores.map((item, index) => (
                                    <tr key={`period-store-${item?.id || index}`} className="border-b border-slate-800/70 last:border-0">
                                      <td className="px-4 py-4 text-white font-semibold">{normalizeText(item?.name, "Loja")}</td>
                                      <td className="px-4 py-4 text-slate-300">{Number(item?.total_deliveries || 0)}</td>
                                      <td className="px-4 py-4 text-emerald-400 font-bold">{formatBRL(Number(item?.total_gross ?? item?.total_billing ?? item?.total_fee ?? 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Nenhuma loja com entregas no período.</div>
                          )}
                        </div>
          
                        <div>
                          <h3 className="text-base font-semibold text-white mb-3">Faturamento dos entregadores</h3>
                          {Array.isArray(periodBilling?.couriers) && periodBilling.couriers.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-800">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-800 bg-slate-950 text-left">
                                    <th className="px-4 py-3 text-slate-500 font-medium">Entregador</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Entregas</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Bruto</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Taxa plataforma</th>
                                    <th className="px-4 py-3 text-slate-500 font-medium">Valor a pagar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {periodBilling.couriers.map((item, index) => (
                                    <tr key={`period-courier-${item?.id || index}`} className="border-b border-slate-800/70 last:border-0">
                                      <td className="px-4 py-4 text-white font-semibold">{normalizeText(item?.name, "Entregador")}</td>
                                      <td className="px-4 py-4 text-slate-300">{Number(item?.total_deliveries || 0)}</td>
                                      <td className="px-4 py-4 text-slate-300">{formatBRL(Number(item?.total_gross || 0))}</td>
                                      <td className="px-4 py-4 text-slate-300">{formatBRL(Number(item?.total_platform_fee || 0))}</td>
                                      <td className="px-4 py-4 text-emerald-400 font-bold">{formatBRL(Number(item?.total_courier ?? item?.total_to_pay ?? 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Nenhum entregador com entregas no período.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center gap-2 mb-5">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
          
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Detalhamento das entregas
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Visão diária das taxas geradas pelas entregas concluídas.
                        </p>
                      </div>
                    </div>
          
                    {!Array.isArray(
                      stats?.store_fees_details
                    ) ||
                    stats.store_fees_details.length ===
                      0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                        <p className="text-slate-400">
                          Nenhuma entrega concluída encontrada.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
          
                          <thead>
                            <tr className="border-b border-slate-800 text-left">
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Loja
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Data
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Entregas concluídas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Taxa total
                              </th>
                            </tr>
                          </thead>
          
                          <tbody>
                            {stats.store_fees_details.map(
                              (item, index) => (
                                <tr
                                  key={`fee-${normalizeText(
                                    item.store_name,
                                    "store"
                                  )}-${item.date || "date"}-${index}`}
                                  className="border-b border-slate-800/70 last:border-0"
                                >
                                  <td className="px-4 py-4 text-white">
                                    {normalizeText(
                                      item.store_name,
                                      "Loja"
                                    )}
                                  </td>
          
                                  <td className="px-4 py-4 text-slate-300">
                                    {formatDateBR(
                                      item.date
                                    )}
                                  </td>
          
                                  <td className="px-4 py-4 text-slate-300">
                                    {Number(
                                      item.deliveries_count ||
                                        0
                                    )}{" "}
                                    entregas
                                  </td>
          
                                  <td className="px-4 py-4 text-emerald-400 font-semibold">
                                    {formatBRL(
                                      Number(
                                        item?.total_gross ??
                                          item?.total_billing ??
                                          item?.total_fee ??
                                          0
                                      )
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
          
                        </table>
                      </div>
                    )}
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center justify-between mb-5">
          
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Conferência de comprovantes
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Analise os comprovantes enviados pelas lojas.
                        </p>
                      </div>
          
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                        {underReviewStatements.length} em análise
                      </span>
          
                    </div>
          
                    {statements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                        <p className="text-slate-400">
                          Nenhum comprovante encontrado.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
          
                          <thead>
                            <tr className="border-b border-slate-800 text-left">
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Loja
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Ciclo
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Entregas
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Valor
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Status
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Comprovante
                              </th>
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Ação
                              </th>
                            </tr>
                          </thead>
          
                          <tbody>
                            {statements.map(
                              (statement, index) => {
                                const statementId =
                                  String(
                                    statement.id ||
                                      statement._id ||
                                      `statement-${index}`
                                  );
          
                                const status =
                                  String(
                                    statement.status ||
                                      ""
                                  ).toLowerCase();
          
                                const proofPath =
                                  statement.proof_path;
          
                                const proofUrl =
                                  proofPath
                                    ? `${API_BASE}/api/files?path=${encodeURIComponent(
                                        proofPath
                                      )}`
                                    : null;
          
                                return (
                                  <tr
                                    key={`statement-${statementId}-${index}`}
                                    className="border-b border-slate-800/70 last:border-0"
                                  >
                                    <td className="px-4 py-4 text-white font-medium">
                                      {normalizeText(
                                        statement.store_name,
                                        "Loja"
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4 text-slate-300">
                                      {normalizeText(
                                        statement.cycle_label,
                                        "-"
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4 text-slate-300">
                                      {Number(
                                        statement.total_deliveries ||
                                          0
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4 text-emerald-400 font-semibold">
                                      {formatBRL(
                                        statement.total_gross ||
                                          0
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4">
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getUserStatusClass(
                                          status
                                        )}`}
                                      >
                                        {getStatusLabel(
                                          status
                                        )}
                                      </span>
                                    </td>
          
                                    <td className="px-4 py-4">
                                      {proofUrl ? (
                                        <a
                                          href={proofUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          Abrir comprovante
                                        </a>
                                      ) : (
                                        <span className="text-xs text-slate-600">
                                          Sem arquivo
                                        </span>
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4">
                                      {status ===
                                        "under_review" && (
                                        <div className="flex gap-2">
          
                                          <button
                                            type="button"
                                            onClick={() =>
                                              approveStmt(
                                                statementId,
                                                true
                                              )
                                            }
                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                                          >
                                            Aprovar
                                          </button>
          
                                          <button
                                            type="button"
                                            onClick={() =>
                                              approveStmt(
                                                statementId,
                                                false
                                              )
                                            }
                                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
                                          >
                                            Rejeitar
                                          </button>
          
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
          
                        </table>
                      </div>
                    )}
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center gap-2 mb-5">
          
                      <DollarSign className="w-5 h-5 text-emerald-400" />
          
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Dados bancários
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Informações utilizadas pelo sistema para recebimentos.
                        </p>
                      </div>
          
                    </div>
          
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">
                          Banco
                        </label>
          
                        <input
                          value={bank.bank}
                          onChange={(event) =>
                            setBank((previous) => ({
                              ...previous,
                              bank: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                          placeholder="Banco"
                        />
                      </div>
          
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">
                          Agência
                        </label>
          
                        <input
                          value={bank.agency}
                          onChange={(event) =>
                            setBank((previous) => ({
                              ...previous,
                              agency: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                          placeholder="Agência"
                        />
                      </div>
          
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">
                          Conta
                        </label>
          
                        <input
                          value={bank.account}
                          onChange={(event) =>
                            setBank((previous) => ({
                              ...previous,
                              account: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                          placeholder="Conta"
                        />
                      </div>
          
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">
                          Chave Pix
                        </label>
          
                        <input
                          value={bank.pix_key}
                          onChange={(event) =>
                            setBank((previous) => ({
                              ...previous,
                              pix_key: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                          placeholder="Chave Pix"
                        />
                      </div>
          
                    </div>
          
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={saveBank}
                        disabled={savingBank}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {savingBank ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
          
                        Salvar dados bancários
                      </button>
                    </div>
          
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          
                      <div className="flex items-center gap-3">
          
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-emerald-400" />
                        </div>
          
                        <div>
                          <h2 className="text-lg font-semibold text-white">
                            Contas dos entregadores
                          </h2>
          
                          <p className="text-sm text-slate-400 mt-1">
                            Consulte o cadastro completo, endereço, veículo e dados de pagamento dos entregadores.
                          </p>
                        </div>
          
                      </div>
          
                      <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-400">
                        {couriers.length} entregador
                        {couriers.length === 1 ? "" : "es"}
                      </div>
          
                    </div>
          
                    {couriers.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          
                        <Users className="w-8 h-8 mx-auto text-slate-600 mb-3" />
          
                        <p className="text-slate-400">
                          Nenhum entregador cadastrado.
                        </p>
          
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
          
                        <table className="w-full text-sm">
          
                          <thead>
                            <tr className="border-b border-slate-800 text-left">
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Entregador
                              </th>
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Telefone
                              </th>
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Status
                              </th>
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Conta
                              </th>
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                PIX
                              </th>
          
                              <th className="px-4 py-3 text-slate-500 font-medium">
                                Ação
                              </th>
          
                            </tr>
                          </thead>
          
                          <tbody>
          
                            {couriers.map(
                              (courier, index) => {
          
                                const courierId =
                                  getUserId(courier) ||
                                  `courier-${index}`;
          
                                const status =
                                  String(
                                    courier.status ||
                                      "pending"
                                  ).toLowerCase();
          
                                const account =
                                  courier.payment_account ||
                                  {};
          
                                const registered =
                                  hasPaymentAccount(
                                    courier
                                  );
          
                                return (
                                  <tr
                                    key={`courier-${courierId}-${index}`}
                                    className="border-b border-slate-800/70 last:border-0"
                                  >
          
                                    <td className="px-4 py-4">
          
                                      <div className="flex items-center gap-3">
          
                                        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
                                          <Users className="w-4 h-4 text-slate-400" />
                                        </div>
          
                                        <div>
                                          <p className="text-white font-medium">
                                            {normalizeText(
                                              courier.name,
                                              "Entregador"
                                            )}
                                          </p>
          
                                          {courier.email && (
                                            <p className="text-xs text-slate-500 mt-1">
                                              {normalizeText(
                                                courier.email
                                              )}
                                            </p>
                                          )}
                                        </div>
          
                                      </div>
          
                                    </td>
          
                                    <td className="px-4 py-4 text-slate-300">
                                      {normalizeText(
                                        courier.phone,
                                        "-"
                                      )}
                                    </td>
          
                                    <td className="px-4 py-4">
          
                                      <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getUserStatusClass(
                                          status
                                        )}`}
                                      >
                                        {getStatusLabel(
                                          status
                                        )}
                                      </span>
          
                                    </td>
          
                                    <td className="px-4 py-4">
          
                                      {registered ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Cadastrada
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                                          Não cadastrada
                                        </span>
                                      )}
          
                                    </td>
          
                                    <td className="px-4 py-4">
          
                                      {registered ? (
                                        <div>
          
                                          <p className="text-slate-300 text-xs">
                                            {getPixTypeLabel(
                                              account.pix_key_type
                                            )}
                                          </p>
          
                                          <p className="text-slate-500 text-xs mt-1 max-w-[220px] truncate">
                                            {normalizeText(
                                              account.pix_key,
                                              "-"
                                            )}
                                          </p>
          
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-600">
                                          -
                                        </span>
                                      )}
          
                                    </td>
          
                                    <td className="px-4 py-4">
          
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedCourier(
                                            courier
                                          )
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        Ver cadastro
                                      </button>
          
                                    </td>
          
                                  </tr>
                                );
                              }
                            )}
          
                          </tbody>
          
                        </table>
                      </div>
                    )}
          
                  </section>
        )}

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center gap-2 mb-5">
          
                      <Power className="w-5 h-5 text-blue-400" />
          
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Operações da plataforma
                        </h2>
          
                        <p className="text-sm text-slate-400 mt-1">
                          Configure os horários gerais de funcionamento.
                        </p>
                      </div>
          
                    </div>
          
                    <div className="flex flex-col gap-5">
          
                      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
          
                        <div>
                          <p className="text-sm font-medium text-white">
                            Plataforma ativa
                          </p>
          
                          <p className="text-xs text-slate-500 mt-1">
                            Permite o funcionamento normal do sistema.
                          </p>
                        </div>
          
                        <button
                          type="button"
                          onClick={() =>
                            saveOps({
                              active:
                                !Boolean(
                                  ops.active
                                ),
                            })
                          }
                          disabled={savingOps}
                          className={`relative w-12 h-7 rounded-full transition ${
                            ops.active
                              ? "bg-emerald-600"
                              : "bg-slate-700"
                          }`}
                          aria-label="Alternar plataforma"
                        >
                          <span
                            className={`absolute top-1 w-5 h-5 rounded-full bg-white transition ${
                              ops.active
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </button>
          
                      </div>
          
                      <div>
          
                        <p className="text-sm font-medium text-white mb-3">
                          Dias sem operação
                        </p>
          
                        <div className="flex flex-wrap gap-2">
          
                          {WEEKDAYS.map(
                            (day, index) => {
                              const disabled =
                                Array.isArray(
                                  ops.disabled_days
                                ) &&
                                ops.disabled_days.includes(
                                  day.i
                                );
          
                              return (
                                <button
                                  key={`weekday-button-${day.i}-${index}`}
                                  type="button"
                                  onClick={() =>
                                    toggleWeekday(
                                      day.i
                                    )
                                  }
                                  disabled={savingOps}
                                  className={`rounded-xl border px-3 py-2 text-sm transition disabled:opacity-50 ${
                                    disabled
                                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                                      : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                                  }`}
                                >
                                  {day.label}
                                </button>
                              );
                            }
                          )}
          
                        </div>
                      </div>
          
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">
                            Horário de abertura
                          </label>
          
                          <input
                            type="time"
                            value={
                              ops.open_time ||
                              "00:00"
                            }
                            onChange={(event) =>
                              setOps(
                                (previous) => ({
                                  ...previous,
                                  open_time:
                                    event.target.value,
                                })
                              )
                            }
                            onBlur={() =>
                              saveOps({
                                open_time:
                                  ops.open_time,
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                          />
                        </div>
          
                        <div>
                          <label className="block text-xs text-slate-500 mb-1.5">
                            Horário de fechamento
                          </label>
          
                          <input
                            type="time"
                            value={
                              ops.close_time ||
                              "23:59"
                            }
                            onChange={(event) =>
                              setOps(
                                (previous) => ({
                                  ...previous,
                                  close_time:
                                    event.target.value,
                                })
                              )
                            }
                            onBlur={() =>
                              saveOps({
                                close_time:
                                  ops.close_time,
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                          />
                        </div>
          
                      </div>
          
                      <div>
          
                        <p className="text-sm font-medium text-white mb-3">
                          Feriados
                        </p>
          
                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          
                          <input
                            type="date"
                            value={newHoliday}
                            onChange={(event) =>
                              setNewHoliday(
                                event.target.value
                              )
                            }
                            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                          />
          
                          <button
                            type="button"
                            onClick={addHoliday}
                            disabled={savingOps}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar
                          </button>
          
                        </div>
          
                        <div className="flex flex-wrap gap-2">
          
                          {(Array.isArray(
                            ops.holidays
                          )
                            ? ops.holidays
                            : []
                          ).map(
                            (holiday, index) => (
                              <div
                                key={`holiday-${holiday}-${index}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                              >
                                {formatDateBR(
                                  holiday
                                )}
          
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeHoliday(
                                      holiday
                                    )
                                  }
                                  disabled={savingOps}
                                  className="text-red-400 hover:text-red-300 disabled:opacity-50"
                                  aria-label={`Remover feriado ${holiday}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )
                          )}
          
                        </div>
                      </div>
          
                    </div>
                  </section>
        )}

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

          <div className="flex items-center gap-2 mb-5">

            <Users className="w-5 h-5 text-blue-400" />

            <div>
              <h2 className="text-lg font-semibold text-white">
                Usuários
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Gerencie lojas, motoboys e demais usuários.
              </p>
            </div>

          </div>

          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Nenhum usuário encontrado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>
                  <tr className="border-b border-slate-800 text-left">

                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Nome
                    </th>

                    <th className="px-4 py-3 text-slate-500 font-medium">
                      E-mail
                    </th>

                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Perfil
                    </th>

                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Status
                    </th>

                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Ações
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {users.map(
                    (user, index) => {

                      const userId =
                        getUserId(
                          user
                        ) ||
                        `user-${index}`;

                      const status =
                        String(
                          user.status ||
                            "pending"
                        ).toLowerCase();

                      const isAdmin =
                        String(
                          user.role || ""
                        ).toLowerCase() ===
                        "admin";

                      return (
                        <tr
                          key={`user-${userId}-${index}`}
                          className="border-b border-slate-800/70 last:border-0"
                        >

                          <td className="px-4 py-4">

                            <div className="text-white font-medium">
                              {normalizeText(
                                user.name,
                                "Usuário"
                              )}
                            </div>

                            {user.phone && (
                              <div className="text-xs text-slate-500 mt-1">
                                {normalizeText(
                                  user.phone
                                )}
                              </div>
                            )}

                          </td>

                          <td className="px-4 py-4 text-slate-300">
                            {normalizeText(
                              user.email,
                              "-"
                            )}
                          </td>

                          <td className="px-4 py-4">

                            <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
                              {getRoleLabel(
                                user.role
                              )}
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getUserStatusClass(
                                status
                              )}`}
                            >
                              {getStatusLabel(
                                status
                              )}
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            {!isAdmin && (
                              <div className="flex flex-wrap gap-2">

                                {status !==
                                  "active" &&
                                  status !==
                                    "approved" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        approveUser(
                                          userId
                                        )
                                      }
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                                    >
                                      Aprovar
                                    </button>
                                  )}

                                {(status ===
                                  "active" ||
                                  status ===
                                    "approved") && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchUser(
                                        userId,
                                        {
                                          status:
                                            "blocked",
                                        },
                                        "Usuário bloqueado"
                                      )
                                    }
                                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
                                  >
                                    Bloquear
                                  </button>
                                )}

                                {status ===
                                  "blocked" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchUser(
                                        userId,
                                        {
                                          status:
                                            "active",
                                        },
                                        "Usuário reativado"
                                      )
                                    }
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                  >
                                    Reativar
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCourier(user)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                  title="Ver cadastro completo"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Ver cadastro
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteUser(
                                      userId,
                                      user
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </button>

                              </div>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>
            </div>
          )}

        </section>

        {periodQueryVisible && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          
                    <div className="flex items-center justify-between mb-5">
          
                      <div className="flex items-center gap-2">
          
                        <Headphones className="w-5 h-5 text-orange-400" />
          
                        <div>
                          <h2 className="text-lg font-semibold text-white">
                            Suporte
                          </h2>
          
                          <p className="text-sm text-slate-400 mt-1">
                            Chamados enviados ao suporte administrativo.
                          </p>
                        </div>
          
                      </div>
          
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                        {openTickets.length} abertos
                      </span>
          
                    </div>
          
                    {tickets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                        <p className="text-slate-400">
                          Nenhum chamado encontrado.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
          
                        {tickets.map(
                          (ticket, index) => {
          
                            const ticketId =
                              String(
                                ticket.id ||
                                  ticket._id ||
                                  `ticket-${index}`
                              );
          
                            const status =
                              String(
                                ticket.status ||
                                  "open"
                              ).toLowerCase();
          
                            return (
                              <div
                                key={`ticket-${ticketId}-${index}`}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                              >
          
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          
                                  <div>
          
                                    <div className="flex flex-wrap items-center gap-2">
          
                                      <span className="text-white font-semibold">
                                        {normalizeText(
                                          ticket.subject ||
                                            ticket.title,
                                          "Chamado"
                                        )}
                                      </span>
          
                                      {ticket.code && (
                                        <span className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-400">
                                          {normalizeText(
                                            ticket.code
                                          )}
                                        </span>
                                      )}
          
                                      <span
                                        className={`inline-flex rounded-full border px-2 py-1 text-xs ${getUserStatusClass(
                                          status
                                        )}`}
                                      >
                                        {getStatusLabel(
                                          status
                                        )}
                                      </span>
          
                                    </div>
          
                                    <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">
                                      {normalizeText(
                                        ticket.message ||
                                          ticket.description,
                                        "Sem mensagem."
                                      )}
                                    </p>
          
                                    {(ticket.user_name ||
                                      ticket.email) && (
                                      <p className="text-xs text-slate-600 mt-3">
          
                                        {normalizeText(
                                          ticket.user_name
                                        )}
          
                                        {ticket.email
                                          ? ` · ${normalizeText(
                                              ticket.email
                                            )}`
                                          : ""}
          
                                      </p>
                                    )}
          
                                  </div>
          
                                  {status ===
                                    "open" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        resolveTicket(
                                          ticketId
                                        )
                                      }
                                      className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Resolver
                                    </button>
                                  )}
          
                                </div>
                              </div>
                            );
                          }
                        )}
          
                      </div>
                    )}
          
                  </section>
        )}

      </div>


      {storeCloseConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Confirmar fechamento do ciclo</h2>
            <p className="mt-1 text-sm text-slate-400">
              Confira os valores antes de fechar. Depois do fechamento, novas entregas entram no novo ciclo.
            </p>

            {(() => {
              const deliveries = Number(storeCloseConfirmation.deliveries || 0);
              const gross = Number(storeCloseConfirmation.gross || 0);
              const platformFee = deliveries * 1;
              const courierTotal = Math.max(gross - platformFee, 0);

              return (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">Loja</p>
                    <p className="font-semibold text-white">{storeCloseConfirmation.storeName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">Entregas concluídas</p>
                      <p className="text-lg font-bold text-white">{deliveries}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">Taxa GiroExpress</p>
                      <p className="text-lg font-bold text-blue-400">{formatBRL(platformFee)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="text-xs text-emerald-300">Valor que a loja deve pagar</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatBRL(gross)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">Valor total destinado aos entregadores</p>
                    <p className="text-xl font-bold text-white">{formatBRL(courierTotal)}</p>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStoreCloseConfirmation(null)}
                disabled={closingStore !== null}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const storeId = storeCloseConfirmation.storeId;
                  await closeBilling(storeId);
                  setStoreCloseConfirmation(null);
                }}
                disabled={closingStore !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {closingStore !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {courierCloseConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Confirmar fechamento do entregador</h2>
            <p className="mt-1 text-sm text-slate-400">Confira o valor antes de fechar o período.</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs text-slate-500">Entregador</p>
                <p className="font-semibold text-white">{courierCloseConfirmation.courierName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Entregas</p>
                  <p className="text-lg font-bold text-white">{courierCloseConfirmation.deliveries}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-300">Valor a pagar</p>
                  <p className="text-xl font-bold text-emerald-400">{formatBRL(courierCloseConfirmation.amount)}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCourierCloseConfirmation(null)}
                disabled={closingCourier !== null}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Cancelar
              </button>
              <button type="button"
                onClick={async () => {
                  const courierId = courierCloseConfirmation.courierId;
                  const success = await closeCourierBilling(courierId);

                  if (success) {
                    setCourierCloseConfirmation(null);
                  }
                }}
                disabled={closingCourier !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {closingCourier !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {courierPayConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Confirmar pagamento do entregador</h2>
            <p className="mt-1 text-sm text-slate-400">Confirme somente depois de efetuar o pagamento.</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs text-slate-500">Entregador</p>
                <p className="font-semibold text-white">{courierPayConfirmation.courierName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Entregas</p>
                  <p className="text-lg font-bold text-white">{courierPayConfirmation.deliveries}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-300">Valor a pagar</p>
                  <p className="text-xl font-bold text-emerald-400">{formatBRL(courierPayConfirmation.amount)}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCourierPayConfirmation(null)}
                disabled={payingCycle !== null}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                Cancelar
              </button>
              <button type="button"
                onClick={async () => {
                  const cycleId = courierPayConfirmation.cycleId;
                  const success = await payCourierBilling(cycleId);

                  if (success) {
                    setCourierPayConfirmation(null);
                  }
                }}
                disabled={payingCycle !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {payingCycle !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                Efetuar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDelivery && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDelivery(null);
            }
          }}
        >
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  Detalhes da corrida
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {normalizeText(selectedDelivery?.code, selectedDelivery?.id || "Corrida")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getDeliveryStatusClass(selectedDelivery?.status)}`}>
                    {getDeliveryStatusLabel(selectedDelivery?.status)}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Loja</p>
                  <p className="text-sm font-semibold text-white mt-1">{normalizeText(selectedDelivery?.store_name, "Loja")}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Entregador</p>
                  <p className="text-sm font-semibold text-white mt-1">{normalizeText(selectedDelivery?.courier_name, "Não informado")}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="text-sm font-semibold text-white mt-1">{normalizeText(selectedDelivery?.client_name, "Não informado")}</p>
                  {selectedDelivery?.client_phone && <p className="text-xs text-slate-500 mt-1">{selectedDelivery.client_phone}</p>}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Valor bruto</p>
                  <p className="text-lg font-bold text-emerald-400 mt-1">{formatBRL(Number(selectedDelivery?.gross_price ?? selectedDelivery?.price ?? 0))}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Distância</p>
                  <p className="text-sm font-semibold text-white mt-1">{selectedDelivery?.distance_km != null ? `${selectedDelivery.distance_km} km` : "Não informada"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Origem</p>
                  <p className="text-sm text-slate-200 mt-1 break-words">{normalizeText(selectedDelivery?.pickup_address, "Não informado")}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Destino</p>
                  <p className="text-sm text-slate-200 mt-1 break-words">{normalizeText(selectedDelivery?.dropoff_address, "Não informado")}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="text-base font-semibold text-white mb-4">Linha do tempo</h3>
                <div className="space-y-3">
                  {Array.isArray(selectedDelivery?.status_history) && selectedDelivery.status_history.length > 0 ? (
                    selectedDelivery.status_history.map((event, index) => (
                      <div key={`delivery-event-${index}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 mt-1.5" />
                          {index < selectedDelivery.status_history.length - 1 && <div className="w-px flex-1 bg-slate-700 mt-1" />}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-semibold text-white">{getDeliveryStatusLabel(event?.status)}</p>
                          <p className="text-xs text-slate-500 mt-1">{event?.at ? formatDateTimeBR(event.at) : "Horário não registrado"}</p>
                          {event?.actor_name && <p className="text-xs text-slate-500 mt-1">Responsável: {event.actor_name}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-400 mt-1.5" /><div><p className="text-sm font-semibold text-white">Corrida criada</p><p className="text-xs text-slate-500 mt-1">{selectedDelivery?.created_at ? formatDateTimeBR(selectedDelivery.created_at) : "Horário não registrado"}</p></div></div>
                      {selectedDelivery?.completed_at && <div className="flex gap-3"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5" /><div><p className="text-sm font-semibold text-white">{getDeliveryStatusLabel(selectedDelivery?.status)}</p><p className="text-xs text-slate-500 mt-1">{formatDateTimeBR(selectedDelivery.completed_at)}</p></div></div>}
                      <p className="text-xs text-slate-600">Histórico detalhado de etapas não disponível para esta corrida antiga.</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedDelivery?.notes && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-500">Observações</p>
                  <p className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{selectedDelivery.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 bg-slate-950 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCourier && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCourier(null);
            }
          }}
        >
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  {String(selectedCourier.role || "").toLowerCase() === "store" ? (
                    <Store className="w-6 h-6 text-blue-400" />
                  ) : (
                    <Users className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Cadastro {String(selectedCourier.role || "").toLowerCase() === "store" ? "da loja" : "do entregador"}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {normalizeText(selectedCourier.name, "Usuário")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCourier(null)}
                className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h3 className="text-sm font-bold text-white mb-3">Dados cadastrais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    [String(selectedCourier.role || "").toLowerCase() === "store" ? "Nome da loja" : "Nome completo", selectedCourier.name],
                    ["E-mail", selectedCourier.email],
                    ["Telefone", selectedCourier.phone],
                    ["Perfil", getRoleLabel(selectedCourier.role)],
                    ["Status", getStatusLabel(selectedCourier.status)],
                    ["Data do cadastro", formatDateTimeBR(selectedCourier.created_at)],
                  ].map(([label, value], index) => (
                    <div key={`cad-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-medium text-white mt-1 break-words">{normalizeText(value, "-")}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-white mb-3">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ["CEP", selectedCourier.cep],
                    ["Rua / Avenida", selectedCourier.street],
                    ["Número", selectedCourier.number],
                    ["Complemento", selectedCourier.complement],
                    ["Bairro", selectedCourier.neighborhood],
                    ["Cidade", selectedCourier.city],
                    ["UF", selectedCourier.state],
                  ].map(([label, value], index) => (
                    <div key={`end-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-medium text-white mt-1 break-words">{normalizeText(value, "-")}</p>
                    </div>
                  ))}
                </div>

                {selectedCourier.address && (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">Endereço completo / cadastro antigo</p>
                    <p className="text-sm font-medium text-white mt-1 break-words">
                      {normalizeText(selectedCourier.address, "-")}
                    </p>
                  </div>
                )}
              </section>

              {String(selectedCourier.role || "").toLowerCase() !== "store" && (
                <section>
                  <h3 className="text-sm font-bold text-white mb-3">Veículo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      ["Tipo", selectedCourier.vehicle_type],
                      ["Marca / Modelo", selectedCourier.vehicle_model],
                      ["Placa", selectedCourier.vehicle_plate],
                    ].map(([label, value], index) => (
                      <div key={`veic-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-sm font-medium text-white mt-1 break-words">{normalizeText(value, "-")}</p>
                      </div>
                    ))}
                  </div>

                  {selectedCourier.vehicle && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">Veículo / cadastro antigo</p>
                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(selectedCourier.vehicle, "-")}
                      </p>
                    </div>
                  )}
                </section>
              )}

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Conta / PIX</h3>
                </div>

                {hasPaymentAccount(selectedCourier) ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        ["Titular da conta", selectedCourier?.payment_account?.holder_name],
                        ["CPF / CNPJ", selectedCourier?.payment_account?.document],
                        ["Banco", selectedCourier?.payment_account?.bank],
                        ["Agência", selectedCourier?.payment_account?.agency],
                        ["Número da conta", selectedCourier?.payment_account?.account],
                        ["Tipo da conta", getAccountTypeLabel(selectedCourier?.payment_account?.account_type)],
                        ["Tipo da chave PIX", getPixTypeLabel(selectedCourier?.payment_account?.pix_key_type)],
                        ["Chave PIX", selectedCourier?.payment_account?.pix_key],
                      ].map(([label, value], index) => (
                        <div key={`pix-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="text-sm font-medium text-white mt-1 break-all">{normalizeText(value, "-")}</p>
                        </div>
                      ))}
                    </div>

                    {selectedCourier?.payment_account?.updated_at && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        Última atualização: {formatDateTimeBR(selectedCourier.payment_account.updated_at)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center">
                    <CreditCard className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                    <p className="text-white font-medium">Conta de pagamento não cadastrada</p>
                    <p className="text-sm text-slate-500 mt-1">Este usuário ainda não informou os dados bancários ou PIX.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="flex justify-end border-t border-slate-800 bg-slate-950 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedCourier(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}

