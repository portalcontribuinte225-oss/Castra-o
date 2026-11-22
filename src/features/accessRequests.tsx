import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { AnyRecord } from "../types";
import { initialTeams } from "../domain";
import { normalizeText } from "../utils";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { CloseButton } from "../components/close-button";
import { useModalFocus } from "../components/modal-focus";
import { configFieldStyle, configTextareaStyle } from "../components/ui";

export function accessStatusLabel(status = "") {
  return (
    { PENDENTE: "Pendente", APROVADO: "Aprovado", RECUSADO: "Recusado" }[status] ||
    status ||
    "Pendente"
  );
}

// The address in one line: street and number, neighborhood, city / UF and CEP, leaving out what was not given.
function addressLine(item: AnyRecord) {
  const street = [item.address, item.addressNumber].filter(Boolean).join(", ");
  const place = [item.city, item.state].filter(Boolean).join(" / ");
  return [street, item.neighborhood, place, item.cep && `CEP ${item.cep}`].filter(Boolean).join(" · ") || "-";
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
  const [reviewError, setReviewError] = useState("");
  const [deciding, setDeciding] = useState(false);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const activeFilter = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!reviewing && feedback && !reviewTrigger.current?.isConnected) {
      activeFilter.current?.focus();
    }
  }, [feedback, reviewing]);

  const pendingCount = accessRequests.filter((item: AnyRecord) => item.status === "PENDENTE").length;
  const approvedCount = accessRequests.filter((item: AnyRecord) => item.status === "APROVADO").length;
  const rejectedCount = accessRequests.filter((item: AnyRecord) => item.status === "RECUSADO").length;

  const filtered = useMemo(() => {
    if (filter === "TODOS") return accessRequests as AnyRecord[];
    return (accessRequests as AnyRecord[]).filter((item) => item.status === filter);
  }, [accessRequests, filter]);

  async function decide(decision: string) {
    if (!reviewing || deciding) return;
    setDeciding(true);
    setFeedback("");
    setReviewError("");
    try {
      const updated = await reviewAccessRequest?.(reviewing.id, {
        status: decision,
        review_note: reviewNote,
      });
      const msg =
        decision === "APROVADO" && updated?.credential?.temporaryPassword
          ? `Acesso aprovado. Anote a senha inicial exibida somente agora: ${updated.credential.temporaryPassword}`
          : "Decisão registrada com sucesso.";
      setFeedback(msg);
      setReviewing(null);
      setReviewNote("");
    } catch (error) {
      setReviewError((error instanceof Error && error.message) || "Não foi possível revisar o credenciamento.");
    } finally {
      setDeciding(false);
    }
  }

  function openReview(item: AnyRecord, trigger: HTMLButtonElement) {
    reviewTrigger.current = trigger;
    setReviewError("");
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
    <section className="tw:grid tw:min-w-0 tw:gap-3.5">
      {feedback && (
        <Card className="tw:flex tw:items-center tw:gap-2.5 tw:border-green-200 tw:bg-green-50 tw:px-4 tw:py-2 tw:text-green-800">
          <CheckCircle2 size={17} aria-hidden="true" className="tw:shrink-0" />
          <span>{feedback}</span>
          <div className="tw:ml-auto"><CloseButton onClick={() => setFeedback("")} aria-label="Dispensar mensagem" /></div>
        </Card>
      )}

        <div className="tw:flex tw:flex-wrap tw:gap-2" role="group" aria-label="Filtros de credenciamento">
            {FILTERS.map((item) => {
              const count =
                item.id === "PENDENTE" ? pendingCount :
                item.id === "APROVADO" ? approvedCount :
                item.id === "RECUSADO" ? rejectedCount :
                accessRequests.length;
              return (
                <Button
                  key={item.id}
                  ref={filter === item.id ? activeFilter : undefined}
                  variant="custom"
                  aria-pressed={filter === item.id}
                  className="tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft tw:aria-pressed:text-ui-accent-strong"
                  onClick={() => { setFeedback(""); setFilter(item.id); }}
                >
                  {item.label}
                  <span className="tw:rounded-full tw:bg-card-page tw:px-2 tw:py-0.5 tw:text-xs tw:tabular-nums">{count}</span>
                </Button>
              );
            })}
        </div>

      <div className="tw:grid tw:min-w-0 tw:gap-2.5">
        {filtered.length === 0 && (
          <Card className="tw:grid tw:min-h-[86px] tw:content-center tw:gap-2 tw:px-5 tw:py-4" role="status">
            <strong className="tw:text-base tw:font-semibold tw:text-ui-ink">{emptyCopy[filter]?.title}</strong>
            <p className="tw:m-0 tw:text-sm tw:text-ui-muted">{emptyCopy[filter]?.text}</p>
          </Card>
        )}
        {filtered.map((item) => {
          const sector = (teams.sectors || []).find(
            (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
          );
          const sectorName = sector?.name || item.assignedSector || "-";
          const tone = statusTone(item.status || "PENDENTE");
          const name = item.organizationName || item.responsibleName || "Solicitante";
          const details = [
            ["Organização", name],
            ["Tipo", item.requesterLabel || "-"],
            ["E-mail", item.email || "-"],
            ["Telefone", item.phone || "-"],
            ["Endereço", addressLine(item)],
            ["Setor", sectorName],
          ];
          return (
            <Card
              as="button"
              className="tw:grid tw:min-h-[76px] tw:min-w-0 tw:w-full tw:items-center tw:gap-3 tw:px-4 tw:py-3.5 tw:text-left tw:touch-manipulation tw:hover:border-ui-accent tw:hover:bg-card-page tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent tw:min-[480px]:grid-cols-2 tw:min-[1101px]:grid-cols-[2fr_1fr_2fr_1fr_1fr_1.2fr_auto]"
              key={item.id}
              aria-label={`Abrir credenciamento de ${name}`}
              onClick={(event) => openReview(item, event.currentTarget)}
            >
              {details.map(([label, value]) => (
                <span key={label} className="tw:grid tw:min-w-0 tw:gap-1">
                  <span className="tw:text-xs tw:font-medium tw:text-ui-muted">{label}</span>
                  <span className="tw:wrap-anywhere tw:text-sm tw:text-ui-ink">{value}</span>
                </span>
              ))}
              <span className="tw:justify-self-start">
                <span className={`tc-result-badge tc-result-badge--${tone}`}>{accessStatusLabel(item.status)}</span>
              </span>
            </Card>
          );
        })}
      </div>

      {reviewing && (
        <CrReviewModal
          item={reviewing}
          note={reviewNote}
          onNoteChange={setReviewNote}
          deciding={deciding}
          error={reviewError}
          returnFocus={reviewTrigger.current}
          onApprove={() => decide("APROVADO")}
          onReject={() => decide("RECUSADO")}
          onClose={() => setReviewing(null)}
          teams={teams}
        />
      )}
    </section>
  );
}

