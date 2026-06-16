import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// NOTE: `toasts` (the live list) is intentionally NOT part of the context value.
// It changes on every show/dismiss; if it were in the value object, useToast()
// would return a new reference whenever a toast appears, churning the identity of
// every consumer's `toast` — which turns any `useCallback`/`useEffect` that lists
// `toast` in its deps into a refetch/re-render loop on the error path. The live
// list is passed to ToastContainer via props instead; the context exposes only the
// stable action methods, memoized once below.
interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  const success = useCallback(
    (message: string) => addToast("success", message),
    [addToast],
  );
  const error = useCallback(
    (message: string) => addToast("error", message),
    [addToast],
  );
  const info = useCallback(
    (message: string) => addToast("info", message),
    [addToast],
  );
  const warning = useCallback(
    (message: string) => addToast("warning", message),
    [addToast],
  );

  // Stable value: every method is a stable useCallback, so this object is created
  // once and never changes identity — consumers' `toast` ref stays constant.
  const value = useMemo(
    () => ({ addToast, removeToast, success, error, info, warning }),
    [addToast, removeToast, success, error, info, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-success text-white",
  error: "bg-destructive text-white",
  info: "bg-primary text-white",
  warning: "bg-warning text-white",
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeStyles[toast.type]} animate-slide-in flex items-start gap-3 rounded-md px-4 py-3 shadow-overlay`}
          role="alert"
        >
          <span className="text-lg leading-none">{typeIcons[toast.type]}</span>
          <p className="flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 transition-colors hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastProvider;
