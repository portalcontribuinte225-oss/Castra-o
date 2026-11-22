import type { AnyRecord } from "../../types";
import { getDataUrlMimeType, getDocumentPreviewSource, uint8ArrayToDataUrl } from "../../utils";
import { createRequestDocumentPdf } from "../municipal-documents/request-document-pdf";
import { AttachmentKind } from "./attachment-rows";
import type { AttachmentRow } from "./attachment-rows";

// What a row of the documents list opens: the document the system generates for the request, or the file attached.
export async function prepareProcessDocumentPreview(row: AttachmentRow, request: AnyRecord, municipality: AnyRecord | null): Promise<AnyRecord> {
  if (row.kind === AttachmentKind.REQUEST_DOCUMENT) {
    const { name, fileName, bytes } = await createRequestDocumentPdf(request, municipality);
    return { documentName: name, fileName, fileType: "application/pdf", dataUrl: uint8ArrayToDataUrl(bytes, "application/pdf") };
  }
  const document = row.document || {};
  const dataUrl = getDocumentPreviewSource(document);
  return {
    ...document,
    documentName: document.documentName || document.name || "Documento anexado",
    fileName: document.fileName || document.name || "Arquivo anexado",
    fileType: document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl),
    dataUrl,
  };
}
