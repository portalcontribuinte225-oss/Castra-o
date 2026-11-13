import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { TutorProfileView } from "./tutor-profile";
import { PasswordChangeForm } from "./password-change-form";
import type { SessionUser } from "./auth-types";
import { RegisteredAnimalsView } from "../registered-animals/registered-animals-view";
import { RegisteredRequestWorkspace } from "../registered-animals/registered-request-workspace";
import type { TutorRequestFormInput } from "../registered-animals/registered-request-workspace";
import type { ProcedureIntent } from "../registered-animals/procedure-intent";

enum TutorAreaTab { REQUESTS = "requests", ANIMALS = "animals", PROFILE = "profile", PASSWORD = "password", FORM = "form" }

function useTutorRequests(enabled: boolean) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true); setError("");
    api.getRequests().then((rows) => { if (!cancelled) setRequests(rows); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar suas solicitações."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt, enabled]);
  return { requests, loading, error, retry: () => setAttempt((current) => current + 1) };
}

export function TutorArea({ user, intent, onIntentConsumed, onSession, onLogout, renderRequests, renderForm }: { user: SessionUser; intent?: ProcedureIntent | null; onIntentConsumed: () => void; onSession: (user: SessionUser) => void; onLogout: () => void; renderRequests: (requests: unknown[]) => React.ReactNode; renderForm: (input: TutorRequestFormInput) => React.ReactNode }) {
  const [tab, setTab] = useState(intent ? TutorAreaTab.ANIMALS : TutorAreaTab.REQUESTS);
  const [animalId, setAnimalId] = useState<string | undefined>();
  const [listVersion, setListVersion] = useState(0);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const state = useTutorRequests(tab === TutorAreaTab.REQUESTS);
  const intentKey = intent ? `${intent.municipalityId}:${intent.schedule || ""}:${intent.requestTypeId || ""}` : "";
  useEffect(() => { if (intentKey) setTab(TutorAreaTab.ANIMALS); }, [intentKey]);
  function openForm(id?: string) { setAnimalId(id); setTab(TutorAreaTab.FORM); }
  return <main className="tutor-access-shell">
    <header className="tutor-access-header"><div><h1>Olá, {user.name}</h1><p>{user.municipalityName || "Área do tutor"}</p></div><button type="button" className="ghost-button" onClick={onLogout}>Sair</button></header>
    <nav className="tutor-access-nav" aria-label="Área do tutor"><button type="button" className="ghost-button" aria-current={tab === TutorAreaTab.ANIMALS ? "page" : undefined} onClick={() => setTab(TutorAreaTab.ANIMALS)}>Meus animais</button><button type="button" className="ghost-button" aria-current={tab === TutorAreaTab.REQUESTS ? "page" : undefined} onClick={() => setTab(TutorAreaTab.REQUESTS)}>Minhas solicitações</button><button type="button" className="ghost-button" aria-current={tab === TutorAreaTab.PROFILE ? "page" : undefined} onClick={() => setTab(TutorAreaTab.PROFILE)}>Meu perfil</button><button type="button" className="ghost-button" aria-current={tab === TutorAreaTab.PASSWORD ? "page" : undefined} onClick={() => { setTab(TutorAreaTab.PASSWORD); setPasswordChanged(false); }}>Alterar senha</button></nav>
    {tab === TutorAreaTab.ANIMALS && <RegisteredAnimalsView key={listVersion} onSelect={openForm} onNew={() => openForm()} />}
    {tab === TutorAreaTab.FORM && <RegisteredRequestWorkspace key={animalId || "new"} animalId={animalId} municipalityId={user.municipalityId || ""} intent={intent || null} renderForm={renderForm} onBack={() => setTab(TutorAreaTab.ANIMALS)} onComplete={() => { onIntentConsumed(); setListVersion((current) => current + 1); state.retry(); }} />}
    {tab === TutorAreaTab.PROFILE && <TutorProfileView />}
    {tab === TutorAreaTab.PASSWORD && <div className="panel"><PasswordChangeForm onChanged={(nextUser) => { onSession(nextUser); setPasswordChanged(true); setTab(TutorAreaTab.REQUESTS); }} onCancel={() => setTab(TutorAreaTab.REQUESTS)} /></div>}
    {tab === TutorAreaTab.REQUESTS && <>{passwordChanged && <p role="status">Senha alterada. As sessões anteriores foram encerradas.</p>}{state.loading ? <p role="status">Carregando suas solicitações...</p> : state.error ? <div><p className="form-error" role="alert">{state.error}</p><button type="button" className="ghost-button" onClick={state.retry}>Tentar novamente</button></div> : state.requests.length ? renderRequests(state.requests) : <section className="panel"><h2>Minhas solicitações</h2><p>Nenhuma solicitação vinculada a este acesso.</p></section>}</>}
  </main>;
}
