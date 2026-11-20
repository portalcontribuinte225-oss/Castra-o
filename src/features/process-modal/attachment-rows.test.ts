import { describe, expect, it } from "vitest";
import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";
import { AttachmentState, attachmentDescription, buildAttachmentRows, canReviewAttachment, isBlockingAttachment, isPendingAttachment } from "./attachment-rows";

const requestDocument = { kind: "request", label: "Requerimento municipal", protocol: "123/2026" };

describe("buildAttachmentRows", () => {
  it("lists the generated request, identification photo, configured documents and extra files in review order", () => {
    const rows = buildAttachmentRows({
      requestDocument,
      documentTypes: [{ id: "identity", name: "Identidade" }, { id: "address", name: "Comprovante", required: false }],
      uploads: [
        { documentId: "evidencia-1", attachmentId: "evidence-upload", documentName: "Evidência", fileName: "vistoria.pdf", status: DocumentReviewStatus.ATTACHED },
        { documentId: "identity", attachmentId: "identity-upload", fileName: "rg.pdf", status: DocumentReviewStatus.ATTACHED },
        { documentId: "animal_photo", fileName: "animal.png" },
      ],
    });

    expect(rows.map(({ title, state, available }) => [title, state, available])).toEqual([
      ["Requerimento municipal", AttachmentState.SYSTEM, true],
      ["Foto de registro animal", AttachmentState.INFO, true],
      ["Identidade", AttachmentState.PENDING, true],
      ["Comprovante", AttachmentState.MISSING, false],
      ["Evidência", AttachmentState.INFO, true],
    ]);
    expect(rows[0].fileName).toBe("Requerimento municipal 123/2026.pdf");
    expect(rows.filter(isBlockingAttachment).map(({ id }) => id)).toEqual(["identity-upload"]);
    expect(rows.filter(canReviewAttachment).map(({ id }) => id)).toEqual(["identity-upload"]);
  });

  it("allows review of optional uploads and blocks scheduling only on unresolved required documents", () => {
    const rows = buildAttachmentRows({
      requestDocument,
      documentTypes: [
        { id: "identity", name: "Identidade" },
        { id: "address", name: "Comprovante" },
        { id: "consent", name: "Termo" },
        { id: "optional", name: "Complemento", required: false },
      ],
      uploads: [
        { documentId: "identity", attachmentId: "accepted", status: DocumentReviewStatus.APPROVED },
        { documentId: "address", attachmentId: "adjustment", status: DocumentReviewStatus.REJECTED, review: { note: "Envie uma foto legível." } },
        { documentId: "optional", attachmentId: "extra", status: DocumentReviewStatus.ATTACHED },
      ],
    });

    expect(rows.filter(isBlockingAttachment).map(({ title }) => title)).toEqual(["Comprovante", "Termo"]);
    expect(rows.filter(isPendingAttachment).map(({ title }) => title)).toEqual(["Comprovante", "Termo", "Complemento"]);
    expect(rows.filter(canReviewAttachment).map(({ id }) => id)).toEqual(["adjustment", "extra"]);
    expect(attachmentDescription(rows[2])).toBe("Envie uma foto legível.");
  });

  it("keeps unconfigured uploads reviewable and counts a rejected optional document as reviewed", () => {
    const rows = buildAttachmentRows({
      requestDocument,
      documentTypes: [],
      uploads: [
        { documentId: "address", attachmentId: "old-address", documentName: "Comprovante", status: DocumentReviewStatus.ATTACHED },
        { documentId: "extra", attachmentId: "rejected-extra", documentName: "Complemento", status: DocumentReviewStatus.REJECTED },
        { documentId: "old-evidence", attachmentId: "evidence-upload", documentName: "Evidência da apuração" },
      ],
    });

    expect(rows.filter(canReviewAttachment).map(({ id }) => id)).toEqual(["old-address", "rejected-extra"]);
    expect(rows.filter(isPendingAttachment).map(({ id }) => id)).toEqual(["old-address"]);
    expect(rows.some(isBlockingAttachment)).toBe(false);
  });
});
