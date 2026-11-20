import React, { useState } from "react";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { RequestDoneCard } from "../request-requester/request-done-card";
import { MUNICIPALITY_OPTION, useRequestOptions } from "./use-request-options";
import { useRegisteredContext } from "./use-registered-context";
import type { RegisteredRequestContext } from "./registered-animal-types";
import type { ProcedureIntent } from "./procedure-intent";

// The request as the form hands it over when it is done: what the last screen shows and what the request document is made from.
export interface CreatedRequest {
  protocol?: string;
  workflowData?: { followUp?: { enabled: boolean; email?: string; phone?: string } };
  workflow_data?: { followUp?: { enabled: boolean; email?: string; phone?: string } };
}

// Makes the request document (a PDF, as a data URL) of a request, for its municipality.
export type RequirementBuilder = (request: CreatedRequest, municipality: unknown) => Promise<string>;

export interface TutorRequestFormInput {
  options: Record<string, unknown>;
  context?: RegisteredRequestContext;
  contextLoading: boolean;
  requestTypeId: string;
  onRequestTypeChange?: (id: string) => void;
  intent: ProcedureIntent | null;
  onBack: () => void;
  onDone: (request: CreatedRequest) => void;
}

export function RegisteredRequestWorkspace({ animalId, municipalityId, intent, onBack, onComplete, renderForm, createRequirement }: { animalId?: string; municipalityId: string; intent: ProcedureIntent | null; onBack: () => void; onComplete: () => void; renderForm: (input: TutorRequestFormInput) => React.ReactNode; createRequirement: RequirementBuilder }) {
  const options = useRequestOptions(municipalityId);
  const [requestTypeId, setRequestTypeId] = useState(intent?.requestTypeId || "");
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const context = useRegisteredContext(animalId || "", requestTypeId);
  if (created) return <RequestDoneCard protocol={created.protocol || ""} followUp={(created.workflow_data || created.workflowData)?.followUp} createRequirement={() => createRequirement(created, options.options[MUNICIPALITY_OPTION])} closeLabel="Voltar aos meus animais" onClose={() => { onComplete(); onBack(); }} />;
  if (options.loading || (animalId && !context.context && !context.error)) return <p role="status">Preparando a solicitação...</p>;
  if (options.error || (animalId && context.error && !context.context)) return <Card as="section" className="tw:grid tw:gap-3 tw:p-5">
    <p className="form-error" role="alert">{options.error || context.error}</p>
    <div className="tw:flex tw:flex-wrap tw:gap-2">
      <Button variant="outline" onClick={() => { options.retry(); context.retry(); }}>Tentar novamente</Button>
      <Button variant="outline" onClick={onBack}>Voltar aos meus animais</Button>
    </div>
  </Card>;
  return <>
    {context.error && <div>
      <p className="form-error" role="alert">{context.error}</p>
      <Button variant="outline" onClick={context.retry}>Tentar novamente</Button>
    </div>}
    {renderForm({ options: options.options, context: animalId ? context.context || undefined : undefined, contextLoading: Boolean(animalId) && !context.ready, requestTypeId, onRequestTypeChange: animalId ? setRequestTypeId : undefined, intent, onBack, onDone: setCreated })}
  </>;
}
