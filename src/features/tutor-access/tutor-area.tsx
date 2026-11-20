import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { TutorProfileView } from "./tutor-profile";
import { PasswordChangeForm } from "./password-change-form";
import type { SessionUser } from "./auth-types";
import { RegisteredAnimalsView } from "../registered-animals/registered-animals-view";
import { RegisteredRequestWorkspace } from "../registered-animals/registered-request-workspace";
import type { RequirementBuilder } from "../registered-animals/registered-request-workspace";
import type { TutorRequestFormInput } from "../registered-animals/registered-request-workspace";
import type { ProcedureIntent } from "../registered-animals/procedure-intent";
import { AnimalServiceWorkspace } from "../animal-services/animal-service-workspace";
import type { AnimalServiceSelection } from "../animal-services/animal-service-workspace";
import type { AnimalRecord, AnimalService, AnimalSummary } from "../animal-services/animal-service-types";

enum TutorAreaTab { REQUESTS = "requests", ANIMALS = "animals", PROFILE = "profile", PASSWORD = "password", FORM = "form", SERVICE = "service" }

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

export function TutorArea({ user, intent, onIntentConsumed, onSession, onLogout, renderRequests, renderForm, downloadRecordPdf, createRequirement }: { user: SessionUser; intent?: ProcedureIntent | null; onIntentConsumed: () => void; onSession: (user: SessionUser) => void; onLogout: () => void; renderRequests: (requests: unknown[]) => React.ReactNode; renderForm: (input: TutorRequestFormInput) => React.ReactNode; downloadRecordPdf: (record: AnimalRecord) => Promise<void>; createRequirement: RequirementBuilder }) {
  const [tab, setTab] = useState(intent ? TutorAreaTab.ANIMALS : TutorAreaTab.REQUESTS);
  const [animalId, setAnimalId] = useState<string | undefined>();
  const [serviceSelection, setServiceSelection] = useState<AnimalServiceSelection | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const state = useTutorRequests(tab === TutorAreaTab.REQUESTS);
  const intentKey = intent ? `${intent.municipalityId}:${intent.schedule || ""}:${intent.requestTypeId || ""}` : "";
  useEffect(() => { if (intentKey) setTab(TutorAreaTab.ANIMALS); }, [intentKey]);
  function openForm(id?: string) { setAnimalId(id); setTab(TutorAreaTab.FORM); }
  function openService(animal: AnimalSummary, service: AnimalService) { setServiceSelection({ animal, service }); setTab(TutorAreaTab.SERVICE); }
  return <main className={`tutor-access-shell${tab === TutorAreaTab.FORM ? " tutor-access-shell--form" : ""}`}>
    <header className="tutor-access-header">
      <div><h1 className="tw:m-0 tw:text-2xl">Olá, {user.name}</h1><p className="tw:m-0 tw:text-ui-muted">{user.municipalityName || "Área do tutor"}</p></div>
      <Button variant="outline" onClick={onLogout}>Sair</Button>
    </header>
    <nav className="tutor-access-nav" aria-label="Área do tutor">
      <Button variant="menu" aria-current={tab === TutorAreaTab.ANIMALS || tab === TutorAreaTab.FORM || tab === TutorAreaTab.SERVICE || undefined} onClick={() => setTab(TutorAreaTab.ANIMALS)}>Meus animais</Button>
      <Button variant="menu" aria-current={tab === TutorAreaTab.REQUESTS || undefined} onClick={() => setTab(TutorAreaTab.REQUESTS)}>Minhas solicitações</Button>
      <Button variant="menu" aria-current={tab === TutorAreaTab.PROFILE || undefined} onClick={() => setTab(TutorAreaTab.PROFILE)}>Meu perfil</Button>
      <Button variant="menu" aria-current={tab === TutorAreaTab.PASSWORD || undefined} onClick={() => { setTab(TutorAreaTab.PASSWORD); setPasswordChanged(false); }}>Alterar senha</Button>
    </nav>
    {tab === TutorAreaTab.ANIMALS && <RegisteredAnimalsView key={listVersion} onSelect={openForm} onNew={() => openForm()} onService={openService} />}
    {tab === TutorAreaTab.SERVICE && serviceSelection && <AnimalServiceWorkspace selection={serviceSelection} onBack={() => setTab(TutorAreaTab.ANIMALS)} downloadRecordPdf={downloadRecordPdf} />}
    {tab === TutorAreaTab.FORM && <RegisteredRequestWorkspace key={animalId || "new"} animalId={animalId} municipalityId={user.municipalityId || ""} intent={intent || null} renderForm={renderForm} createRequirement={createRequirement} onBack={() => setTab(TutorAreaTab.ANIMALS)} onComplete={() => { onIntentConsumed(); setListVersion((current) => current + 1); state.retry(); }} />}
    {tab === TutorAreaTab.PROFILE && <TutorProfileView />}
    {tab === TutorAreaTab.PASSWORD && <Card className="tw:p-5">
      <PasswordChangeForm external onChanged={(nextUser) => { onSession(nextUser); setPasswordChanged(true); setTab(TutorAreaTab.REQUESTS); }} onCancel={() => setTab(TutorAreaTab.REQUESTS)} />
    </Card>}
    {tab === TutorAreaTab.REQUESTS && <>
      {passwordChanged && <p role="status">Senha alterada. As sessões anteriores foram encerradas.</p>}
      {state.loading ? <p role="status">Carregando suas solicitações...</p>
        : state.error ? <Card className="tw:grid tw:justify-items-start tw:gap-3 tw:p-5">
          <p className="form-error" role="alert">{state.error}</p>
          <Button variant="outline" onClick={state.retry}>Tentar novamente</Button>
        </Card>
        : state.requests.length ? renderRequests(state.requests)
        : <Card as="section" className="tw:grid tw:gap-2 tw:p-5">
          <h2 className="tw:m-0">Minhas solicitações</h2>
          <p className="tw:m-0">Nenhuma solicitação vinculada a este acesso.</p>
        </Card>}
    </>}
  </main>;
}
