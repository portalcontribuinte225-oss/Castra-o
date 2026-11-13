import { randomUUID } from "node:crypto";
import { DocumentReviewStatus, MAX_REQUEST_DOCUMENTS } from "../../../../shared/document-reuse-contract.js";
import { isInternalUser } from "../../tenant.js";
import { readDocumentSource } from "../../repositories/document-sources.js";
import { assertMaterializedRequestSize, decodeDocumentContent, documentError } from "./document-content.js";
import { PHOTO_DEFINITION, canonicalDocumentDefinition, requestDocumentDefinitions, resolveDocumentRequestType } from "./document-policy.js";
import { signDocumentReceipt } from "./document-provenance.js";
import { describeStoredDocument, isReusableForAnimal } from "./stored-document.js";
import { checkOriginalDocument } from "./document-catalog.js";
import { configsAllowStep } from "../../../../shared/notification-contract.js";
import { isProcedureRequest } from "../../../../shared/request-contract.js";

export function definitionsForRequest(settings, body) {
  return [...requestDocumentDefinitions(settings, body), PHOTO_DEFINITION];
}

export function createReceivedDocument(upload, definition, { requestId, ownerUserId, municipalityId, animalIds, now = new Date(), internalEvidence = false }) {
  const content = decodeDocumentContent(upload, definition);
  const attachmentId = randomUUID();
  const receivedAt = now.toISOString();
  const declaredAnimalId = typeof upload.animalId === "string" && animalIds.includes(upload.animalId) ? upload.animalId : null;
  const animalId = declaredAnimalId || (animalIds.length === 1 ? animalIds[0] : null);
  const document = { attachmentId, requestId, ownerUserId: ownerUserId || null, municipalityId, documentId: definition.id,
    documentName: definition.name || "Documento", reuseScope: definition.reuseScope, animalId,
    fileName: String(upload.fileName || "documento").replace(/[\r\n\\/]/g, "_").slice(0, 180),
    fileType: content.contentType, fileSize: content.size, dataUrl: content.dataUrl, hash: content.hash,
    receivedAt, status: DocumentReviewStatus.ATTACHED, internalEvidence,
    origin: { requestId, attachmentId, receivedAt, ownerUserId: ownerUserId || null, municipalityId } };
  return { ...document, receipt: signDocumentReceipt(document) };
}

export async function prepareRequestDocuments(client, { body, user, tutorId, municipalityId, settings, requestId, animalIds = [], now = new Date() }) {
  const uploads = body.documents === undefined ? [] : body.documents;
  const references = body.reusedDocuments === undefined ? [] : body.reusedDocuments;
  if (!Array.isArray(uploads) || !Array.isArray(references) || uploads.length + references.length > MAX_REQUEST_DOCUMENTS) throw documentError("Quantidade ou formato dos anexos inválido.");
  const definitions = definitionsForRequest(settings, body);
  const documents = [];
  const seen = new Set();
  for (const reference of [...references].sort((a, b) => String(a?.sourceRequestId).localeCompare(String(b?.sourceRequestId)))) {
    if (user?.role !== "tutor" || !tutorId || user.id !== tutorId || animalIds.length !== 1) throw documentError("Entre na conta proprietária para reaproveitar documentos.", 403);
    const source = await readDocumentSource(client, { ...reference, userId: tutorId, municipalityId, lock: true });
    const definition = definitions.find((item) => item.id === source.document?.documentId);
    if (!definition) throw documentError("Este documento não pertence aos requisitos atuais.");
    if (seen.has(definition.id)) throw documentError("Selecione apenas um arquivo por tipo de documento.");
    const description = describeStoredDocument(source, definition, { now });
    if (description.attachmentId !== reference.attachmentId || description.hash !== reference.hash
      || !isReusableForAnimal(description, definition, animalIds[0])) throw documentError("Documento vencido ou incompatível. Anexe um arquivo atualizado.");
    await checkOriginalDocument(client, source, description, definition, { userId: tutorId, municipalityId, lock: true }, now);
    const attachmentId = randomUUID();
    const document = { attachmentId, requestId, ownerUserId: tutorId, municipalityId, documentId: definition.id,
      documentName: definition.name || source.document.documentName, reuseScope: definition.reuseScope, animalId: description.animalId,
      fileName: source.document.fileName || "documento", fileType: description.content.contentType, fileSize: description.content.size,
      dataUrl: description.content.dataUrl, hash: description.hash, receivedAt: description.receivedAt, origin: description.origin,
      status: description.status, ...(description.status === DocumentReviewStatus.APPROVED ? { review: source.document.review } : {}) };
    documents.push({ ...document, receipt: signDocumentReceipt(document) });
    seen.add(definition.id);
    assertMaterializedRequestSize({ ...body, documents });
  }
  for (const upload of uploads) {
    if (!upload || typeof upload !== "object" || seen.has(upload.documentId)) throw documentError("Anexo duplicado ou inválido.");
    let definition = definitions.find((item) => item.id === upload.documentId);
    const internalEvidence = !definition && isInternalUser(user) && /^evidencia-/.test(upload.documentId || "");
    if (internalEvidence) definition = canonicalDocumentDefinition({ id: upload.documentId, name: "Evidência da apuração" });
    if (!definition) throw documentError("Tipo de documento não permitido para este pedido.");
    documents.push(createReceivedDocument(upload, definition, { requestId, ownerUserId: tutorId, municipalityId, animalIds, now, internalEvidence }));
    seen.add(definition.id);
    assertMaterializedRequestSize({ ...body, documents });
  }
  const identificationId = body.workflow_data?.identificationTypeId || body.workflowData?.identificationTypeId;
  const identification = settings.identificationTypes?.find((item) => item.id === identificationId);
  const requestType = resolveDocumentRequestType(settings, body);
  const publicProcedure = !isInternalUser(user) && isProcedureRequest(body.request_type ?? body.requestType ?? body.requestTypeId ?? body.type);
  if (publicProcedure && configsAllowStep([requestType, identification], "stepDocuments")) {
    if (body.declarationAccepted !== true) throw documentError("Leia e aceite a declaração deste novo pedido.");
    for (const definition of definitions.filter((item) => item.required && item.active)) {
      if (!seen.has(definition.id)) throw documentError(`Anexe o documento obrigatório: ${definition.name || "Documento"}.`);
    }
  }
  assertMaterializedRequestSize({ ...body, documents });
  return documents;
}

export { assertMaterializedRequestSize };
