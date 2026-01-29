import * as React from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastStateContext = React.createContext<ToastState | null>(null);
const ToastActionsContext = React.createContext<ToastActions | null>(null);

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (message: string, variant: ToastVariant = "default", duration: number = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = React.useCallback(
    (message: string, duration?: number) => addToast(message, "success", duration),
    [addToast]
  );

  const error = React.useCallback(
    (message: string, duration?: number) => addToast(message, "error", duration),
    [addToast]
  );

  const warning = React.useCallback(
    (message: string, duration?: number) => addToast(message, "warning", duration),
    [addToast]
  );

  const info = React.useCallback(
    (message: string, duration?: number) => addToast(message, "info", duration),
    [addToast]
  );

  const actions = React.useMemo(
    () => ({ addToast, removeToast, success, error, warning, info }),
    [addToast, removeToast, success, error, warning, info]
  );

  const state = React.useMemo(() => ({ toasts }), [toasts]);

  return (
    <ToastStateContext.Provider value={state}>
      <ToastActionsContext.Provider value={actions}>
        {children}
        <ToastContainer />
      </ToastActionsContext.Provider>
    </ToastStateContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastActionsContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function useToastState() {
  const context = React.useContext(ToastStateContext);
  if (!context) {
    throw new Error("useToastState must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer() {
  const { toasts } = useToastState();

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
}

function ToastItem({ toast }: ToastItemProps) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      setIsExiting(true);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration]);

  React.useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isExiting, toast.id, removeToast]);

  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-card-dark border-border-dark text-white",
    success: "bg-green-600/90 border-green-500/50 text-white",
    error: "bg-red-600/90 border-red-500/50 text-white",
    warning: "bg-yellow-600/90 border-yellow-500/50 text-white",
    info: "bg-blue-600/90 border-blue-500/50 text-white",
  };

  const icons: Record<ToastVariant, string> = {
    default: "info",
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg",
        "min-w-[200px] max-w-[400px]",
        variantStyles[toast.variant],
        isExiting
          ? "animate-out fade-out slide-out-to-right duration-200"
          : "animate-in fade-in slide-in-from-right duration-200"
      )}
      role="alert"
    >
      <span className="material-symbols-outlined text-base flex-shrink-0">
        {icons[toast.variant]}
      </span>
      <span className="text-xs font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => setIsExiting(true)}
        className="flex-shrink-0 p-0.5 hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <span className="material-symbols-outlined text-sm opacity-70 hover:opacity-100">
          close
        </span>
      </button>
    </div>
  );
}
