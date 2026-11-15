import React from "react";
import { InfoTile, StatusBadge } from "../../components/ui";
import { requestTypeLabel } from "../../domain";
import { formatDateTime } from "../../utils";
import type { TrackedRequest } from "./tracking-types";

const when = (value: string | null) => (value ? formatDateTime(value) : "");

export function TrackedRequestView({ request, loading, error, onRefresh, onClose }: { request: TrackedRequest; loading: boolean; error: string; onRefresh: () => void; onClose: () => void }) {
  const { documents, schedule } = request;
  return <section className="panel">
    <h2>Solicitação #{request.protocol}</h2>
    <p><StatusBadge status={request.status} /></p>
    <div className="prontuario-grid">
      <InfoTile label="Tipo" value={requestTypeLabel({ request_type: request.requestType })} />
      <InfoTile label="Aberta em" value={when(request.createdAt)} />
      <InfoTile label="Última atualização" value={when(request.updatedAt)} />
      <InfoTile label="Agendamento" value={schedule ? schedule.date : "Sem agenda"} />
      {schedule?.locationName && <InfoTile label="Local" value={schedule.locationName} />}
      {schedule?.address && <InfoTile label="Endereço do local" value={schedule.address} />}
    </div>
    <h3>Documentos</h3>
    {documents.total === 0
      ? <p>Nenhum documento enviado.</p>
      : <ul>
        <li>{documents.approved} aprovado(s)</li>
        <li>{documents.needsCorrection} precisa(m) de correção</li>
        <li>{documents.pending} em análise</li>
      </ul>}
    <p className="whatsapp-note">Por segurança, esta tela mostra apenas a situação da solicitação. Dados pessoais e arquivos não são exibidos.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="svc-modal-footer">
      <button type="button" className="ghost-button" onClick={onClose}>Nova consulta</button>
      <button type="button" className="primary-action" onClick={onRefresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
    </div>
  </section>;
}
