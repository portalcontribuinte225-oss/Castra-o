import { isComplaintPhotoId } from "../../../shared/complaint-photo-contract.js";
import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";
import type { AnyRecord } from "../../types";
import { documentFileName } from "../municipal-documents/municipal-pdf";

// Where a row of the documents list stands in the review.
export enum AttachmentState {
  SYSTEM = "system",
  INFO = "info",
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  MISSING = "missing",
}

// What a row of the documents list is: the document the system generates for the request, or something attached to it.
export enum AttachmentKind {
  REQUEST_DOCUMENT = "request-document",
  PHOTO = "photo",
  ATTACHMENT = "attachment",
  MISSING = "missing",
}

export interface AttachmentRow {
  id: string;
  kind: AttachmentKind;
  title: string;
  fileName: string;
  state: AttachmentState;
  required: boolean;
  available: boolean;
  document?: AnyRecord;
}

const PHOTO_DOCUMENT_ID = "animal_photo";
const PHOTO_DOCUMENT_NAME = "Foto de registro animal";

function isAnimalPhoto(document: AnyRecord) {
  return document.documentId === PHOTO_DOCUMENT_ID || document.documentName === PHOTO_DOCUMENT_NAME;
}

function stateOf(document: AnyRecord): AttachmentState {
  if (isComplaintPhotoId(document.documentId)) return AttachmentState.INFO;
  if (document.internalEvidence || document.documentId?.startsWith?.("evidencia-") || document.documentName === "Evidência da apuração") return AttachmentState.INFO;
  if (document.status === DocumentReviewStatus.APPROVED) return AttachmentState.APPROVED;
  if (document.status === DocumentReviewStatus.REJECTED) return AttachmentState.REJECTED;
  return AttachmentState.PENDING;
}

function fileRow(document: AnyRecord, id: string, title: string, required: boolean): AttachmentRow {
  return { id, kind: AttachmentKind.ATTACHMENT, title, fileName: document.fileName || document.documentName || title, state: stateOf(document), required, available: true, document };
}

// The documents of a request in the order the staff reviews them: the request document, the animal photo, the documents its procedures
// ask for (sent or not) and anything else attached.
export function buildAttachmentRows({ uploads, documentTypes, requestDocument }: { uploads: AnyRecord[]; documentTypes: AnyRecord[]; requestDocument: { label: string; protocol: string } }): AttachmentRow[] {
  const system: AttachmentRow = { id: `requerimento-${requestDocument.protocol || "processo"}`, kind: AttachmentKind.REQUEST_DOCUMENT, title: requestDocument.label,
    fileName: documentFileName(requestDocument.label, requestDocument.protocol), state: AttachmentState.SYSTEM, required: false, available: true };
  const photos: AttachmentRow[] = uploads.filter(isAnimalPhoto).map((photo, index) => ({
    id: photo.attachmentId || `${PHOTO_DOCUMENT_ID}-${index}`, kind: AttachmentKind.PHOTO, title: photo.documentName || PHOTO_DOCUMENT_NAME,
    fileName: photo.fileName || PHOTO_DOCUMENT_NAME, state: AttachmentState.INFO, required: false, available: true, document: photo,
  }));
  const matched = new Set<AnyRecord>();
  const typed = documentTypes.map((type) => {
    const exact = uploads.filter((document) => document.documentId === type.id);
    const candidates = exact.length ? exact : uploads.filter((document) => document.documentName === type.name);
    const uploaded = candidates.find((document) => stateOf(document) === AttachmentState.APPROVED) || candidates[0];
    const required = type.required !== false;
    if (uploaded) {
      matched.add(uploaded);
      return fileRow(uploaded, uploaded.attachmentId || uploaded.documentId || type.id, type.name, required);
    }
    return { id: `missing-${type.id}`, kind: AttachmentKind.MISSING, title: type.name, fileName: type.name, state: AttachmentState.MISSING, required, available: false };
  });
  const extras = uploads
    .filter((document) => !isAnimalPhoto(document) && !matched.has(document))
    .map((document, index) => fileRow(document, document.attachmentId || document.documentId || `extra-${index}`, document.documentName || `Documento ${index + 1}`, false));
  return [system, ...photos, ...typed, ...extras];
}

// A required document that is not approved holds the scheduling of every procedure.
export function isBlockingAttachment(row: AttachmentRow): boolean {
  return row.required && row.state !== AttachmentState.APPROVED;
}

export function isPendingAttachment(row: AttachmentRow): boolean {
  return row.state === AttachmentState.PENDING || isBlockingAttachment(row);
}

export function canReviewAttachment(row: AttachmentRow): boolean {
  return row.available && Boolean(row.document?.attachmentId) && [AttachmentState.PENDING, AttachmentState.REJECTED].includes(row.state);
}

export const attachmentStateLabels: Record<AttachmentState, string> = {
  [AttachmentState.SYSTEM]: "Sistema",
  [AttachmentState.INFO]: "Anexado",
  [AttachmentState.PENDING]: "Aguardando",
  [AttachmentState.APPROVED]: "Deferido",
  [AttachmentState.REJECTED]: "Indeferido",
  [AttachmentState.MISSING]: "Não enviado",
};

// The class the status chip and the row already use for each state.
export const attachmentStateClasses: Record<AttachmentState, string> = {
  [AttachmentState.SYSTEM]: "generated",
  [AttachmentState.INFO]: "generated",
  [AttachmentState.PENDING]: "pending",
  [AttachmentState.APPROVED]: "approved",
  [AttachmentState.REJECTED]: "rejected",
  [AttachmentState.MISSING]: "missing",
};

export function attachmentDescription(row: AttachmentRow): string {
  if (row.state === AttachmentState.SYSTEM) return "Gerado automaticamente pelo sistema";
  if (row.state === AttachmentState.INFO) {
    if (isComplaintPhotoId(row.document?.documentId)) return "Foto enviada com a denúncia";
    return row.kind === AttachmentKind.PHOTO ? "Foto de identificação do animal" : "Evidência anexada pela equipe";
  }
  if (row.state === AttachmentState.MISSING) return row.required ? "Documento obrigatório não enviado" : "Documento não enviado";
  if (row.state === AttachmentState.REJECTED) return row.document?.review?.note || "Indeferido na conferência";
  if (row.state === AttachmentState.APPROVED) return row.document?.review ? "Deferido na conferência" : row.document?.provider ? "Aprovado pela análise automática" : "Documento disponível";
  return row.required ? "Conferência obrigatória para o agendamento" : "Documento complementar";
}
