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
} from "src/services/backend/subscriptionService.ts";
import { getErrorMessage } from "src/utils/getErrorMessage";

// ── Context ───────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscriptionService.getStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        // 404 = user has never subscribed — valid Free state, not an error
        setStatus(null);
        setError(null);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <SubscriptionContext.Provider
      value={{ status, loading, error, refresh: fetchStatus }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
