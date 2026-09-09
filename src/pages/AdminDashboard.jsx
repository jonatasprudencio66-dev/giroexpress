
import React, { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, apiError, API_BASE } from "@/lib/api";
import { formatBRL } from "@/lib/pricing";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  Users,
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

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
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
  const [savingBank, setSavingBank] = useState(false);
  const [savingOps, setSavingOps] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState(null);

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

  const [periodStart, setPeriodStart] = useState(getMonthStartInputDate());
  const [periodEnd, setPeriodEnd] = useState(getTodayInputDate());
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
              ? data.weekdays
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
          ]);

        const [
          statsResult,
          usersResult,
          statementsResult,
          ticketsResult,
          settingsResult,
          operationsResult,
          billingResult,
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
                ? data.weekdays
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
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadStats, loadBilling]);

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
      toast.success("Faturamento do período atualizado");
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
      return;
    }

    try {
      setClosingCourier(courierId);

      await api.post(
        `/admin/billing/couriers/${encodeURIComponent(
          courierId
        )}/close`
      );

      toast.success("Fechamento do entregador realizado com sucesso");
      await loadBilling(true);
      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setClosingCourier(null);
    }
  };

  const payCourierBilling = async (cycleId) => {
    if (!cycleId) {
      toast.error("Este período ainda não foi fechado para pagamento.");
      return;
    }

    try {
      setPayingCycle(cycleId);

      await api.post(
        `/admin/billing/courier-cycles/${encodeURIComponent(
          cycleId
        )}/pay`
      );

      toast.success("Pagamento do entregador confirmado com sucesso");
      await loadBilling(true);
      await loadStats();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setPayingCycle(null);
    }
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
            cycle?.total_fee || 0
          ),
        0
      );

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
            cycle?.total_fee || 0
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
            cycle?.total_fee || 0
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

  const giroHistory = Object.values(
    billing.history.reduce((groups, cycle) => {
      const label =
        cycle?.cycle_label ||
        `${formatDateBR(cycle?.start_date)} até ${formatDateBR(cycle?.end_date)}`;

      if (!groups[label]) {
        groups[label] = {
          cycle_label: label,
          deliveries: 0,
          receivable: 0,
        };
      }

      groups[label].deliveries += Number(
        cycle?.total_deliveries || 0
      );

      groups[label].receivable += Number(
        cycle?.total_fee || 0
      );

      return groups;
    }, {})
  )
    .map((item) => ({
      ...item,
      revenue: Number((item.deliveries * 1).toFixed(2)),
    }))
    .sort((a, b) =>
      String(b.cycle_label).localeCompare(
        String(a.cycle_label)
      )
    );

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
                  Taxas coletadas
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {formatBRL(
                    Number(
                      stats?.platform_fees_collected ||
                        0
                    )
                  )}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  R$ 1,00 por entrega
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
                  Entregas concluídas
                </p>

                <p className="text-2xl font-bold text-white mt-1">
                  {stats?.delivered ?? 0}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  De {stats?.total_deliveries ?? 0} entregas
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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

          </div>
        </section>

        {/* =====================================================
            FINANCEIRO DO GIROEXPRESS — CICLO ATUAL
            ===================================================== */}
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

        {/* =====================================================
            HISTÓRICO DA RECEITA DO GIROEXPRESS
            ===================================================== */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Histórico da receita do GiroExpress
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Receita de R$ 1,00 por entrega em cada ciclo já fechado.
              </p>
            </div>
          </div>

          {giroHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Nenhum ciclo fechado para exibir a receita do GiroExpress.
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
                      A receber das lojas
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Receita GiroExpress
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {giroHistory.map((item, index) => (
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
                        {formatBRL(item.receivable)}
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

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">

            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Fechamento das lojas
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Configure o dia de fechamento e acompanhe cada ciclo semanal.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadBilling(true)}
              disabled={billingLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  billingLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Atualizar fechamentos
            </button>
          </div>

          {billingLoading &&
          billing.stores.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              Carregando fechamentos...
            </div>
          ) : billing.stores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Nenhuma loja cadastrada.
              </p>
            </div>
          ) : (
            <div className="space-y-4">

              {billing.stores.map(
                (store, index) => {
                  const storeId = String(
                    store.id ||
                      store._id ||
                      `store-${index}`
                  );

                  const cycle =
                    getCurrentCycleForStore(
                      storeId
                    );

                  const isSaving =
                    savingStoreDay ===
                    storeId;

                  const isClosing =
                    closingStore ===
                    storeId;

                  const cycleStatus =
                    cycle?.status ||
                    "open";

                  return (
                    <div
                      key={`store-${storeId}-${index}`}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >

                      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                        <div className="min-w-0">
                          <div className="flex items-center gap-3">

                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                              <Package className="w-5 h-5 text-slate-300" />
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-semibold text-white truncate">
                                {getStoreName(
                                  store
                                )}
                              </h3>

                              {store.email && (
                                <p className="text-xs text-slate-500 truncate">
                                  {normalizeText(
                                    store.email
                                  )}
                                </p>
                              )}
                            </div>

                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">

                          <div>
                            <label className="block text-xs text-slate-500 mb-1">
                              Dia de fechamento
                            </label>

                            <select
                              value={Number(
                                store.closing_weekday ?? 6
                              )}
                              onChange={(event) =>
                                saveStoreClosingDay(
                                  storeId,
                                  event.target.value
                                )
                              }
                              disabled={isSaving}
                              className="w-full sm:w-48 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                              {billing.weekdays.map(
                                (day, dayIndex) => (
                                  <option
                                    key={`weekday-${day.value}-${dayIndex}`}
                                    value={day.value}
                                  >
                                    {day.label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          {isSaving && (
                            <div className="flex items-end pb-2">
                              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                            </div>
                          )}

                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-5">

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">
                            Ciclo atual
                          </p>

                          <p className="text-sm font-medium text-white mt-1">
                            {cycle?.cycle_label ||
                              "Calculando..."}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">
                            Dia escolhido
                          </p>

                          <p className="text-sm font-medium text-white mt-1">
                            {getBillingDayLabel(
                              store.closing_weekday
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">
                            Entregas concluídas
                          </p>

                          <p className="text-xl font-bold text-white mt-1">
                            {cycle?.total_deliveries ?? 0}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">
                            Taxa do ciclo
                          </p>

                          <p className="text-xl font-bold text-emerald-400 mt-1">
                            {formatBRL(
                              cycle?.total_fee || 0
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                          <p className="text-xs text-slate-500">
                            Status
                          </p>

                          <span
                            className={`inline-flex mt-2 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getBillingStatusClass(
                              cycleStatus
                            )}`}
                          >
                            {getStatusLabel(
                              cycleStatus
                            )}
                          </span>
                        </div>

                      </div>

                      <div className="flex flex-wrap gap-3 mt-5">

                        {String(
                          cycleStatus
                        ).toLowerCase() ===
                          "open" && (
                          <button
                            type="button"
                            onClick={() =>
                              closeBilling(
                                storeId
                              )
                            }
                            disabled={
                              isClosing ||
                              closingStore !==
                                null
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            {isClosing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}

                            Fechar ciclo
                          </button>
                        )}

                        {String(
                          cycleStatus
                        ).toLowerCase() ===
                          "closed" &&
                          cycle?.id && (
                            <button
                              type="button"
                              onClick={() =>
                                payBilling(
                                  cycle.id
                                )
                              }
                              disabled={
                                payingCycle !==
                                  null
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {payingCycle ===
                              cycle.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CircleDollarSign className="w-4 h-4" />
                              )}

                              Marcar como pago
                            </button>
                          )}

                        {String(
                          cycleStatus
                        ).toLowerCase() ===
                          "paid" && (
                          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Fechamento pago
                          </div>
                        )}

                      </div>

                      {cycle?.paid_at && (
                        <p className="text-xs text-slate-500 mt-3">
                          Pago em{" "}
                          {formatDateTimeBR(
                            cycle.paid_at
                          )}
                        </p>
                      )}

                      {cycle?.closed_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          Fechado em{" "}
                          {formatDateTimeBR(
                            cycle.closed_at
                          )}
                        </p>
                      )}

                    </div>
                  );
                }
              )}

            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">

          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-5 h-5 text-slate-300" />

            <div>
              <h2 className="text-lg font-semibold text-white">
                Histórico de fechamentos
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Todos os ciclos já fechados ou pagos.
              </p>
            </div>
          </div>

          {billing.history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">
                Nenhum fechamento histórico ainda.
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
                      Período
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Fechamento
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Entregas
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Taxa
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Datas
                    </th>
                    <th className="px-4 py-3 text-slate-500 font-medium">
                      Ação
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {billing.history.map(
                    (cycle, index) => {
                      const cycleId =
                        String(
                          cycle.id ||
                            cycle._id ||
                            `cycle-${index}`
                        );

                      const status =
                        String(
                          cycle.status ||
                            "open"
                        ).toLowerCase();

                      return (
                        <tr
                          key={`history-${cycleId}-${index}`}
                          className="border-b border-slate-800/70 last:border-0"
                        >
                          <td className="px-4 py-4 text-white font-medium">
                            {normalizeText(
                              cycle.store_name,
                              "Loja"
                            )}
                          </td>

                          <td className="px-4 py-4 text-slate-300">
                            {normalizeText(
                              cycle.cycle_label,
                              `${formatDateBR(
                                cycle.start_date
                              )} até ${formatDateBR(
                                cycle.end_date
                              )}`
                            )}
                          </td>

                          <td className="px-4 py-4 text-slate-400">
                            {normalizeText(
                              cycle.closing_weekday_label,
                              getBillingDayLabel(
                                cycle.closing_weekday
                              )
                            )}
                          </td>

                          <td className="px-4 py-4 text-slate-300">
                            {Number(
                              cycle.total_deliveries ||
                                0
                            )}
                          </td>

                          <td className="px-4 py-4 text-emerald-400 font-semibold">
                            {formatBRL(
                              cycle.total_fee ||
                                0
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getBillingStatusClass(
                                status
                              )}`}
                            >
                              {getStatusLabel(
                                status
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-500">
                            {cycle.closed_at && (
                              <div>
                                Fechado:{" "}
                                {formatDateTimeBR(
                                  cycle.closed_at
                                )}
                              </div>
                            )}

                            {cycle.paid_at && (
                              <div className="mt-1">
                                Pago:{" "}
                                {formatDateTimeBR(
                                  cycle.paid_at
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {status ===
                              "closed" && (
                              <button
                                type="button"
                                onClick={() =>
                                  payBilling(
                                    cycleId
                                  )
                                }
                                disabled={
                                  payingCycle !==
                                    null
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {payingCycle ===
                                cycleId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CircleDollarSign className="w-3.5 h-3.5" />
                                )}

                                Marcar pagamento
                              </button>
                            )}

                            {status ===
                              "paid" && (
                              <span className="text-xs text-emerald-400">
                                Pagamento confirmado
                              </span>
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

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Pagamentos dos entregadores
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Acompanhe as entregas concluídas, valores a pagar e confirme os pagamentos dos motoboys.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadBilling(true)}
              disabled={billingLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${billingLoading ? "animate-spin" : ""}`}
              />
              Atualizar entregadores
            </button>
          </div>

          {billingLoading &&
          billing.couriers.length === 0 &&
          billing.courier_current_cycles.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              Carregando pagamentos dos entregadores...
            </div>
          ) : billing.couriers.length === 0 &&
            billing.courier_current_cycles.length === 0 &&
            billing.courier_history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <Users className="w-9 h-9 mx-auto text-slate-600 mb-3" />
              <p className="text-white font-medium">
                Nenhum entregador encontrado.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Verifique se os usuários dos motoboys estão cadastrados com o perfil de entregador.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-white">
                    Período atual
                  </h3>
                  <span className="text-xs text-slate-500">
                    {billing.couriers.length} entregador{billing.couriers.length === 1 ? "" : "es"}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-left">
                        <th className="px-4 py-3 text-slate-500 font-medium">Entregador</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Período</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Entregas</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Valor a pagar</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.couriers.map((courier, index) => {
                        const courierId = String(
                          courier?.id || courier?._id || `courier-${index}`
                        );
                        const cycle =
                          billing.courier_current_cycles.find(
                            (item) =>
                              String(item?.courier_id) === courierId
                          ) || null;
                        const status = String(cycle?.status || "open").toLowerCase();
                        const amount = Number(
                          cycle?.total_courier ??
                            cycle?.total_to_pay ??
                            cycle?.value_to_pay ??
                            cycle?.total_amount ??
                            cycle?.amount ??
                            0
                        );
                        const deliveries = Number(cycle?.total_deliveries || 0);
                        const period =
                          cycle?.cycle_label ||
                          `${formatDateBR(cycle?.period_start || cycle?.start_date)} até ${formatDateBR(cycle?.period_end || cycle?.end_date)}`;
                        const cycleId = cycle?.id || cycle?._id || null;

                        return (
                          <tr
                            key={`courier-current-${courierId}-${index}`}
                            className="border-b border-slate-800/70 last:border-0"
                          >
                            <td className="px-4 py-4">
                              <div className="font-semibold text-white">
                                {normalizeText(courier?.name, "Entregador")}
                              </div>
                              {courier?.email && (
                                <div className="text-xs text-slate-500 mt-1">
                                  {courier.email}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-slate-300">
                              {period}
                            </td>
                            <td className="px-4 py-4 text-slate-300 font-medium">
                              {deliveries}
                            </td>
                            <td className="px-4 py-4 text-emerald-400 font-bold">
                              {formatBRL(amount)}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getBillingStatusClass(status)}`}
                              >
                                {getStatusLabel(status)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {status === "open" && (
                                  <button
                                    type="button"
                                    onClick={() => closeCourierBilling(courierId)}
                                    disabled={closingCourier !== null}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                  >
                                    {closingCourier === courierId ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Calendar className="w-3.5 h-3.5" />
                                    )}
                                    Fechar período
                                  </button>
                                )}

                                {status === "closed" && cycleId && (
                                  <button
                                    type="button"
                                    onClick={() => payCourierBilling(cycleId)}
                                    disabled={payingCycle !== null}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    {payingCycle === String(cycleId) ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CircleDollarSign className="w-3.5 h-3.5" />
                                    )}
                                    Confirmar pagamento
                                  </button>
                                )}

                                {status === "paid" && (
                                  <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Pagamento confirmado
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white mb-3">
                  Histórico de pagamentos dos entregadores
                </h3>

                {billing.courier_history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Nenhum pagamento de entregador fechado ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-left">
                          <th className="px-4 py-3 text-slate-500 font-medium">Entregador</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Período</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Entregas</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Valor a pagar</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Status</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Data</th>
                          <th className="px-4 py-3 text-slate-500 font-medium">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.courier_history.map((cycle, index) => {
                          const cycleId = String(
                            cycle?.id || cycle?._id || `courier-cycle-${index}`
                          );
                          const status = String(cycle?.status || "closed").toLowerCase();
                          const amount = Number(
                            cycle?.total_courier ??
                              cycle?.total_to_pay ??
                              cycle?.value_to_pay ??
                              cycle?.total_amount ??
                              cycle?.amount ??
                              0
                          );
                          const deliveries = Number(cycle?.total_deliveries || 0);
                          const period =
                            cycle?.cycle_label ||
                            `${formatDateBR(cycle?.period_start || cycle?.start_date)} até ${formatDateBR(cycle?.period_end || cycle?.end_date)}`;

                          return (
                            <tr
                              key={`courier-history-${cycleId}-${index}`}
                              className="border-b border-slate-800/70 last:border-0"
                            >
                              <td className="px-4 py-4 text-white font-semibold">
                                {normalizeText(cycle?.courier_name, "Entregador")}
                              </td>
                              <td className="px-4 py-4 text-slate-300">
                                {period}
                              </td>
                              <td className="px-4 py-4 text-slate-300">
                                {deliveries}
                              </td>
                              <td className="px-4 py-4 text-emerald-400 font-bold">
                                {formatBRL(amount)}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getBillingStatusClass(status)}`}
                                >
                                  {getStatusLabel(status)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-xs text-slate-500">
                                {cycle?.paid_at ? (
                                  <div>
                                    Pago: {formatDateTimeBR(cycle.paid_at)}
                                  </div>
                                ) : cycle?.closed_at ? (
                                  <div>
                                    Fechado: {formatDateTimeBR(cycle.closed_at)}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {status === "closed" && (
                                  <button
                                    type="button"
                                    onClick={() => payCourierBilling(cycleId)}
                                    disabled={payingCycle !== null}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    {payingCycle === cycleId ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CircleDollarSign className="w-3.5 h-3.5" />
                                    )}
                                    Confirmar pagamento
                                  </button>
                                )}
                                {status === "paid" && (
                                  <span className="inline-flex items-center gap-2 text-xs text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Pagamento confirmado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Faturamento por período
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Consulte quanto cada loja faturou e quanto cada entregador recebeu em qualquer período.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Data inicial</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Data final</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={loadPeriodBilling}
                disabled={periodBillingLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {periodBillingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Consultar período
              </button>
            </div>
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
                            <td className="px-4 py-4 text-emerald-400 font-bold">{formatBRL(Number(item?.total_fee ?? item?.total_billing ?? 0))}</td>
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
                            item.total_fee ||
                              0
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
                  Consulte os dados bancários e PIX cadastrados pelos motoboys.
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
                              Ver conta
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

      </div>

      {selectedCourier && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedCourier(null);
            }
          }}
        >

          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-emerald-400" />
                </div>

                <div>

                  <h2 className="text-lg font-bold text-white">
                    Conta do entregador
                  </h2>

                  <p className="text-sm text-slate-400">
                    {normalizeText(
                      selectedCourier.name,
                      "Entregador"
                    )}
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCourier(null)
                }
                className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-6">

              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4">

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                  <div>

                    <p className="text-xs text-slate-500">
                      Entregador
                    </p>

                    <p className="text-base font-semibold text-white mt-1">
                      {normalizeText(
                        selectedCourier.name,
                        "Entregador"
                      )}
                    </p>

                    {selectedCourier.phone && (
                      <p className="text-xs text-slate-500 mt-1">
                        {normalizeText(
                          selectedCourier.phone
                        )}
                      </p>
                    )}

                  </div>

                  <span
                    className={`inline-flex self-start sm:self-auto rounded-full border px-3 py-1.5 text-xs font-medium ${getUserStatusClass(
                      selectedCourier.status
                    )}`}
                  >
                    {getStatusLabel(
                      selectedCourier.status
                    )}
                  </span>

                </div>

              </div>

              {hasPaymentAccount(
                selectedCourier
              ) ? (
                <>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Titular da conta
                      </p>

                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.holder_name,
                          "-"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        CPF / CNPJ
                      </p>

                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.document,
                          "-"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Banco
                      </p>

                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.bank,
                          "-"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Agência
                      </p>

                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.agency,
                          "-"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Número da conta
                      </p>

                      <p className="text-sm font-medium text-white mt-1 break-words">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.account,
                          "-"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Tipo da conta
                      </p>

                      <p className="text-sm font-medium text-white mt-1">
                        {getAccountTypeLabel(
                          selectedCourier
                            ?.payment_account
                            ?.account_type
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Tipo da chave PIX
                      </p>

                      <p className="text-sm font-medium text-white mt-1">
                        {getPixTypeLabel(
                          selectedCourier
                            ?.payment_account
                            ?.pix_key_type
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs text-slate-500">
                        Chave PIX
                      </p>

                      <p className="text-sm font-medium text-emerald-400 mt-1 break-all">
                        {normalizeText(
                          selectedCourier
                            ?.payment_account
                            ?.pix_key,
                          "-"
                        )}
                      </p>
                    </div>

                  </div>

                  {selectedCourier
                    ?.payment_account
                    ?.updated_at && (
                    <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">

                      <Clock className="w-3.5 h-3.5" />

                      Última atualização:{" "}
                      {formatDateTimeBR(
                        selectedCourier
                          .payment_account
                          .updated_at
                      )}

                    </div>
                  )}

                </>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-8 text-center">

                  <CreditCard className="w-9 h-9 mx-auto text-amber-400 mb-3" />

                  <p className="text-white font-medium">
                    Conta de recebimento não cadastrada
                  </p>

                  <p className="text-sm text-slate-500 mt-2">
                    Este entregador ainda não informou os dados bancários ou a chave PIX.
                  </p>

                </div>
              )}

            </div>

            <div className="flex justify-end border-t border-slate-800 bg-slate-950 px-6 py-4">

              <button
                type="button"
                onClick={() =>
                  setSelectedCourier(null)
                }
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
