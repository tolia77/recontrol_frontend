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

// ── Context ───────────────────────────────────────────────────────────────────

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

// ── Provider ──────────────────────────────────────────────────────────────────

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

  const fetchAll = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <SubscriptionContext.Provider
      value={{ status, usage, plans, loading, error, refresh: fetchAll }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
