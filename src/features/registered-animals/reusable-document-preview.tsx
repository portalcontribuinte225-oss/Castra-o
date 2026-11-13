import React, { useEffect, useState } from "react";
import { api } from "../../api";
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
  return <div className="modal-backdrop"><section className="document-preview-modal" role="dialog" aria-modal="true" aria-label={candidate.fileName}><div className="tutor-auth-heading"><h3>{candidate.documentName}</h3><button type="button" className="ghost-button" onClick={onClose}>Fechar</button></div>{error ? <p role="alert" className="form-error">{error}</p> : !url ? <p role="status">Carregando arquivo...</p> : <>{candidate.fileType.startsWith("image/") ? <img className="reused-document-image" src={url} alt={candidate.documentName} /> : <iframe className="reused-document-frame" src={url} sandbox="" title={candidate.documentName} />}<a className="ghost-button" href={url} download={candidate.fileName}>Baixar arquivo</a></>}</section></div>;
}
