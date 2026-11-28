import { useState } from "react";
import { DocumentReviewStatus, MAX_REQUEST_DOCUMENTS, MAX_REQUEST_JSON_BYTES } from "../../../shared/document-reuse-contract.js";
import { downloadProcessFile, prepareProcessDocumentPreview } from "./process-document-preview";
import type { AnyRecord } from "../../types";
import { readFileAsDataUrl } from "../../utils";
import { buildDocumentReviewDecision } from "../registered-animals/document-review-decisions";
import type { AttachmentRow } from "./attachment-rows";
import type { ProcessActionResult } from "./process-types";

type UpdateDocuments = (request: AnyRecord, patch: AnyRecord, note: string) => Promise<ProcessActionResult>;

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

  async function saveDocuments(patch: AnyRecord, note: string, fallback: string) {
    const result = await updateDocuments?.(request, patch, note);
    if (result?.ok === true) return true;
    setError(result?.message || fallback);
    return false;
  }

  function review(row: AttachmentRow, decision: typeof DocumentReviewStatus.APPROVED | typeof DocumentReviewStatus.REJECTED, note = "") {
    return run(row, async () => {
      try {
        const historyNote = decision === DocumentReviewStatus.APPROVED
          ? `Documento deferido: ${row.title}` : `Documento indeferido (${row.title}). ${note}`;
        const documentReviews = [buildDocumentReviewDecision(row.document?.attachmentId, decision, note)];
        return await saveDocuments({ documentReviews }, historyNote, "Não foi possível salvar a decisão sobre o documento.");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Não foi possível salvar a decisão sobre o documento.");
        return false;
      }
    });
  }

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
      await saveDocuments({ documentEvidence: evidence }, `Documentos complementares anexados: ${files.map((file) => file.name).join(", ")}`,
        "Não foi possível anexar os arquivos. Tente novamente.");
    } catch {
      setError("Não foi possível ler os arquivos escolhidos.");
    } finally {
      setUploadingEvidence(false);
    }
  }

  return { preview, closePreview: () => setPreview(null), busyId, uploadingEvidence, error, clearError: () => setError(""), open, save,
    approve: (row: AttachmentRow) => review(row, DocumentReviewStatus.APPROVED),
    reject: (row: AttachmentRow, note: string) => review(row, DocumentReviewStatus.REJECTED, note),
    attachEvidence,
  };
}
