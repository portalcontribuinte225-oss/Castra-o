import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Shield,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import type { AnyRecord } from "../types";
import { initialTeams } from "../domain";
import { normalizeText } from "../utils";

export function accessStatusLabel(status = "") {
  return (
    { PENDENTE: "Pendente", APROVADO: "Aprovado", RECUSADO: "Recusado" }[status] ||
    status ||
    "Pendente"
  );
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function statusTone(status: string) {
  if (status === "APROVADO") return "success";
  if (status === "RECUSADO") return "danger";
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

  return (
    <section className="cr-root">
      <div className="page-toolbar cr-controls-row">
          <div className="cr-stats-row">
            <span><ClipboardList size={12} /> {accessRequests.length} total</span>
            {pendingCount > 0 && <span className="cr-stat-warn">{pendingCount} pendentes</span>}
            {approvedCount > 0 && <span className="cr-stat-ok">{approvedCount} aprovados</span>}
            {rejectedCount > 0 && <span>{rejectedCount} recusados</span>}
          </div>

          <nav className="request-nav cr-nav" aria-label="Filtros de credenciamento">
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
                    {item.label}
                    {count > 0 && <span className="cr-seg-count">{count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="request-today-segment cr-result-segment">
              <span className="cr-result-label">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </nav>
      </div>
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

      <div className="cr-table-wrap">
        {filtered.length === 0 ? (
          <CrEmpty filter={filter} />
        ) : (
          <table className="cr-table">
            <thead>
              <tr>
                <th>Organização</th>
                <th>Tipo</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Cidade / UF</th>
                <th>Setor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const sector = (teams.sectors || []).find(
                  (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
                );
                const sectorName = sector?.name || item.assignedSector || "—";
                const tone = statusTone(item.status || "PENDENTE");
                return (
                  <tr
                    key={item.id}
                    className="cr-table-row"
                    onClick={() => openReview(item)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openReview(item)}
                  >
                    <td className="cr-col-name">
                      {item.organizationName || item.responsibleName || "Solicitante"}
                    </td>
                    <td>{item.requesterLabel || "—"}</td>
                    <td>{item.email || "—"}</td>
                    <td>{item.phone || "—"}</td>
                    <td>{[item.city, item.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{sectorName}</td>
                    <td>
                      <span className={`cr-badge is-${tone}`}>{accessStatusLabel(item.status)}</span>
                      {item.temporaryPassword && (
                        <span className="cr-temp-pw">Senha: {item.temporaryPassword}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <div className="modal-backdrop">
          <div className="cr-modal" role="dialog" aria-modal="true">
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
          </div>
        </div>
      )}
    </section>
  );
}

function CrEmpty({ filter }: { filter: string }) {
  const msg =
    filter === "PENDENTE" ? "Nenhuma solicitação pendente" :
    filter === "APROVADO" ? "Nenhum credenciamento aprovado" :
    filter === "RECUSADO" ? "Nenhum credenciamento recusado" :
    "Nenhuma solicitação encontrada";

  return (
    <div className="cr-empty">
      <div className="cr-empty-icon">
        <ClipboardList size={28} strokeWidth={1.2} />
      </div>
      <strong>{msg}</strong>
      <span>As solicitações enviadas pela home aparecerão aqui para análise.</span>
    </div>
  );
}

function CrReviewModal({ item, note, onNoteChange, deciding, onApprove, onReject, onClose, teams }: AnyRecord) {
  const name = item.organizationName || item.responsibleName || "Solicitante";
  const tone = statusTone(item.status || "PENDENTE");
  const sector = (teams?.sectors || []).find(
    (s: AnyRecord) => normalizeText(s.name) === normalizeText(item.assignedSector),
  );
  const sectorName = sector?.name || item.assignedSector || "Sem setor";

  const stepIndex = item.status === "APROVADO" || item.status === "RECUSADO" ? 2 : 1;
  const STEPS = ["Recebido", "Em análise", "Decisão"];

  return (
    <>
      <div className="cr-modal-head">
        <div className="cr-modal-identity">
          <div className="cr-modal-avatar">{getInitials(name)}</div>
          <div>
            <h3 className="cr-modal-name">{name}</h3>
            {item.requesterLabel && <span className="cr-modal-type">{item.requesterLabel}</span>}
          </div>
        </div>
        <div className="cr-modal-head-right">
          <span className={`cr-badge is-${tone}`}>{accessStatusLabel(item.status)}</span>
          <button className="cr-modal-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="cr-stepper">
        {STEPS.map((step, i) => (
          <div
            key={step}
            className={`cr-step${i <= stepIndex ? " is-active" : ""}${i < stepIndex ? " is-done" : ""}`}
          >
            <div className="cr-step-dot">
              {i < stepIndex ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>}
            </div>
            <span className="cr-step-label">{step}</span>
            {i < STEPS.length - 1 && <div className="cr-step-line" />}
          </div>
        ))}
      </div>

      <div className="cr-modal-info">
        {item.requesterLabel && (
          <div className="cr-info-row"><span>Tipo</span><span>{item.requesterLabel}</span></div>
        )}
        <div className="cr-info-row"><span>Responsável</span><span>{item.responsibleName || "—"}</span></div>
        <div className="cr-info-row"><span>E-mail</span><span>{item.email || "—"}</span></div>
        {item.phone && <div className="cr-info-row"><span>Telefone</span><span>{item.phone}</span></div>}
        {(item.city || item.state) && (
          <div className="cr-info-row">
            <span>Cidade / UF</span>
            <span>{[item.city, item.state].filter(Boolean).join(" / ")}</span>
          </div>
        )}
        <div className="cr-info-row"><span>Setor</span><span>{sectorName}</span></div>
        {item.intendedUse && <div className="cr-info-row"><span>Finalidade</span><span>{item.intendedUse}</span></div>}
        {item.reviewNote && <div className="cr-info-row"><span>Parecer anterior</span><span>{item.reviewNote}</span></div>}
      </div>

      <label className="cr-note-field">
        <span>Observação / parecer técnico</span>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Descreva pendências, justificativa da aprovação ou motivo da recusa..."
          rows={3}
        />
      </label>

      <div className="cr-modal-actions">
        <button className="cr-action-reject" type="button" onClick={onReject} disabled={deciding}>
          <XCircle size={15} /> Recusar
        </button>
        <button className="cr-action-approve" type="button" onClick={onApprove} disabled={deciding}>
          <ShieldCheck size={15} />
          {deciding ? "Processando..." : "Aprovar e criar usuário"}
        </button>
      </div>
    </>
  );
}
