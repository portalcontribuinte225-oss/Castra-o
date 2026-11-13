import { DocumentReuseScope, DocumentReuseState } from "../../../../shared/document-reuse-contract.js";
import { listDocumentSources, readDocumentSource } from "../../repositories/document-sources.js";
import { canonicalDocumentDefinition, PHOTO_DEFINITION, requestDocumentDefinitions, isExcludedDocument } from "./document-policy.js";
import { describeStoredDocument, isReusableForAnimal } from "./stored-document.js";
import { documentError } from "./document-content.js";

export async function checkOriginalDocument(client, source, description, definition, context, now = new Date()) {
  const origin = description.origin;
  if (!origin || origin.ownerUserId !== context.userId || origin.municipalityId !== context.municipalityId) throw documentError("Origem do anexo indisponível.", 404);
  if (origin.requestId === source.id && origin.attachmentId === description.attachmentId) return;
  const original = await readDocumentSource(client, { ...context, sourceRequestId: origin.requestId, attachmentId: origin.attachmentId, lock: context.lock });
  const originalDescription = describeStoredDocument(original, definition, { now });
  if (originalDescription.attachmentId !== origin.attachmentId || originalDescription.hash !== description.hash
    || originalDescription.receivedAt !== description.receivedAt
    || ![DocumentReuseState.PENDING, DocumentReuseState.REUSABLE].includes(originalDescription.state)) throw documentError("O arquivo de origem foi substituído, recusado ou venceu.");
}

function metadata(source, description, definition) {
  const document = source.document;
  return { attachmentId: description.attachmentId, documentId: definition.id, documentName: definition.name || document.documentName || "Documento",
    fileName: String(document.fileName || "documento").replace(/[\r\n\\/]/g, "_").slice(0, 180),
    fileType: description.content?.contentType || document.fileType || "", fileSize: description.content?.size || Number(document.fileSize) || 0,
    status: description.status, state: description.state, eligible: false, receivedAt: description.receivedAt, expiresAt: description.expiresAt,
    reuseRef: { sourceRequestId: source.id, attachmentId: description.attachmentId, hash: description.hash } };
}

export async function catalogReusableDocuments(client, { userId, municipalityId, animalId, requestTypeId, settings, now = new Date() }) {
  const definitions = [...requestDocumentDefinitions(settings, requestTypeId), PHOTO_DEFINITION]
    .filter((definition) => definition.reuseScope !== DocumentReuseScope.REQUEST);
  if (!definitions.length) return [];
  const sources = await listDocumentSources(client, { userId, municipalityId, documentIds: definitions.map((definition) => definition.id) });
  const candidates = new Map();
  for (const row of sources) {
    const definition = definitions.find((item) => item.id === row.document?.documentId);
    if (!definition || isExcludedDocument(row.document) || candidates.get(definition.id)?.eligible) continue;
    try {
      // Signed manifests do not require loading bytes to populate a metadata-only catalogue.
      let description;
      let source = row;
      try { description = describeStoredDocument(source, definition, { now, verifyContent: false }); }
      catch {
        source = await readDocumentSource(client, { userId, municipalityId, sourceRequestId: row.id,
          attachmentId: `legacy-${row.document_index}-${"0".repeat(64)}` });
        description = describeStoredDocument(source, definition, { now });
      }
      const candidate = metadata(source, description, definition);
      candidate.eligible = isReusableForAnimal(description, definition, animalId);
      if (candidate.eligible) {
        try { await checkOriginalDocument(client, source, description, definition, { userId, municipalityId }, now); }
        catch { candidate.eligible = false; candidate.state = DocumentReuseState.UNAVAILABLE; }
      }
      if (!candidates.has(definition.id) || candidate.eligible) candidates.set(definition.id, candidate);
    } catch { /* Unreadable or unsupported historical files cannot become reuse candidates. */ }
  }
  return [...candidates.values()];
}

export async function readReusableDocument(client, { userId, municipalityId, animalId, sourceRequestId, attachmentId, hash, settings }) {
  const source = await readDocumentSource(client, { userId, municipalityId, sourceRequestId, attachmentId });
  const document = source.document;
  const configured = (settings?.documentTypes || []).find((definition) => definition.id === document.documentId)
    || requestDocumentDefinitions(settings, source.request_type).find((definition) => definition.id === document.documentId);
  const definition = document.documentId === PHOTO_DEFINITION.id ? PHOTO_DEFINITION : canonicalDocumentDefinition(configured || {});
  const description = describeStoredDocument(source, definition);
  if (description.attachmentId !== attachmentId || description.hash !== hash
    || ((definition.reuseScope === DocumentReuseScope.ANIMAL || description.proofValid && document.reuseScope === DocumentReuseScope.ANIMAL)
      && description.animalId !== animalId)) throw documentError("Documento indisponível para este contexto.", 404);
  return { bytes: description.content.bytes, contentType: description.content.contentType,
    fileName: String(document.fileName || "documento").replace(/[\r\n\\/]/g, "_").slice(0, 180) };
}
