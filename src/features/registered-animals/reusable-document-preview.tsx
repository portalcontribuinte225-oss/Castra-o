import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { CloseButton } from "../../components/close-button";
import type { ReusableDocumentCandidate } from "./registered-animal-types";

function useReusableDocumentPreview(animalId: string, candidate: ReusableDocumentCandidate) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    api.getReusedDocumentContent(animalId, candidate.reuseRef).then((blob: Blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setError("Não foi possível abrir este arquivo. Atualize o contexto ou procure o atendimento."); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [animalId, candidate.attachmentId, candidate.reuseRef.hash]);
  return { url, error };
}

export function ReusableDocumentPreview({ animalId, candidate, onClose }: { animalId: string; candidate: ReusableDocumentCandidate; onClose: () => void }) {
  const { url, error } = useReusableDocumentPreview(animalId, candidate);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="document-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={candidate.fileName}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      >
        <header className="tw:flex tw:items-start tw:justify-between tw:gap-3">
          <h2 className="tw:m-0 tw:min-w-0 tw:break-words tw:text-lg tw:font-semibold tw:text-ui-ink">{candidate.documentName}</h2>
          <CloseButton onClick={onClose} />
        </header>
        {error ? <p role="alert" className="form-error">{error}</p> : !url ? <p role="status">Carregando arquivo...</p> : (
          <>
            {candidate.fileType.startsWith("image/")
              ? <img className="reused-document-image" src={url} alt={candidate.documentName} />
              : <iframe className="reused-document-frame" src={url} sandbox="" title={candidate.documentName} />}
            <a className="tw:inline-flex tw:min-h-10 tw:w-fit tw:items-center tw:rounded-full tw:border tw:border-solid tw:border-card-border tw:bg-card-surface tw:px-3.5 tw:font-medium tw:text-ui-text tw:no-underline tw:hover:border-ui-accent tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent" href={url} download={candidate.fileName}>Baixar arquivo</a>
          </>
        )}
      </section>
    </div>
  );
}
