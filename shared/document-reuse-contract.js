export const DocumentReuseScope = Object.freeze({ TUTOR: "tutor", ANIMAL: "animal", REQUEST: "request" });
export const DocumentReviewStatus = Object.freeze({ ATTACHED: "attached", APPROVED: "approved", REJECTED: "rejected" });
export const DocumentReuseState = Object.freeze({ REUSABLE: "reusable", PENDING: "pending", EXPIRED: "expired", UNAVAILABLE: "unavailable" });
export const MAX_REQUEST_JSON_BYTES = 16 * 1024 * 1024;
export const MAX_REQUEST_DOCUMENTS = 20;
// A century is representable for all supported contemporary receipt dates.
export const MAX_DOCUMENT_REUSE_VALIDITY_DAYS = 36525;

function validDays(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_DOCUMENT_REUSE_VALIDITY_DAYS;
}

export function normalizeDocumentReusePolicy(value = {}) {
  return {
    reuseScope: Object.values(DocumentReuseScope).includes(value?.reuseScope) ? value.reuseScope : DocumentReuseScope.REQUEST,
    reuseValidityDays: validDays(value?.reuseValidityDays) ? value.reuseValidityDays : null,
  };
}

export function validateDocumentReusePolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Configuração do documento inválida.";
  if (value.reuseScope !== undefined && !Object.values(DocumentReuseScope).includes(value.reuseScope)) return "Abrangência do documento inválida.";
  if (value.reuseValidityDays !== undefined && value.reuseValidityDays !== null
    && !validDays(value.reuseValidityDays)) return `O prazo de reaproveitamento deve ser um inteiro entre 1 e ${MAX_DOCUMENT_REUSE_VALIDITY_DAYS} dias ou ficar sem prazo.`;
  return "";
}
