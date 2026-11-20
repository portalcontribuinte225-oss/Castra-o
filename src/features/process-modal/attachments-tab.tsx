import { CheckCircle2, Download, Eye, FileText, Plus, X } from "lucide-react";
import { AiAnalysisDetails } from "../../App";
import type { AttachmentRow } from "./attachment-rows";
import { attachmentDescription, attachmentStateClasses, attachmentStateLabels, canReviewAttachment, isBlockingAttachment, AttachmentState } from "./attachment-rows";
import { plural } from "./process-labels";

interface AttachmentsTabProps {
  rows: AttachmentRow[];
  pendingCount: number;
  // Decisions and evidence are taken while the process is open and the user may edit it.
  canReview: boolean;
  canAttach: boolean;
  reviewBlockedReason: string;
  busyId: string;
  uploadingEvidence: boolean;
  error: string;
  onPreview: (row: AttachmentRow) => void;
  onDownload: (row: AttachmentRow) => void;
  onApprove: (row: AttachmentRow) => void;
  onReject: (row: AttachmentRow) => void;
  onEvidence: (file: File) => void;
}

export function AttachmentsTab({ rows, pendingCount, canReview, canAttach, reviewBlockedReason, busyId, uploadingEvidence, error, onPreview, onDownload, onApprove, onReject, onEvidence }: AttachmentsTabProps) {
  const blocking = rows.filter(isBlockingAttachment);
  const busy = Boolean(busyId) || uploadingEvidence;
  return (
    <div className="prm-section">
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="prm-section-head">
        <div>
          <p className="prm-section-label">Conferência de documentos</p>
        </div>
        {pendingCount > 0 && <span className="attachment-status attachment-status--pending">{plural(pendingCount, "pendente", "pendentes")}</span>}
      </div>
      <div className="process-attachments-list">
        {rows.map((row) => {
          const stateClass = attachmentStateClasses[row.state];
          const reviewable = canReview && canReviewAttachment(row);
          return (
            <article key={`${row.kind}-${row.id}`} className={`process-attachment-row process-attachment-row--${stateClass}${isBlockingAttachment(row) ? " is-blocking" : ""}`}>
              <div className="process-attachment-main">
                <span className="process-attachment-icon-box"><FileText size={15} /></span>
                <div className="process-attachment-info">
                  <div className="process-attachment-heading">
                    <strong>{row.title}</strong>
                    <span className={`attachment-status attachment-status--${stateClass}`}>{attachmentStateLabels[row.state]}</span>
                  </div>
                  <p className="attachment-ai-message">{attachmentDescription(row)}</p>
                  {Boolean(row.document?.provider) && !row.document?.error && (
                    <div className="attachment-ai-details">
                      <AiAnalysisDetails show provider={row.document?.provider} model={row.document?.model} confidence={row.document?.confidence}
                        criteriaResults={row.document?.criteriaResults} showMeta={false} criteriaClassName="doc-criteria-results attachment-ai-criteria" />
                    </div>
                  )}
                </div>
              </div>
              <div className="process-attachment-actions">
                {row.available && (
                  <div className="process-attachment-file-actions" aria-label={`Arquivo de ${row.title}`}>
                    <button className="icon-action" aria-label={`Visualizar ${row.title}`} title="Visualizar" type="button" disabled={busy} onClick={() => onPreview(row)}><Eye size={16} /></button>
                    <button className="icon-action" aria-label={`Baixar ${row.title}`} title="Baixar" type="button" disabled={busy} onClick={() => onDownload(row)}><Download size={16} /></button>
                  </div>
                )}
                {reviewable && (
                  <div className="process-attachment-review-actions">
                    <button className="prm-action-btn prm-action-btn--approve-document" type="button" aria-label={`Deferir ${row.title}`} title={reviewBlockedReason || "Deferir documento"} disabled={Boolean(reviewBlockedReason) || busy} onClick={() => onApprove(row)}>
                      <CheckCircle2 size={15} aria-hidden="true" /> Deferir
                    </button>
                    {row.state !== AttachmentState.REJECTED && (
                      <button className="prm-action-btn prm-action-btn--reject-document" type="button" aria-label={`Indeferir ${row.title}`} title={reviewBlockedReason || "Indeferir documento"} disabled={Boolean(reviewBlockedReason) || busy} onClick={() => onReject(row)}>
                        <X size={15} aria-hidden="true" /> Indeferir
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {canAttach && (
        <label className="prm-evidence-drop">
          <input type="file" accept="application/pdf,image/jpeg,image/png" aria-label="Anexar evidência" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onEvidence(file); }} />
          <span>
            <strong>Anexar evidência</strong>
            <small>Arquivo complementar do processo · PDF ou imagem</small>
          </span>
          <span className="prm-action-btn prm-action-btn--secondary"><Plus size={15} /> {uploadingEvidence ? "Anexando..." : "Adicionar arquivo"}</span>
        </label>
      )}
      {blocking.length > 0 && (
        <p className="prm-documents-warning">
          <strong>Pendência documental.</strong> A confirmação de agendamentos fica disponível após o deferimento de: {blocking.map((row) => row.title).join(", ")}.
        </p>
      )}
    </div>
  );
}
