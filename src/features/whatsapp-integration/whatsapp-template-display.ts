import { WHATSAPP_APPROVED_STATUS, whatsappFieldExamples } from "../../../shared/whatsapp-binding-contract.js";
import type { CatalogTemplate, EventBinding, MappingItem, TemplateCatalog } from "./whatsapp-integration-types";

export type StatusTone = "ok" | "warn" | "off";

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

export function templateKey(template: { name: string; language: string }) {
  return `${template.name}|${template.language}`;
}

export function findTemplate(catalog: TemplateCatalog, name: string, language: string): CatalogTemplate | null {
  return catalog.templates.find((template) => template.name === name && template.language === language) || null;
}

// Templates the bindings can use: approved and with a format the system can fill.
export function bindableTemplates(catalog: TemplateCatalog) {
  return catalog.templates.filter((template) => template.status === WHATSAPP_APPROVED_STATUS && template.supported);
}

function mappingText(item: MappingItem | undefined, position: number) {
  if (!item || !item.value) return `{{${position}}}`;
  return item.kind === "text" ? item.value : (whatsappFieldExamples as Record<string, string>)[item.value] || `{{${position}}}`;
}

export function renderTemplatePreview(bodyText: string, mapping: MappingItem[]) {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_match, position) => mappingText(mapping[Number(position) - 1], Number(position)));
}

export interface BindingSituation { label: string; tone: StatusTone }

// What the administrator needs to know about one event: is it linked and is the linked template still usable?
export function describeBinding(binding: EventBinding | null, catalog: TemplateCatalog): BindingSituation {
  if (!binding) return { label: "Sem vínculo: o aviso segue por e-mail", tone: "off" };
  if (!catalog.syncedAt) return { label: "Não verificado: sincronize os templates", tone: "warn" };
  const template = findTemplate(catalog, binding.templateName, binding.languageCode);
  if (!template) return { label: "Não encontrado no catálogo", tone: "off" };
  if (template.status !== WHATSAPP_APPROVED_STATUS) return { label: templateStatusLabel(template.status), tone: templateStatusTone(template.status) };
  if (template.variableCount !== binding.mapping.length) return { label: "Variáveis do template mudaram: revise o vínculo", tone: "off" };
  return { label: "Pronto para enviar", tone: "ok" };
}
