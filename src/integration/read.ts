import { useEffect, useState } from "react";
import { apiRequest, errorMessage } from "./http";

export function useRead<T>(endpoint: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    endpoint: string;
    data?: T;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    apiRequest<T>(endpoint, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ endpoint, data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({ endpoint, error: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [endpoint, attempt]);
  const current = result?.endpoint === endpoint ? result : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(endpoint && !current),
    refresh: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
