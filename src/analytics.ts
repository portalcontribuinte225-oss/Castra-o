import type { AnyRecord } from "./types";
import { initialTeams, normalizeRequest, requestHasTag, requestTypeLabel } from "./domain";

export function sumValues(items: AnyRecord[] = []) {
  return items.reduce((total, item) => total + Number(item.value || 0), 0);
}

export function countBy(items: AnyRecord[] = [], getKey: (item: AnyRecord) => string) {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item) || "Não informado";
    totals.set(key, (totals.get(key) || 0) + 1);
  });
  return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function getRequestTypeName(request: AnyRecord = {}, requestTypes: AnyRecord[] = []) {
  const byId = requestTypes.find((type) => type.id && type.id === request.requestTypeId);
  const rawType = request.type || request.request_type || byId?.name || request.requestTypeId || "";
  return rawType ? requestTypeLabel({ type: rawType }) : "Não informado";
}

export function getRequestUserName(request: AnyRecord = {}) {
  return request.responsible || request.assignedUserName || request.assignedSectorName || "Sem responsável";
}

export function getTeamUserName(userId = "", teams: AnyRecord = initialTeams, currentUser: AnyRecord | null = null) {
  const id = String(userId || "").trim();
  if (!id) return "";
  const teamUser = (teams.users || []).find((user) => String(user.id) === id || String(user.email) === id);
  if (teamUser?.name) return teamUser.name;
  if (currentUser && (String(currentUser.id) === id || String(currentUser.email) === id)) return currentUser.name || currentUser.email;
  return looksLikeTechnicalId(id) ? "Usuário não identificado" : id;
}

export function getRequestClosedByName(request: AnyRecord = {}, teams: AnyRecord = initialTeams, currentUser: AnyRecord | null = null) {
  const rawHistory = Array.isArray(request.rawHistory) ? request.rawHistory : [];
  const closingEntry = [...rawHistory].reverse().find((item) => {
    if (!item || typeof item === "string") return false;
    const status = String(item.status || "");
    const notes = String(item.notes || "");
    return status === "REALIZADA" || status === "CANCELADA" || status === "ARQUIVADA" || /comparec|cancel|indefer/i.test(notes);
  });
  const byFromEntry = getTeamUserName(closingEntry?.by, teams, currentUser);
  if (byFromEntry) return byFromEntry;

  const historyText = Array.isArray(request.history) ? [...request.history].reverse().join(" | ") : "";
  const byMatch = historyText.match(/\bpor\s+([^-|]+)/i);
  const byFromText = getTeamUserName(byMatch?.[1], teams, currentUser);
  return byFromText || getRequestUserName(request);
}

export function parseAnyDate(value: any) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRequestDate(request: AnyRecord = {}) {
  return parseAnyDate(request.createdAt || request.created_at || request.preferredSchedule || request.appointment);
}

export function isInPeriod(date: Date | null, start: string, end: string) {
  if (!date) return true;
  if (start && date < new Date(`${start}T00:00:00`)) return false;
  if (end && date > new Date(`${end}T23:59:59`)) return false;
  return true;
}

export function topItems<T>(items: T[] = [], limit = 6) {
  return items.slice(0, limit);
}

export function buildMetrics(requests: AnyRecord[] = []) {
  const normalizedRequests = requests.map(normalizeRequest);
  return {
    total: normalizedRequests.length,
    pending: normalizedRequests.filter((request) => request.status === "NOVA" || request.status === "AGENDADA").length,
    done: normalizedRequests.filter((request) => request.status === "REALIZADA").length,
  };
}

function looksLikeTechnicalId(value = "") {
  return /^[a-f0-9-]{6,}$/i.test(value);
}
