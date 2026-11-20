import { useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { COMPLAINT_PHOTO_IDS, COMPLAINT_PHOTO_MAX_MB } from "../../../shared/complaint-photo-contract.js";
import { prepareComplaintPhoto } from "./complaint-photo";
import type { ComplaintPhoto } from "./complaint-photo";

interface ComplaintPhotoPickerProps {
  photos: ComplaintPhoto[];
  onChange: (photos: ComplaintPhoto[]) => void;
  preparing: boolean;
  onPreparingChange: (preparing: boolean) => void;
  disabled: boolean;
}

export function ComplaintPhotoPicker({ photos, onChange, preparing, onPreparingChange, disabled }: ComplaintPhotoPickerProps) {
  const headingId = useId();
  const hintId = useId();
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const processing = useRef(false);
  const [error, setError] = useState("");
  const availableIds = COMPLAINT_PHOTO_IDS.filter((id) => photos.every((photo) => photo.documentId !== id));
  const controlsDisabled = disabled || preparing || availableIds.length === 0;

  async function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length || disabled || processing.current) return;
    if (files.length > availableIds.length) {
      setError(`Adicione até ${COMPLAINT_PHOTO_IDS.length} fotos no total.`);
      return;
    }
    processing.current = true;
    onPreparingChange(true);
    setError("");
    try {
      const added: ComplaintPhoto[] = [];
      const errors: string[] = [];
      for (const [index, file] of files.entries()) {
        try {
          added.push(await prepareComplaintPhoto(file, availableIds[index]));
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : "Não foi possível preparar a foto.";
          errors.push(`${file.name || "Foto"} — ${message}`);
        }
      }
      if (added.length) onChange([...photos, ...added]);
      setError(errors.join(" "));
    } finally {
      processing.current = false;
      onPreparingChange(false);
    }
  }

  function removePhoto(documentId: string) {
    setError("");
    onChange(photos.filter((photo) => photo.documentId !== documentId));
  }

  return (
    <section className="form-sub-card" aria-labelledby={headingId} aria-busy={preparing}>
      <h3 id={headingId} className="form-sub-card-title">Fotos da ocorrência</h3>
      <p id={hintId} className="form-hint">Até {COMPLAINT_PHOTO_IDS.length} fotos opcionais, com até {COMPLAINT_PHOTO_MAX_MB} MB por foto.</p>
      <div className="complaint-photo-actions">
        <button type="button" className="ghost-button" aria-describedby={hintId} onClick={() => gallery.current?.click()} disabled={controlsDisabled}>
          <ImagePlus size={16} aria-hidden="true" /> Adicionar fotos
        </button>
        <button type="button" className="ghost-button" onClick={() => camera.current?.click()} disabled={controlsDisabled}>
          <Camera size={16} aria-hidden="true" /> Tirar foto
        </button>
        <input ref={gallery} type="file" accept="image/*" multiple hidden disabled={controlsDisabled} onChange={choosePhotos} />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden disabled={controlsDisabled} onChange={choosePhotos} />
      </div>
      {preparing && <p className="form-hint" role="status">Preparando fotos...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {photos.length > 0 && (
        <ul className="complaint-photo-list" aria-label="Fotos selecionadas">
          {photos.map((photo, index) => (
            <li key={photo.documentId} className="complaint-photo-item">
              <img src={photo.dataUrl} alt={`Foto da ocorrência ${index + 1}`} />
              <button type="button" className="ghost-button complaint-photo-remove" aria-label={`Remover foto ${index + 1}`} onClick={() => removePhoto(photo.documentId)} disabled={disabled || preparing}>
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
