import { useEffect, useMemo, useState } from "react";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";

export function useUpdatePresentationState() {
  const {
    updateInfo,
    status,
    progress,
    error,
    updateNow,
    updateOnExit,
    dismissError,
  } = useUpdateCheck();

  const [showUpdateView, setShowUpdateView] = useState(true);

  useEffect(() => {
    if (status !== "scheduled") {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowUpdateView(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [status]);

  const shouldShowUpdateView = useMemo(
    () => Boolean(updateInfo && showUpdateView && status !== "idle" && status !== "checking"),
    [showUpdateView, status, updateInfo]
  );

  return {
    updateInfo,
    status,
    progress,
    error,
    updateNow,
    updateOnExit,
    dismissError,
    shouldShowUpdateView,
  };
}
