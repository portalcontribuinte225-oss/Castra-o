import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import type { AnyRecord } from "../types";
import { initialTeams } from "../domain";
import { normalizeText } from "../utils";
import { EmptyState } from "../components/ui";

export function accessStatusLabel(status = "") {
  return (
    { PENDENTE: "Pendente", APROVADO: "Aprovado", RECUSADO: "Recusado" }[status] ||
    status ||
    "Pendente"
  );
}

function statusTone(status: string) {
  if (status === "APROVADO") return "success";
  if (status === "RECUSADO") return "canceled";
  return "pending";
}

const FILTERS = [
  { id: "PENDENTE", label: "Pendentes" },
  { id: "APROVADO", label: "Aprovados" },
  { id: "RECUSADO", label: "Recusados" },
  { id: "TODOS", label: "Todos" },
];

export function AccessRequestsView({
  accessRequests = [],
  reviewAccessRequest,
  teams = initialTeams,
}: AnyRecord) {
  const [filter, setFilter] = useState("PENDENTE");
  const [reviewing, setReviewing] = useState<AnyRecord | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deciding, setDeciding] = useState(false);

  const pendingCount = accessRequests.filter((item: AnyRecord) => item.status === "PENDENTE").length;
  const approvedCount = accessRequests.filter((item: AnyRecord) => item.status === "APROVADO").length;
  const rejectedCount = accessRequests.filter((item: AnyRecord) => item.status === "RECUSADO").length;

  const filtered = useMemo(() => {
    if (filter === "TODOS") return accessRequests as AnyRecord[];
    return (accessRequests as AnyRecord[]).filter((item) => item.status === filter);
  }, [accessRequests, filter]);

  async function decide(decision: string) {
    if (!reviewing) return;
    setDeciding(true);
    setFeedback("");
    try {
      const updated = await reviewAccessRequest?.(reviewing.id, {
        status: decision,
        review_note: reviewNote,
      });
      const msg =
        decision === "APROVADO" && updated?.temporaryPassword
          ? `Acesso aprovado. Senha inicial: ${updated.temporaryPassword}`
          : "Decisão registrada com sucesso.";
      setFeedback(msg);
      setReviewing(null);
      setReviewNote("");
    } catch (err: any) {
      setFeedback(err.message || "Não foi possível revisar o credenciamento.");
    } finally {
      setDeciding(false);
    }
  }

  function openReview(item: AnyRecord) {
    setReviewing(item);
    setReviewNote(item.reviewNote || "");
  }

  const emptyCopy: Record<string, { title: string; text: string }> = {
    PENDENTE: { title: "Nenhuma solicitação pendente", text: "As solicitações enviadas pela home aparecerão aqui para análise." },
    APROVADO: { title: "Nenhum credenciamento aprovado", text: "As solicitações enviadas pela home aparecerão aqui para análise." },
    RECUSADO: { title: "Nenhum credenciamento recusado", text: "As solicitações enviadas pela home aparecerão aqui para análise." },
    TODOS: { title: "Nenhuma solicitação encontrada", text: "As solicitações enviadas pela home aparecerão aqui para análise." },
  };

  return (
    <section className="request-workspace triage-workspace clean-requests-workspace">
      {feedback && (
        <div className={`cr-feedback ${feedback.includes("sucesso") || feedback.includes("Senha") ? "is-ok" : "is-error"}`}>
          {feedback.includes("sucesso") || feedback.includes("Senha")
            ? <CheckCircle2 size={15} />
            : <XCircle size={15} />}
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback("")} aria-label="Fechar">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="page-toolbar request-page-controls">
        <nav className="request-nav" aria-label="Filtros de credenciamento">
          <div className="request-filter-tabs">
            {FILTERS.map((item) => {
              const count =
                item.id === "PENDENTE" ? pendingCount :
                item.id === "APROVADO" ? approvedCount :
                item.id === "RECUSADO" ? rejectedCount :
                accessRequests.length;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "selected" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}<span>{count}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="triage-card-grid">
        {filtered.length === 0 && (
          <EmptyState title={emptyCopy[filter]?.title} text={emptyCopy[filter]?.text} />
        )}
        {filtered.map((item) => {
          const sector = (teams.sectors || []).find(
            (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
          );
          const sectorName = sector?.name || item.assignedSector || "-";
          const tone = statusTone(item.status || "PENDENTE");
          const name = item.organizationName || item.responsibleName || "Solicitante";
          return (
            <article
              className="triage-card clickable-triage-card"
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`Abrir credenciamento de ${name}`}
              onClick={() => openReview(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openReview(item);
                }
              }}
            >
              <div className="tc-row cr-card-row">
                <div className="tc-col tc-col--tutor">
                  <span className="tc-label">Organização</span>
                  <span className="tc-value">{name}</span>
                </div>
                <div className="tc-col tc-col--tipo">
                  <span className="tc-label">Tipo</span>
                  <span className="tc-value">{item.requesterLabel || "-"}</span>
                </div>
                <div className="tc-col">
                  <span className="tc-label">E-mail</span>
                  <span className="tc-value">{item.email || "-"}</span>
                </div>
                <div className="tc-col">
                  <span className="tc-label">Telefone</span>
                  <span className="tc-value">{item.phone || "-"}</span>
                </div>
                <div className="tc-col">
                  <span className="tc-label">Cidade / UF</span>
                  <span className="tc-value">{[item.city, item.state].filter(Boolean).join(" / ") || "-"}</span>
                </div>
                <div className="tc-col tc-col--responsavel">
                  <span className="tc-label">Setor</span>
                  <span className="tc-value">{sectorName}</span>
                </div>
                <div className="tc-col tc-col--status">
                  <span className={`tc-result-badge tc-result-badge--${tone}`}>{accessStatusLabel(item.status)}</span>
                  {item.temporaryPassword && (
                    <span className="cr-temp-pw">Senha: {item.temporaryPassword}</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {reviewing && (
        <CrReviewModal
          item={reviewing}
          note={reviewNote}
          onNoteChange={setReviewNote}
          deciding={deciding}
          onApprove={() => decide("APROVADO")}
          onReject={() => decide("RECUSADO")}
          onClose={() => setReviewing(null)}
          teams={teams}
        />
      )}
    </section>
  );
}

function CrReviewModal({ item, note, onNoteChange, deciding, onApprove, onReject, onClose, teams }: AnyRecord) {
  const name = item.organizationName || item.responsibleName || "Solicitante";
  const tone = statusTone(item.status || "PENDENTE");
  const sector = (teams?.sectors || []).find(
    (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
  );
  const sectorName = sector?.name || item.assignedSector || "Sem setor";

  return (
    <div className="modal-backdrop">
      <div className="ccm-modal" role="dialog" aria-modal="true">
        <header className="ccm-header">
          <div className="ccm-header-identity">
            <div className="ccm-header-identity-text">
              <span className="ccm-eyebrow">{item.requesterLabel || "Credenciamento"}</span>
              <h2 className="ccm-headline">{name}</h2>
            </div>
            <div className="ccm-header-actions">
              <span className={`tc-result-badge tc-result-badge--${tone}`}>{accessStatusLabel(item.status)}</span>
              <button className="ccm-close-btn" type="button" onClick={onClose} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="ccm-body">
          <div className="ccm-section">
            <p className="ccm-section-title">Dados enviados</p>
            <div className="modal-form-grid">
              <div className="field ccm-readonly-field">
                <span>Tipo</span>
                <div className="ccm-readonly-value">{item.requesterLabel || "-"}</div>
              </div>
              <div className="field ccm-readonly-field">
                <span>Responsável</span>
                <div className="ccm-readonly-value">{item.responsibleName || "-"}</div>
              </div>
              <div className="field ccm-readonly-field">
                <span>E-mail</span>
                <div className="ccm-readonly-value">{item.email || "-"}</div>
              </div>
              <div className="field ccm-readonly-field">
                <span>Telefone</span>
                <div className="ccm-readonly-value">{item.phone || "-"}</div>
              </div>
              <div className="field ccm-readonly-field">
                <span>Cidade / UF</span>
                <div className="ccm-readonly-value">{[item.city, item.state].filter(Boolean).join(" / ") || "-"}</div>
              </div>
              <div className="field ccm-readonly-field">
                <span>Setor</span>
                <div className="ccm-readonly-value">{sectorName}</div>
              </div>
              {item.intendedUse && (
                <div className="field ccm-readonly-field ccm-readonly-field--wide">
                  <span>Finalidade</span>
                  <div className="ccm-readonly-value">{item.intendedUse}</div>
                </div>
              )}
            </div>
          </div>

          <div className="ccm-section">
            <p className="ccm-section-title">Parecer</p>
            {item.reviewNote && (
              <div className="ccm-prior-note">
                <span>Parecer anterior</span>
                <p>{item.reviewNote}</p>
              </div>
            )}
            <label className="field">
              <span>Observação / parecer técnico</span>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Descreva pendências, justificativa da aprovação ou motivo da recusa..."
                rows={4}
              />
            </label>
          </div>
        </div>

        <footer className="ccm-footer">
          <button className="secondary-action danger-action" type="button" onClick={onReject} disabled={deciding}>
            <XCircle size={15} /> Recusar
          </button>
          <button className="primary-action" type="button" onClick={onApprove} disabled={deciding}>
            <ShieldCheck size={15} />
            {deciding ? "Processando..." : "Aprovar e criar usuário"}
          </button>
        </footer>
      </div>
    </div>
  );
}
