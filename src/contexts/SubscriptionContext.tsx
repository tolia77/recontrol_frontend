import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  subscriptionService,
  type SubscriptionContextValue,
  type SubscriptionStatus,
  type SubscriptionUsage,
  type Plan,
} from "src/services/backend/subscriptionService.ts";
import { getErrorMessage } from "src/utils/getErrorMessage";
import { setUsageInvalidationHandler } from "src/utils/usageInvalidationBus.ts";

// Context

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// Hook

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

// Provider

interface SubscriptionProviderProps {
  children: ReactNode;
}

export default function SubscriptionProvider({
  children,
}: SubscriptionProviderProps) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `silent` skips the loading toggle so background refreshes (fired by the
  // usage-invalidation bus after a write) don't flash spinners in UsageCard /
  // PlanCards. The mount fetch and explicit refresh() calls show loading.
  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [statusResult, usageResult, plansResult] = await Promise.allSettled([
        subscriptionService.getStatus().catch((e) => {
          if ((e as { response?: { status?: number } }).response?.status === 404) return null;
          throw e;
        }),
        subscriptionService.getUsage(),
        subscriptionService.getPlans(),
      ]);
      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value);
        setError(null);
      } else {
        setError(getErrorMessage(statusResult.reason));
      }
      if (usageResult.status === "fulfilled") setUsage(usageResult.value);
      if (plansResult.status === "fulfilled") setPlans(plansResult.value);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Keep usage fresh after any successful count-changing mutation, app-wide.
  // Services fire the bus (debounced); we re-fetch silently so proactive gates
  // always read a current count without a page reload.
  useEffect(() => {
    setUsageInvalidationHandler(() => {
      void fetchAll({ silent: true });
    });
    return () => setUsageInvalidationHandler(null);
  }, [fetchAll]);

  return (
    <SubscriptionContext.Provider
      value={{ status, usage, plans, loading, error, refresh: fetchAll }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
