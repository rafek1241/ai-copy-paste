import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({ open = false, onOpenChange, children }: AlertDialogProps) {
  const value = React.useMemo(
    () => ({ open, onOpenChange: onOpenChange || (() => {}) }),
    [open, onOpenChange]
  );

  return (
    <AlertDialogContext.Provider value={value}>
      {children}
    </AlertDialogContext.Provider>
  );
}

function useAlertDialogContext() {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog components must be used within an AlertDialog");
  }
  return context;
}

interface AlertDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function AlertDialogTrigger({ children, asChild }: AlertDialogTriggerProps) {
  const { onOpenChange } = useAlertDialogContext();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)}>
      {children}
    </button>
  );
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  const { open } = useAlertDialogContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Handle escape key - but don't close, it's an alert dialog
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault(); // Prevent closing on escape for alert dialogs
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus trap and restoration
  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement;
    contentRef.current?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
    >
      {/* Backdrop - no click to close for alert dialogs */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Content */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          "relative z-50 w-full max-w-md bg-card-dark border border-border-dark rounded-lg shadow-xl",
          "animate-in fade-in zoom-in-95 duration-200",
          "focus:outline-none",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogHeader({ children, className }: AlertDialogHeaderProps) {
  return (
    <div className={cn("p-4 space-y-2", className)}>
      {children}
    </div>
  );
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogTitle({ children, className }: AlertDialogTitleProps) {
  return (
    <h2 className={cn("text-sm font-bold text-white flex items-center gap-2", className)}>
      {children}
    </h2>
  );
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogDescription({ children, className }: AlertDialogDescriptionProps) {
  return (
    <p className={cn("text-xs text-white/60", className)}>
      {children}
    </p>
  );
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogFooter({ children, className }: AlertDialogFooterProps) {
  return (
    <div className={cn("flex justify-end gap-2 p-4 border-t border-border-dark", className)}>
      {children}
    </div>
  );
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}

export function AlertDialogAction({
  children,
  variant = "default",
  className,
  ...props
}: AlertDialogActionProps) {
  const { onOpenChange } = useAlertDialogContext();

  return (
    <button
      type="button"
      className={cn(
        "px-4 h-8 rounded text-xs font-bold transition-all",
        variant === "destructive"
          ? "bg-red-500 hover:bg-red-600 text-white"
          : "bg-primary hover:bg-primary/90 text-white",
        className
      )}
      onClick={(e) => {
        props.onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AlertDialogCancel({ children, className, ...props }: AlertDialogCancelProps) {
  const { onOpenChange } = useAlertDialogContext();

  return (
    <button
      type="button"
      className={cn(
        "px-4 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-bold text-white/70 transition-all",
        className
      )}
      onClick={(e) => {
        props.onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// Convenience hook for using confirm dialogs
interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  resolve: ((value: boolean) => void) | null;
}

export function useConfirmDialog() {
  const [state, setState] = React.useState<ConfirmState>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const confirm = React.useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const ConfirmDialog = React.useCallback(() => {
    if (!state.options) return null;

    return (
      <AlertDialog
        open={state.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state.options.variant === "destructive" && (
                <AlertTriangle size={16} className="text-red-500" aria-hidden="true" />
              )}
              {state.options.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state.options.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {state.options.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={state.options.variant}
              onClick={handleConfirm}
            >
              {state.options.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}