function CrReviewModal({ item, note, onNoteChange, deciding, error, returnFocus, onApprove, onReject, onClose, teams }: AnyRecord) {
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(overlay, true, returnFocus);
  const name = item.organizationName || item.responsibleName || "Solicitante";
  const tone = statusTone(item.status || "PENDENTE");
  const sector = (teams?.sectors || []).find(
    (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
  );
  const sectorName = sector?.name || item.assignedSector || "Sem setor";

  return (
    <div className="modal-backdrop" data-managed-dialog="" ref={overlay}>
      <Card className="ccm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ccm-header">
          <div className="ccm-header-identity">
            <div className="ccm-header-identity-text">
              <span className="ccm-eyebrow">{item.requesterLabel || "Credenciamento"}</span>
              <h2 className="ccm-headline" id={titleId}>{name}</h2>
            </div>
            <div className="ccm-header-actions">
              <span className={`tc-result-badge tc-result-badge--${tone}`}>{accessStatusLabel(item.status)}</span>
              <CloseButton disabled={deciding} onClick={onClose} />
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
                <span>Endereço</span>
                <div className="ccm-readonly-value">{addressLine(item)}</div>
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
            <label className={configFieldStyle}>
              <span>Observação / parecer técnico</span>
              <textarea
                className={`${configTextareaStyle} tw:resize-y`}
                data-ui-input=""
                value={note}
                disabled={deciding}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Descreva pendências, justificativa da aprovação ou motivo da recusa..."
                rows={4}
              />
            </label>
            {error && <p role="alert" className="tw:m-0 tw:text-sm tw:text-ui-danger">{error}</p>}
          </div>
        </div>

        <footer className="ccm-footer">
          <Button variant="danger" onClick={onReject} disabled={deciding}>
            <XCircle size={15} aria-hidden="true" /> Recusar
          </Button>
          <Button variant="custom" className="tw:border-[color:var(--action-primary-border)] tw:bg-[var(--action-primary)] tw:font-semibold tw:text-[color:var(--action-primary-ink)] tw:enabled:hover:bg-[var(--action-primary-hover)]" onClick={onApprove} disabled={deciding}>
            <ShieldCheck size={15} aria-hidden="true" />
            {deciding ? "Processando..." : "Aprovar e criar usuário"}
          </Button>
        </footer>
      </Card>
    </div>
  );
}
