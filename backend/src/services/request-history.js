import { RequestOrigin, RequestStatus } from "../../../shared/request-contract.js";
import { NO_SHOW_CANCEL_REASON, REJECTED_CANCEL_REASON } from "../../../shared/notification-contract.js";
import { CLOSED_WITHOUT_ATTENDANCE } from "../../../shared/request-procedure-contract.js";
import { RequestHistoryCategory } from "../../../shared/request-history-contract.js";
import { pool } from "../db/index.js";
import { findRequestHistory, findRequestHistoryActors } from "../repositories/request-history.js";
import { isUuid } from "../repositories/request-tracking.js";
import { GLOBAL_ROLES, isGlobalUser } from "../tenant.js";
import { AUDIT_ACTIONS } from "./audit.js";

const text = (value) => typeof value === "string" ? value.trim() : "";
const list = (value) => Array.isArray(value) ? value : [];

function eventDate(value) {
  if (!value || (typeof value !== "string" && !(value instanceof Date))) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function closingEvent(history, currentStatus) {
  const legacyClosure = currentStatus === RequestStatus.COMPLETED
    ? /^(confirmado por\b)|:\s*atendimento realizado\b/i
    : /^(indeferida por\b)|:\s*(indeferido|não compareceu)\b/i;
  const lastDifferentStatus = history.findLastIndex((entry) => entry.at && entry.status && entry.status !== currentStatus && !entry.notification);
  return history.slice(lastDifferentStatus + 1).find((entry) => entry.status === currentStatus && entry.at && !entry.notification
    && (entry.previousStatus ? entry.previousStatus !== currentStatus : legacyClosure.test(entry.notes)));
}

function outcomeLabel(request) {
  if (request.status === RequestStatus.COMPLETED) return "Processo concluído";
  if (request.cancel_reason === NO_SHOW_CANCEL_REASON) return "Processo encerrado por não comparecimento";
  if (request.cancel_reason === REJECTED_CANCEL_REASON) return "Processo indeferido";
  if (request.cancel_reason === CLOSED_WITHOUT_ATTENDANCE) return CLOSED_WITHOUT_ATTENDANCE;
  return "Processo cancelado";
}

function chronology(a, b) {
  if (a.at === b.at) return 0;
  if (!a.at) return 1;
  if (!b.at) return -1;
  return a.at < b.at ? -1 : 1;
}

export function buildRequestHistory(request, actors) {
  const actor = (id) => id === "sistema" ? "Sistema" : actors.get(id) || (id ? "Equipe de atendimento" : null);
  const history = list(request.history).map((entry) => ({
    at: eventDate(entry?.at), by: text(entry?.by), status: text(entry?.status), previousStatus: text(entry?.previousStatus),
    notification: Boolean(entry?.notification), notes: text(typeof entry === "string" ? entry : entry?.notes),
    title: text(entry?.title),
    category: Object.values(RequestHistoryCategory).includes(entry?.category) ? entry.category : undefined,
  })).sort(chronology);
  const closed = [RequestStatus.COMPLETED, RequestStatus.CANCELLED].includes(request.status);
  const closure = closed ? closingEvent(history, request.status) : undefined;
  const events = history.flatMap((entry) => {
    if (entry === closure) return [{ kind: "end", at: entry.at, label: entry.title || outcomeLabel(request), actor: actor(entry.by), detail: entry.notes }];
    return entry.title || entry.notes ? [{ kind: "event", at: entry.at, label: entry.title || entry.notes, actor: actor(entry.by),
      ...(entry.title && entry.notes ? { detail: entry.notes } : {}), ...(entry.category ? { category: entry.category } : {}) }] : [];
  });
  for (const entry of list(request.tutor_history)) {
    events.push({ kind: "event", at: eventDate(entry.at), label: "Cadastro do tutor atualizado", actor: actor(text(entry.by)), category: RequestHistoryCategory.TUTOR });
  }
  if (closed && !closure) events.push({ kind: "end", at: null, label: outcomeLabel(request), actor: null });
  const source = request.origin === RequestOrigin.INTERNAL ? "Atendimento interno"
    : request.animal_origin ? "Cadastro do animal"
    : request.origin === RequestOrigin.PUBLIC ? "Formulário público" : null;
  return [{ kind: "start", at: eventDate(request.created_at), label: "Solicitação registrada", actor: source }, ...events.sort(chronology)];
}

export async function getRequestHistory(req, res) {
  const municipalityId = isGlobalUser(req.user) ? null : req.user.municipalityId;
  if (!isUuid(req.params.id) || (municipalityId !== null && !isUuid(municipalityId))) {
    return res.status(404).json({ error: "Processo não encontrado." });
  }
  try {
    const request = await findRequestHistory(pool, { id: req.params.id, municipalityId, tutorAuditAction: AUDIT_ACTIONS.TUTOR_DATA_UPDATE });
    if (!request) return res.status(404).json({ error: "Processo não encontrado." });
    const ids = [...new Set([...list(request.history), ...list(request.tutor_history)].map((entry) => entry?.by).filter(isUuid))];
    const actors = await findRequestHistoryActors(pool, { ids, municipalityId: request.municipality_id, globalRoles: [...GLOBAL_ROLES] });
    res.json({ events: buildRequestHistory(request, actors) });
  } catch {
    res.status(500).json({ error: "Não foi possível carregar o histórico do processo." });
  }
}
