import { displayScheduleDate } from "../../../shared/schedule-contract.js";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { InfoTile, StatusBadge } from "../../components/ui";
import { requestTypeLabel } from "../../domain";
import { formatDateTime } from "../../utils";
import { useRequirementDownload } from "../request-requester/use-requirement-download";
import type { AccessedRequest } from "./access-types";

const when = (value: string | null) => (value ? formatDateTime(value) : "");

// One of the tutor's requests: where it stands, its visit, how its documents were reviewed and the request document to download.
// No file and no review reason is shown.
export function AccessedRequestCard({ request, createRequirement }: { request: AccessedRequest; createRequirement: () => Promise<string> }) {
  const { documents } = request;
  return <Card as="section" className="tw:grid tw:gap-3 tw:p-4 tw:sm:p-6" aria-label={`Solicitação ${request.protocol}`}>
    <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Solicitação {request.protocol}</h3>
    <p><StatusBadge status={request.status} /></p>
    <div className="prontuario-grid">
      <InfoTile label="Tipo" value={requestTypeLabel({ request_type: request.request_type })} />
      <InfoTile label="Aberta em" value={when(request.created_at)} />
      <InfoTile label="Última atualização" value={when(request.updated_at)} />
      <InfoTile label="Agendamento" value={displayScheduleDate(request.schedule_date) || "Sem agenda"} />
      {request.schedule_location_name && <InfoTile label="Local" value={request.schedule_location_name} />}
      {request.schedule_address && <InfoTile label="Endereço do local" value={request.schedule_address} />}
    </div>
    <h4 className="tw:m-0 tw:text-base tw:font-semibold">Documentos</h4>
    {documents.total === 0
      ? <p>Nenhum documento enviado.</p>
      : <ul>
        <li>{documents.approved} aprovado(s)</li>
        <li>{documents.needsCorrection} precisa(m) de correção</li>
        <li>{documents.pending} em análise</li>
      </ul>}
    <RequirementDownload protocol={request.protocol} createRequirement={createRequirement} />
  </Card>;
}

function RequirementDownload({ protocol, createRequirement }: { protocol: string; createRequirement: () => Promise<string> }) {
  const requirement = useRequirementDownload(createRequirement, protocol);
  return <>
    <p>Baixe o requerimento da solicitação, com os dados que você informou.</p>
    <Button variant="outline" className="tw:justify-self-start" onClick={requirement.download} disabled={requirement.downloading}>{requirement.downloading ? "Gerando..." : "Baixar requerimento"}</Button>
    {requirement.error && <p className="form-error" role="alert">{requirement.error}</p>}
  </>;
}
