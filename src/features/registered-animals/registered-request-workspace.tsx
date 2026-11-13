import React, { useState } from "react";
import { useRequestOptions } from "./use-request-options";
import { useRegisteredContext } from "./use-registered-context";
import type { RegisteredRequestContext } from "./registered-animal-types";
import type { ProcedureIntent } from "./procedure-intent";

export interface TutorRequestFormInput {
  options: Record<string, unknown>;
  context?: RegisteredRequestContext;
  contextLoading: boolean;
  requestTypeId: string;
  onRequestTypeChange?: (id: string) => void;
  intent: ProcedureIntent | null;
  onBack: () => void;
  onDone: (request: { protocol?: string }) => void;
}

export function RegisteredRequestWorkspace({ animalId, municipalityId, intent, onBack, onComplete, renderForm }: { animalId?: string; municipalityId: string; intent: ProcedureIntent | null; onBack: () => void; onComplete: () => void; renderForm: (input: TutorRequestFormInput) => React.ReactNode }) {
  const options = useRequestOptions(municipalityId);
  const [requestTypeId, setRequestTypeId] = useState(intent?.requestTypeId || "");
  const [created, setCreated] = useState<{ protocol?: string } | null>(null);
  const context = useRegisteredContext(animalId || "", requestTypeId);
  if (created) return <section className="panel"><h2>Solicitação enviada</h2><p>Protocolo: <strong>{created.protocol}</strong></p><button type="button" className="primary-action" onClick={() => { onComplete(); onBack(); }}>Voltar aos meus animais</button></section>;
  if (options.loading || (animalId && !context.context && !context.error)) return <p role="status">Preparando a solicitação...</p>;
  if (options.error || (animalId && context.error && !context.context)) return <section className="panel"><p className="form-error" role="alert">{options.error || context.error}</p><button type="button" className="ghost-button" onClick={() => { options.retry(); context.retry(); }}>Tentar novamente</button><button type="button" className="ghost-button" onClick={onBack}>Voltar aos meus animais</button></section>;
  return <>{context.error && <div role="alert"><p className="form-error">{context.error}</p><button type="button" className="ghost-button" onClick={context.retry}>Tentar novamente</button></div>}{renderForm({ options: options.options, context: animalId ? context.context || undefined : undefined, contextLoading: Boolean(animalId) && !context.ready, requestTypeId, onRequestTypeChange: animalId ? setRequestTypeId : undefined, intent, onBack, onDone: (request) => setCreated({ protocol: request.protocol }) })}</>;
}
