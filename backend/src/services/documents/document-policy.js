import { createHash } from "node:crypto";
import { DocumentReuseScope, normalizeDocumentReusePolicy } from "../../../../shared/document-reuse-contract.js";

export function canonicalDocumentDefinition(document = {}) {
  return { ...document, ...normalizeDocumentReusePolicy(document), required: document.required !== false,
    active: document.active !== false, accept: Array.isArray(document.accept) && document.accept.length ? document.accept : ["image/jpeg", "image/png", "application/pdf"],
    maxSizeMb: Number(document.maxSizeMb) > 0 ? Number(document.maxSizeMb) : 5 };
}

export function resolveDocumentRequestType(settings, input) {
  const types = Array.isArray(settings?.requestTypes) ? settings.requestTypes : [];
  if (typeof input === "string") return types.find((item) => item.id === input || item.name === input);
  const requestType = input?.request_type ?? input?.requestType ?? input?.requestTypeId ?? input?.type;
  return types.find((item) => input?.requestTypeId ? item.id === input.requestTypeId : item.id === requestType || item.name === requestType);
}

export function requestDocumentDefinitions(settings, input) {
  const type = resolveDocumentRequestType(settings, input);
  return (Array.isArray(type?.documents) ? type.documents : []).map((reference) => {
    const configured = (settings.documentTypes || []).find((item) => item.id === reference.id);
    return canonicalDocumentDefinition({ ...reference, ...(configured || {}) });
  }).filter((document) => document.active && typeof document.id === "string");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function documentCriteriaFingerprint(definition) {
  const policy = canonicalDocumentDefinition(definition);
  return createHash("sha256").update(JSON.stringify(stableValue({ id: policy.id, accept: [...policy.accept].sort(),
    maxSizeMb: policy.maxSizeMb, analysisRules: policy.analysisRules || {}, reuseScope: policy.reuseScope }))).digest("hex");
}

export function isExcludedDocument(document) {
  return !document || typeof document !== "object" || document.internalEvidence === true
    || /^(evidencia-|requerimento-)/.test(document.documentId || "") || document.documentName === "Evidência da apuração"
    || document.documentName === "Requerimento municipal";
}

export const PHOTO_DEFINITION = Object.freeze({ id: "animal_photo", name: "Foto de registro animal", required: false,
  active: true, reuseScope: DocumentReuseScope.ANIMAL, reuseValidityDays: null,
  accept: ["image/png", "image/jpeg", "image/gif", "image/webp"], maxSizeMb: 5 });
