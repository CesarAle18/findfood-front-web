import { useEffect, useRef, useState } from "react";
import { apiRequest, errorMessage } from "./http";

export function useRead<T>(endpoint: string | null, pollMs = 0, load?: (endpoint: string, signal: AbortSignal) => Promise<T>) {
  const pending = useRef<AbortController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    endpoint: string;
    data?: T;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (pending.current === controller) pending.current = null;
      setResult({ endpoint, error: "La consulta tardó demasiado. Intenta nuevamente." });
    }, 30000);
    (load ? load(endpoint, controller.signal) : apiRequest<T>(endpoint, { signal: controller.signal })).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ endpoint, data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({ endpoint, error: errorMessage(error) });
      },
    ).finally(() => {
      window.clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [endpoint, attempt, load]);
  useEffect(() => {
    const refresh = () => {
      setAttempt((n) => n + 1);
    };
    window.addEventListener("findfood:data-changed", refresh);
    return () => window.removeEventListener("findfood:data-changed", refresh);
  }, []);
  useEffect(() => {
    if (!endpoint || !pollMs) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !pending.current) setAttempt((n) => n + 1);
    };
    const timer = window.setInterval(refresh, pollMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [endpoint, pollMs]);
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
