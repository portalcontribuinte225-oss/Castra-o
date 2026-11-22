import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { AnyRecord } from "../types";
import { getDataUrlMimeType, getDocumentPreviewSource } from "../utils";
import { CloseButton } from "./close-button";
import { useModalFocus } from "./modal-focus";
import { EmptyState, ModalHeader } from "./ui";

// Shows an image or a PDF over the page. Outside the staff area (`external`) it has its own header and handles Escape itself.
export function DocumentPreviewModal({ document, onClose, external = false, returnFocus }: AnyRecord) {
  const previewLayer = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(previewLayer, !external, returnFocus);
  const dataUrl = getDocumentPreviewSource(document);
  const mimeType = document.fileType || document.type || document.mimeType || getDataUrlMimeType(dataUrl);
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const canPreview = Boolean(dataUrl) && (isImage || isPdf);
  const title = document.documentName || document.fileName;

  useEffect(() => {
    if (!external) return;
    const trigger = window.document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, [external]);

  const preview = (
    <div className="modal-backdrop" ref={previewLayer} data-managed-dialog={external ? undefined : ""}>
      <div
        ref={dialogRef}
        className="document-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Prévia do documento"}
        onKeyDown={external ? (event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } } : undefined}
      >
        {external ? (
          <header className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:p-2">
            <div className="tw:min-w-0 tw:break-words">
              <h2 className="tw:m-0 tw:text-lg tw:font-semibold tw:text-ui-ink">{title}</h2>
              {document.fileName !== title && <p className="tw:m-0 tw:text-sm tw:text-ui-muted">{document.fileName}</p>}
            </div>
            <CloseButton onClick={onClose} />
          </header>
        ) : <ModalHeader appearance="config" title={title} subtitle={document.fileName !== title ? document.fileName : undefined} onClose={onClose} />}
        <div className="document-preview-frame">
          {isImage && <img src={dataUrl} alt={document.documentName || document.fileName} />}
          {isPdf && (
            <object title={document.fileName} data={dataUrl} type="application/pdf" tabIndex={external ? undefined : 0}>
              <embed src={dataUrl} type="application/pdf" />
            </object>
          )}
          {!canPreview && (
            <EmptyState title="Prévia indisponível" text="Este anexo não possui arquivo de prévia salvo em formato compatível." />
          )}
        </div>
      </div>
    </div>
  );
  return external || typeof window === "undefined" ? preview : createPortal(preview, window.document.body);
}
