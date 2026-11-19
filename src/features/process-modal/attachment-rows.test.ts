import { describe, expect, it } from "vitest";
import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";
import { AttachmentState, attachmentDescription, buildAttachmentRows, canReviewAttachment, isBlockingAttachment } from "./attachment-rows";

const requestDocument = { kind: "request", label: "Requerimento municipal", protocol: "123/2026" };

describe("buildAttachmentRows", () => {
  it("lists the generated request, identification photo, configured documents and extra files in review order", () => {
    const rows = buildAttachmentRows({
      requestDocument,
      documentTypes: [{ id: "identity", name: "Identidade" }, { id: "address", name: "Comprovante", required: false }],
      uploads: [
        { documentId: "evidencia-1", documentName: "Evidência", fileName: "vistoria.pdf", status: DocumentReviewStatus.APPROVED },
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

  it("blocks only unresolved required documents and shows the reason for a requested adjustment", () => {
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
    expect(attachmentDescription(rows[2])).toBe("Ajuste solicitado: Envie uma foto legível.");
    expect(canReviewAttachment(rows[2])).toBe(true);
    expect(canReviewAttachment(rows[3])).toBe(false);
  });
});
