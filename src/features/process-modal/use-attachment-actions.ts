import { useState } from "react";
import { DocumentReviewStatus, MAX_REQUEST_DOCUMENTS, MAX_REQUEST_JSON_BYTES } from "../../../shared/document-reuse-contract.js";
import { downloadProcessFile, prepareProcessDocumentPreview } from "./process-document-preview";
import type { AnyRecord } from "../../types";
import { readFileAsDataUrl } from "../../utils";
import { buildDocumentReviewDecision } from "../registered-animals/document-review-decisions";
import type { AttachmentRow } from "./attachment-rows";

type UpdateDocuments = (request: AnyRecord, patch: AnyRecord, note: string) => Promise<boolean>;

// What the attachments tab does with a document: open it, download it, approve it, send it back for correction, attach evidence.
export function useAttachmentActions(request: AnyRecord, municipality: AnyRecord | null, updateDocuments?: UpdateDocuments) {
  const [preview, setPreview] = useState<AnyRecord | null>(null);
  const [busyId, setBusyId] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [error, setError] = useState("");

  async function run<T>(row: AttachmentRow, task: () => Promise<T>) {
    if (busyId || uploadingEvidence) return;
    setBusyId(row.id);
    setError("");
    try { return await task(); } finally { setBusyId(""); }
  }

  const open = (row: AttachmentRow) => run(row, async () => {
    try {
      setPreview(await prepareProcessDocumentPreview(row, request, municipality));
    } catch {
      setPreview({ documentName: "Prévia indisponível", fileName: row.title || "documento", fileType: "", dataUrl: "" });
    }
  });

  const save = (row: AttachmentRow) => run(row, async () => {
    try {
      const prepared = await prepareProcessDocumentPreview(row, request, municipality);
      if (!prepared?.dataUrl) throw new Error("Documento indisponível.");
      downloadProcessFile(prepared.dataUrl, prepared.fileName || row.fileName || "documento");
    } catch {
      setError("Não foi possível baixar o documento agora. Tente novamente.");
    }
  });

  const approve = (row: AttachmentRow) => run(row, async () => updateDocuments?.(request,
    { documentReviews: [buildDocumentReviewDecision(row.document?.attachmentId, DocumentReviewStatus.APPROVED)] }, `Documento deferido: ${row.title}`));

  const reject = (row: AttachmentRow, note: string) => run(row, async () => updateDocuments?.(request,
    { documentReviews: [buildDocumentReviewDecision(row.document?.attachmentId, DocumentReviewStatus.REJECTED, note)] }, `Documento indeferido (${row.title}). ${note}`));

  async function attachEvidence(files: File[]) {
    if (busyId || uploadingEvidence) return;
    if (files.length + (request.documents?.length || 0) > MAX_REQUEST_DOCUMENTS
      || files.reduce((bytes, file) => bytes + Math.ceil(file.size / 3) * 4, 0) >= MAX_REQUEST_JSON_BYTES) {
      setError("Os arquivos ultrapassam o limite de anexos do processo.");
      return;
    }
    setUploadingEvidence(true);
    setError("");
    try {
      const evidence = await Promise.all(files.map(async (file) => ({ documentId: `evidencia-${crypto.randomUUID()}`,
        fileName: file.name, fileType: file.type, dataUrl: await readFileAsDataUrl(file) })));
      if (!(await updateDocuments?.(request, { documentEvidence: evidence }, `Documentos complementares anexados: ${files.map((file) => file.name).join(", ")}`))) {
        setError("Não foi possível anexar os arquivos. Tente novamente.");
      }
    } catch {
      setError("Não foi possível ler os arquivos escolhidos.");
    } finally {
      setUploadingEvidence(false);
    }
  }

  return { preview, closePreview: () => setPreview(null), busyId, uploadingEvidence, error, open, save, approve, reject, attachEvidence };
}
