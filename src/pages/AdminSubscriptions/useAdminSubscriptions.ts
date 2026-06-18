import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui/Toast";
import {
  adminSubscriptionsService,
  type SubscriptionAdminRow,
  type BillingHistoryEvent,
} from "src/services/backend/adminSubscriptionsService";
import { usersService, type UserResponse } from "src/services/backend/usersService";
import type { Plan } from "src/services/backend/subscriptionService";
import { useSubscription } from "src/contexts/SubscriptionContext";

export interface UseAdminSubscriptionsReturn {
  loading: boolean;
  rows: SubscriptionAdminRow[];
  stateFilter: string;
  setStateFilter: (v: string) => void;
  planIdFilter: string;
  setPlanIdFilter: (v: string) => void;
  cancelTarget: SubscriptionAdminRow | null;
  setCancelTarget: (v: SubscriptionAdminRow | null) => void;
  cancelling: boolean;
  expandedRowId: string | null;
  toggleExpand: (id: string) => void;
  billingHistoryByRow: Record<string, BillingHistoryEvent[]>;
  billingLoadingByRow: Record<string, boolean>;
  overrideLoading: boolean;
  users: UserResponse[];
  plans: Plan[];
  userNameById: Record<string, string>;
  loadSubscriptions: () => Promise<void>;
  handleCancelConfirm: () => Promise<void>;
  handleOverride: (payload: { user_id: string; plan_id: string }) => Promise<void>;
}

export function useAdminSubscriptions(): UseAdminSubscriptionsReturn {
  const { t } = useTranslation("adminSubscriptions");
  const toast = useToast();

  // Use plans from the global SubscriptionProvider context instead of fetching
  // /plans separately (eliminates a redundant /plans call on mount).
  const { plans } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SubscriptionAdminRow[]>([]);
  const [stateFilter, setStateFilter] = useState("");
  const [planIdFilter, setPlanIdFilter] = useState("");
  const perPage = 200;

  const [cancelTarget, setCancelTarget] = useState<SubscriptionAdminRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [billingHistoryByRow, setBillingHistoryByRow] = useState<
    Record<string, BillingHistoryEvent[]>
  >({});
  const [billingLoadingByRow, setBillingLoadingByRow] = useState<
    Record<string, boolean>
  >({});

  const [overrideLoading, setOverrideLoading] = useState(false);

  const [users, setUsers] = useState<UserResponse[]>([]);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminSubscriptionsService.list({
        state: stateFilter || undefined,
        plan_id: planIdFilter || undefined,
        page: 1,
        per_page: perPage,
      });
      setRows(result.subscriptions);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [stateFilter, planIdFilter, perPage, t, toast]);

  const loadUsers = useCallback(async () => {
    try {
      const result = await usersService.list();
      setUsers(result);
    } catch {
      // non-critical — silently fail
    }
  }, []);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const loadBillingHistory = useCallback(
    async (id: string) => {
      if (billingHistoryByRow[id] !== undefined) return;
      setBillingLoadingByRow((prev) => ({ ...prev, [id]: true }));
      try {
        const events = await adminSubscriptionsService.billingHistory(id);
        setBillingHistoryByRow((prev) => ({ ...prev, [id]: events }));
      } catch {
        toast.error(t("errors.billingHistoryFailed"));
      } finally {
        setBillingLoadingByRow((prev) => ({ ...prev, [id]: false }));
      }
    },
    [billingHistoryByRow, t, toast],
  );

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedRowId((prev) => {
        const next = prev === id ? null : id;
        if (next !== null) {
          void loadBillingHistory(next);
        }
        return next;
      });
    },
    [loadBillingHistory],
  );

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelling(true);
    try {
      await adminSubscriptionsService.cancel(target.id);
      toast.success(t("messages.cancelled"));
      setCancelTarget(null);
      void loadSubscriptions();
    } catch {
      toast.error(t("errors.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, t, toast, loadSubscriptions]);

  const handleOverride = useCallback(
    async (payload: { user_id: string; plan_id: string }) => {
      setOverrideLoading(true);
      try {
        await adminSubscriptionsService.override(payload);
        toast.success(t("messages.overridden"));
        void loadSubscriptions();
      } catch {
        toast.error(t("errors.overrideFailed"));
      } finally {
        setOverrideLoading(false);
      }
    },
    [t, toast, loadSubscriptions],
  );

  const userNameById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[String(u.id)] = u.username;
    }
    return map;
  }, [users]);

  return useMemo(
    () => ({
      loading,
      rows,
      stateFilter,
      setStateFilter,
      planIdFilter,
      setPlanIdFilter,
      cancelTarget,
      setCancelTarget,
      cancelling,
      expandedRowId,
      toggleExpand,
      billingHistoryByRow,
      billingLoadingByRow,
      overrideLoading,
      users,
      plans,
      userNameById,
      loadSubscriptions,
      handleCancelConfirm,
      handleOverride,
    }),
    [
      loading,
      rows,
      stateFilter,
      planIdFilter,
      cancelTarget,
      cancelling,
      expandedRowId,
      toggleExpand,
      billingHistoryByRow,
      billingLoadingByRow,
      overrideLoading,
      users,
      plans,
      userNameById,
      loadSubscriptions,
      handleCancelConfirm,
      handleOverride,
    ],
  );
}
