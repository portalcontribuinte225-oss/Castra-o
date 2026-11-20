import { ConfigField } from "../components/ui";
import type { AnyRecord } from "../types";
import { RequestType, normalizeRequestType } from "../domain";

export function DeathAnalysisSection({ request }: { request: AnyRecord }) {
  const wf = request.workflowData || request.workflow_data || {};
  const deathDate = request.death_date || wf.death_date || "";
  const deathCause = request.death_cause || wf.death_cause || "";

  return (
    <div className="prm-section prm-section--procedure">
      <div className="prm-section-block">
        <p className="prm-section-title">Óbito do animal</p>
        <div className="prm-procedure-fields">
          <ConfigField label="Data do óbito" value={deathDate} readOnly />
          <ConfigField label="Causa mortis" value={deathCause} readOnly placeholder="Não informado" />
        </div>
      </div>
    </div>
  );
}

export function TutorTransferAnalysisSection({ request }: { request: AnyRecord }) {
  const targetTutor = {
    name: request.target_tutor_name || request.targetTutorName || "",
    cpf: request.target_tutor_cpf || request.targetTutorCpf || "",
    phone: request.target_tutor_phone || request.targetTutorPhone || "",
    email: request.target_tutor_email || request.targetTutorEmail || "",
    address: [request.target_tutor_address, request.target_tutor_neighborhood, request.target_tutor_city, request.target_tutor_state]
      .filter(Boolean)
      .join(", "),
  };

  return (
    <div className="prm-section prm-section--procedure">
      <div className="prm-section-block">
        <p className="prm-section-title">Novo tutor</p>
        <div className="prm-procedure-fields">
          <ConfigField label="Nome" value={targetTutor.name} readOnly placeholder="Não informado" />
          <ConfigField label="CPF" value={targetTutor.cpf} readOnly placeholder="Não informado" />
          <ConfigField label="Telefone" value={targetTutor.phone} readOnly placeholder="Não informado" />
          <ConfigField label="E-mail" value={targetTutor.email} readOnly placeholder="Não informado" />
        </div>
        {targetTutor.address && (
          <p className="prm-muted-note">Endereço: {targetTutor.address}</p>
        )}
      </div>
    </div>
  );
}

export function ComplaintAnalysisSection({ request }: { request: AnyRecord }) {
  const wf = request.workflowData || request.workflow_data || {};
  const location = [request.address, request.neighborhood, request.city, request.state, request.cep].filter(Boolean).join(", ");
  const resolutionNote = request.complaintResolutionNote || wf.complaintResolutionNote || "";

  return (
    <div className="prm-section prm-section--procedure">
      <div className="prm-section-block">
        <p className="prm-section-title">Denunciante</p>
        <div className="prm-procedure-fields">
          <ConfigField label="Nome" value={request.tutor || ""} readOnly placeholder="Não informado" />
          <ConfigField label="CPF" value={request.cpf || ""} readOnly placeholder="Não informado" />
          <ConfigField label="Telefone" value={request.phone || ""} readOnly placeholder="Não informado" />
          <ConfigField label="E-mail" value={request.email || ""} readOnly placeholder="Não informado" />
        </div>
        {location && <p className="prm-muted-note">Local da ocorrência: {location}</p>}
      </div>
      <div className="prm-section-block">
        <p className="prm-section-title">Relato</p>
        <p className="prm-muted-note">{request.notes || "Nenhum relato informado."}</p>
      </div>
      {resolutionNote && (
        <div className="prm-section-block">
          <p className="prm-section-title">Conclusão da apuração</p>
          <p className="prm-muted-note">{resolutionNote}</p>
        </div>
      )}
    </div>
  );
}

const SPECIAL_REQUEST_SECTIONS: Record<string, (props: { request: AnyRecord }) => JSX.Element> = {
  [RequestType.ANIMAL_DEATH]: DeathAnalysisSection,
  [RequestType.TUTOR_TRANSFER]: TutorTransferAnalysisSection,
  [RequestType.COMPLAINT]: ComplaintAnalysisSection,
};

export function getSpecialRequestSection(request: AnyRecord) {
  return SPECIAL_REQUEST_SECTIONS[normalizeRequestType(request.request_type || request.type)] || null;
}

export function isSpecialRequestType(request: AnyRecord) {
  return Boolean(getSpecialRequestSection(request));
}

export function specialRequestConfirmLabel(request: AnyRecord) {
  const type = normalizeRequestType(request.request_type || request.type);
  if (type === RequestType.ANIMAL_DEATH) return "Confirmar óbito";
  if (type === RequestType.TUTOR_TRANSFER) return "Confirmar troca de tutor";
  if (type === RequestType.COMPLAINT) return "Deferir";
  return "Confirmar";
}
