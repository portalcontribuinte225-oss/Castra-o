import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, SESSION_INVALID_EVENT } from "../../api";
import { GLOBAL_MUNICIPALITY_FILTER_KEY } from "../../domain";
import type { SessionUser } from "./auth-types";

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
  const generation = useRef(0);
  const logout = useCallback(() => {
    generation.current += 1;
    forgetBrowserSession();
    setUser(null);
    setReady(true);
    setError("");
  }, []);
  const accept = useCallback((value: SessionUser | null) => {
    if (!value) { logout(); return; }
    generation.current += 1;
    localStorage.removeItem("castragestao:user");
    setUser(value);
    setReady(true);
    setError("");
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    const version = ++generation.current;
    localStorage.removeItem("castragestao:user");
    setReady(false);
    setError("");
    if (!api.hasToken()) { setReady(true); return; }
    api.getSession().then((session) => {
      if (cancelled || version !== generation.current) return;
      setUser(session.user);
      setReady(true);
    }).catch((failure: unknown) => {
      if (cancelled || version !== generation.current) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) logout();
      else setError("Não foi possível validar sua sessão. Tente novamente ou saia para entrar de novo.");
    });
    return () => { cancelled = true; };
  }, [attempt, logout]);

  useEffect(() => {
    window.addEventListener(SESSION_INVALID_EVENT, logout);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, logout);
  }, [logout]);

  return { user, ready, error, accept, logout, retry: () => setAttempt((current) => current + 1) };
}
