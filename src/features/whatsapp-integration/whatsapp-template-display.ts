import { WHATSAPP_APPROVED_STATUS, WHATSAPP_NOT_A_NOTICE_REASON } from "../../../shared/whatsapp-templates-contract.js";
import type { WhatsappTemplateRow } from "./whatsapp-integration-types";

export type StatusTone = "ok" | "warn" | "off";

// A silent synchronization on open only runs when the last one is older than this.
export const TEMPLATE_SYNC_STALE_MS = 10 * 60 * 1000;

const statusLabels: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Em análise",
  IN_APPEAL: "Em recurso",
  REJECTED: "Reprovado",
  PAUSED: "Pausado",
  DISABLED: "Desativado",
  NOT_FOUND: "Não encontrado",
};

export function templateStatusLabel(status: string) {
  return statusLabels[status] || status || "Desconhecido";
}

export function templateStatusTone(status: string): StatusTone {
  if (status === WHATSAPP_APPROVED_STATUS) return "ok";
  return status === "PENDING" || status === "IN_APPEAL" ? "warn" : "off";
}

export function templateRowKey(row: Pick<WhatsappTemplateRow, "name" | "language">) {
  return `${row.name}|${row.language}`;
}

export function needsAutoSync(syncedAt: string, now = Date.now()) {
  const last = Date.parse(syncedAt);
  return Number.isNaN(last) || now - last > TEMPLATE_SYNC_STALE_MS;
}

// Order in which the use fills the template: {{1}} is the first variable, {{2}} the second, and so on.
export function variableOrderHint(row: WhatsappTemplateRow) {
  return row.variables.map((label, index) => `{{${index + 1}}} ${label}`).join(" · ");
}

export const NOT_USED_BY_SYSTEM_TEXT = "Template padrão da Meta, não usado pelo sistema.";

// A template whose name is not a system notice (e.g. the test template Meta creates) is neutral, not a defect.
export function isNotUsedBySystem(row: WhatsappTemplateRow) {
  return !row.label && row.reason === WHATSAPP_NOT_A_NOTICE_REASON;
}

// Why the switch cannot be turned on (empty when it can, or when it is already on).
export function lockReason(row: WhatsappTemplateRow) {
  if (row.active || row.canActivate) return "";
  if (isNotUsedBySystem(row)) return NOT_USED_BY_SYSTEM_TEXT;
  return row.label ? "Liga quando a Meta aprovar o template." : row.reason || "Fora do padrão.";
}
