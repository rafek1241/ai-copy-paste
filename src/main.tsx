import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import { ToastProvider } from "./components/ui/toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppProvider } from "./contexts/AppContext";
import { HistoryProvider } from "./contexts/HistoryContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <HistoryProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </HistoryProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
