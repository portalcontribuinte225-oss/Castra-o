import { resolveRequestTypes } from "../../../shared/request-types-contract.js";
import { normalizeDocumentType } from "../../domain";
import type { AnyRecord } from "../../types";
import { mergeProcedureDocuments } from "../request-procedures/request-procedures";

function parseConfigDate(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const text = String(value).trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(\d{2}):(\d{2}))?/);
  if (brMatch) {
    const [, day, month, year, hour = "0", minute = "0"] = brMatch;
    const time = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? time : 0;
}

// A document type created after the request was made is not asked of it.
function wasDocumentConfiguredForRequest(document: AnyRecord, request: AnyRecord): boolean {
  const requestCreatedAt = parseConfigDate(request.createdAt || request.created_at);
  const documentCreatedAt = parseConfigDate(document.createdAt || document.created_at);
  return !requestCreatedAt || !documentCreatedAt || documentCreatedAt <= requestCreatedAt;
}

// The documents the procedures of the request ask for, each once, as the municipality configured them.
export function requestDocumentTypes(request: AnyRecord, requestTypes: AnyRecord[], documentTypes: AnyRecord[]): AnyRecord[] {
  const workflow = request.workflow_data || request.workflowData;
  const types = resolveRequestTypes({ animals: request.animals, workflow }, requestTypes);
  return mergeProcedureDocuments(types.map((type: AnyRecord) => (type.documents || [])
    .map((document: AnyRecord) => normalizeDocumentType({ ...document, ...documentTypes.find((item) => item.id === document.id) }))
    .filter((document: AnyRecord) => document.active !== false && wasDocumentConfiguredForRequest(document, request))));
}
