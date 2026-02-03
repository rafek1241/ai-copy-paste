import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error caught by boundary:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center h-full p-8 bg-background-dark"
          role="alert"
        >
          <div className="max-w-md text-center space-y-4">
            <div className="size-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-500" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Something went wrong</h2>
              <p className="text-sm text-white/60">
                An unexpected error occurred. Please try again.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left">
                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-black/40 border border-border-dark rounded text-xs text-red-400 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to trigger error boundary
export function useErrorHandler() {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// Simple wrapper for suspense-like error handling
interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export function AsyncBoundary({
  children,
  fallback,
  loadingFallback,
  onError,
}: AsyncBoundaryProps): React.ReactElement {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <React.Suspense fallback={loadingFallback || <DefaultLoadingFallback />}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-background-dark">
      <div className="flex items-center gap-2 text-white/40">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wider">Loading...</span>
      </div>
    </div>
  );
}
