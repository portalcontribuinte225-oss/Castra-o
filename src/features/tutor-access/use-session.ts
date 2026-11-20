import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, isInvalidSession, SESSION_INVALID_EVENT } from "../../api";
import { GLOBAL_MUNICIPALITY_FILTER_KEY } from "../../domain";
import type { SessionUser } from "./auth-types";

const MAX_RETRY_DELAY = 30_000;
const SESSION_RETRY_DELAYS = [1000, 3000, 8000, 18_000, MAX_RETRY_DELAY];

export async function restoreBrowserSession(signal: AbortSignal, onRetry: () => void) {
  for (const delay of SESSION_RETRY_DELAYS) {
    signal.throwIfAborted();
    try {
      return await api.getSession({ signal });
    } catch (failure) {
      signal.throwIfAborted();
      if (isInvalidSession(failure)) throw failure;
      const temporary = failure instanceof ApiError ? failure.status >= 500 || [401, 403, 408, 429].includes(failure.status)
        : failure instanceof TypeError || failure instanceof SyntaxError;
      if (!temporary) throw failure;

      const retryAfter = failure instanceof ApiError ? failure.retryAfter * 1000 : 0;
      if (retryAfter > MAX_RETRY_DELAY) throw failure;
      onRetry();
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, Math.max(delay, retryAfter));
        signal.addEventListener("abort", finish, { once: true });
      });
    }
  }
  signal.throwIfAborted();
  return api.getSession({ signal });
}

// What the browser keeps of a session besides the token: the old cached user and the global administration's municipality choice.
export function forgetBrowserSession() {
  api.logout();
  localStorage.removeItem("castragestao:user");
  localStorage.removeItem(GLOBAL_MUNICIPALITY_FILTER_KEY);
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const validation = useRef<AbortController | null>(null);
  const logout = useCallback(() => {
    validation.current?.abort();
    forgetBrowserSession();
    setUser(null);
    setReady(true);
    setError("");
  }, []);
  const accept = useCallback((value: SessionUser | null) => {
    if (!value) { logout(); return; }
    validation.current?.abort();
    localStorage.removeItem("castragestao:user");
    setUser(value);
    setReady(true);
    setError("");
  }, [logout]);
  const retry = useCallback(() => {
    validation.current?.abort();
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    localStorage.removeItem("castragestao:user");
    setReady(false);
    setError("");
    if (!api.hasToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    const controller = new AbortController();
    validation.current = controller;
    restoreBrowserSession(controller.signal, () => {
      setError("Conexão temporariamente indisponível. Sua sessão continua salva. Tentando novamente...");
    }).then((session) => {
      if (controller.signal.aborted) return;
      setUser(session.user);
      setReady(true);
      setError("");
    }).catch(() => {
      if (controller.signal.aborted) return;
      setError("Não foi possível validar sua sessão. Sua sessão continua salva. Tente novamente.");
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    window.addEventListener(SESSION_INVALID_EVENT, logout);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, logout);
  }, [logout]);

  return { user, ready, error, accept, logout, retry };
}
