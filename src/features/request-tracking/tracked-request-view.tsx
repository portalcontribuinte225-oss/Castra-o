import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { InfoTile, StatusBadge } from "../../components/ui";
import { requestTypeLabel } from "../../domain";
import { formatDateTime } from "../../utils";
import type { TrackedRequest } from "./tracking-types";

const when = (value: string | null) => (value ? formatDateTime(value) : "");

export function TrackedRequestView({ request, loading, error, onRefresh, onClose }: { request: TrackedRequest; loading: boolean; error: string; onRefresh: () => void; onClose: () => void }) {
  const { documents, schedule } = request;
  return <Card as="section" className="tw:grid tw:gap-3 tw:p-4 tw:sm:p-6" aria-label="Situação da solicitação" aria-busy={loading}>
    <h3 className="tw:m-0 tw:text-lg tw:font-semibold">Solicitação #{request.protocol}</h3>
    <p><StatusBadge status={request.status} /></p>
    <div className="prontuario-grid">
      <InfoTile label="Tipo" value={requestTypeLabel({ request_type: request.requestType })} />
      <InfoTile label="Aberta em" value={when(request.createdAt)} />
      <InfoTile label="Última atualização" value={when(request.updatedAt)} />
      <InfoTile label="Agendamento" value={schedule ? schedule.date : "Sem agenda"} />
      {schedule?.locationName && <InfoTile label="Local" value={schedule.locationName} />}
      {schedule?.address && <InfoTile label="Endereço do local" value={schedule.address} />}
    </div>
    <h4 className="tw:m-0 tw:text-base tw:font-semibold">Documentos</h4>
    {documents.total === 0
      ? <p>Nenhum documento enviado.</p>
      : <ul>
        <li>{documents.approved} aprovado(s)</li>
        <li>{documents.needsCorrection} precisa(m) de correção</li>
        <li>{documents.pending} em análise</li>
      </ul>}
    <p className="whatsapp-note">Por segurança, esta tela mostra apenas a situação da solicitação. Dados pessoais e arquivos não são exibidos.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="tw:flex tw:flex-wrap tw:gap-2">
      <Button variant="outline" onClick={onClose}>Nova consulta</Button>
      <Button onClick={onRefresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</Button>
    </div>
  </Card>;
}
