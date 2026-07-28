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
          <label className="field">
            <span>Data do óbito</span>
            <input value={deathDate} readOnly />
          </label>
          <label className="field">
            <span>Causa mortis</span>
            <input value={deathCause} readOnly placeholder="Não informado" />
          </label>
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
          <label className="field">
            <span>Nome</span>
            <input value={targetTutor.name} readOnly placeholder="Não informado" />
          </label>
          <label className="field">
            <span>CPF</span>
            <input value={targetTutor.cpf} readOnly placeholder="Não informado" />
          </label>
          <label className="field">
            <span>Telefone</span>
            <input value={targetTutor.phone} readOnly placeholder="Não informado" />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input value={targetTutor.email} readOnly placeholder="Não informado" />
          </label>
        </div>
        {targetTutor.address && (
          <p className="prm-muted-note">Endereço: {targetTutor.address}</p>
        )}
      </div>
    </div>
  );
}

const SPECIAL_REQUEST_SECTIONS: Record<string, (props: { request: AnyRecord }) => JSX.Element> = {
  [RequestType.ANIMAL_DEATH]: DeathAnalysisSection,
  [RequestType.TUTOR_TRANSFER]: TutorTransferAnalysisSection,
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
  return "Confirmar";
}
