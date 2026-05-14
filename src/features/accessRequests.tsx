import { useState } from "react";
import { CheckCircle2, ClipboardList, X } from "lucide-react";
import type { AnyRecord } from "../types";
import { initialTeams } from "../domain";
import { normalizeText } from "../utils";
import { EmptyState, Metric, ModalHeader, PanelHeader } from "../components/ui";

export function accessStatusLabel(status = "") {
  return {
    PENDENTE: "Pendente",
    APROVADO: "Aprovado",
    RECUSADO: "Recusado",
  }[status] || status || "Pendente";
}

export function AccessRequestsView({ accessRequests = [], reviewAccessRequest, teams = initialTeams }: AnyRecord) {
  const [filter, setFilter] = useState("PENDENTE");
  const [reviewing, setReviewing] = useState<AnyRecord | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [status, setStatus] = useState("");
  const filtered = accessRequests.filter((item) => filter === "TODOS" || item.status === filter);
  const pendingCount = accessRequests.filter((item) => item.status === "PENDENTE").length;
  const approvedCount = accessRequests.filter((item) => item.status === "APROVADO").length;
  const rejectedCount = accessRequests.filter((item) => item.status === "RECUSADO").length;

  async function decide(decision: string) {
    if (!reviewing) return;
    setStatus("Registrando decisão...");
    try {
      const updated = await reviewAccessRequest?.(reviewing.id, { status: decision, review_note: reviewNote });
      setStatus(decision === "APROVADO" && updated?.temporaryPassword
        ? `Acesso aprovado. Senha inicial: ${updated.temporaryPassword}`
        : "Decisão registrada.");
      setReviewing(null);
      setReviewNote("");
    } catch (err: any) {
      setStatus(err.message || "Não foi possível revisar o credenciamento.");
    }
  }

  return (
    <section className="workspace">
      <div className="metrics-grid access-metrics-grid">
        <Metric title="Pendentes" value={pendingCount} icon={ClipboardList} />
        <Metric title="Aprovadas" value={approvedCount} icon={CheckCircle2} />
        <Metric title="Recusadas" value={rejectedCount} icon={X} />
      </div>

      <div className="panel wide">
        <PanelHeader
          title="Solicitações de credenciamento"
          aside={(
            <div className="config-status-filter">
              {["PENDENTE", "APROVADO", "RECUSADO", "TODOS"].map((item) => (
                <button key={item} className={filter === item ? "selected" : ""} type="button" onClick={() => setFilter(item)}>
                  {item === "TODOS" ? "Todos" : accessStatusLabel(item)}
                </button>
              ))}
            </div>
          )}
        />
        {status && <p className="access-review-status">{status}</p>}
        <div className="config-editor-grid access-request-grid">
          {filtered.length === 0 && (
            <EmptyState title="Nenhum credenciamento encontrado" text="As solicitações enviadas pela home aparecerão aqui para análise." />
          )}
          {filtered.map((item) => {
            const sector = (teams.sectors || []).find((candidate) => normalizeText(candidate.name) === normalizeText(item.assignedSector));
            return (
              <article className="request-type-card config-summary-card access-request-card" key={item.id}>
                <div className="config-card-title">
                  <strong>{item.organizationName || item.responsibleName}</strong>
                  <small className={`schedule-status ${item.status === "PENDENTE" ? "pending" : item.status === "APROVADO" ? "active" : "inactive"}`}>
                    {accessStatusLabel(item.status)}
                  </small>
                </div>
                <div className="config-card-details">
                  <span>{item.requesterLabel}</span>
                  <span>Responsável: {item.responsibleName}</span>
                  <span>{item.email}</span>
                  {item.phone && <span>{item.phone}</span>}
                  {(item.city || item.state) && <span>{[item.city, item.state].filter(Boolean).join("/")}</span>}
                  <span>Setor: {sector?.name || item.assignedSector || "Sem setor"}</span>
                  {item.intendedUse && <span>{item.intendedUse}</span>}
                  {item.temporaryPassword && <span>Senha inicial: {item.temporaryPassword}</span>}
                </div>
                <div className="form-actions">
                  <button className="ghost-button" type="button" onClick={() => { setReviewing(item); setReviewNote(item.reviewNote || ""); }}>
                    Analisar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {reviewing && (
        <div className="modal-backdrop">
          <div className="workflow-modal" role="dialog" aria-modal="true">
            <ModalHeader title="Analisar credenciamento" subtitle={reviewing.requesterLabel} onClose={() => setReviewing(null)} />
            <div className="detail-grid compact-detail-grid">
              <p><span>Solicitante</span>{reviewing.organizationName || reviewing.responsibleName}</p>
              <p><span>Responsável</span>{reviewing.responsibleName}</p>
              <p><span>Email</span>{reviewing.email}</p>
              <p><span>Setor</span>{reviewing.assignedSector}</p>
            </div>
            <label className="field">
              <span>Observação da análise</span>
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Motivo da aprovação, pendência ou recusa" />
            </label>
            <div className="form-actions">
              <button className="danger-action" type="button" onClick={() => decide("RECUSADO")}>Recusar</button>
              <button className="primary-action" type="button" onClick={() => decide("APROVADO")}>Aprovar e criar usuário</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
