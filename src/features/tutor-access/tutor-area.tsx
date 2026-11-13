import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { TutorProfileView } from "./tutor-profile";
import { PasswordChangeForm } from "./password-change-form";
import type { SessionUser } from "./auth-types";

function useTutorRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    api.getRequests().then((rows) => { if (!cancelled) setRequests(rows); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar suas solicitações."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);
  return { requests, loading, error, retry: () => setAttempt((current) => current + 1) };
}

export function TutorArea({ user, onSession, onLogout, renderRequests }: { user: SessionUser; onSession: (user: SessionUser) => void; onLogout: () => void; renderRequests: (requests: unknown[]) => React.ReactNode }) {
  const [tab, setTab] = useState("requests");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const state = useTutorRequests();
  return <main className="tutor-access-shell">
    <header className="tutor-access-header"><div><h1>Olá, {user.name}</h1><p>{user.municipalityName || "Área do tutor"}</p></div><button type="button" className="ghost-button" onClick={onLogout}>Sair</button></header>
    <nav className="tutor-access-nav" aria-label="Área do tutor"><button type="button" className="ghost-button" aria-current={tab === "requests" ? "page" : undefined} onClick={() => setTab("requests")}>Minhas solicitações</button><button type="button" className="ghost-button" aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}>Meu perfil</button><button type="button" className="ghost-button" aria-current={tab === "password" ? "page" : undefined} onClick={() => { setTab("password"); setPasswordChanged(false); }}>Alterar senha</button></nav>
    {tab === "profile" && <TutorProfileView />}
    {tab === "password" && <div className="panel"><PasswordChangeForm onChanged={(nextUser) => { onSession(nextUser); setPasswordChanged(true); setTab("requests"); }} onCancel={() => setTab("requests")} /></div>}
    {tab === "requests" && <>{passwordChanged && <p role="status">Senha alterada. As sessões anteriores foram encerradas.</p>}{state.loading ? <p role="status">Carregando suas solicitações...</p> : state.error ? <div><p className="form-error" role="alert">{state.error}</p><button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></div> : state.requests.length ? renderRequests(state.requests) : <section className="panel"><h2>Minhas solicitações</h2><p>Nenhuma solicitação vinculada a este acesso.</p></section>}</>}
  </main>;
}
