import { useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { MUNICIPALITY_IMAGE_TYPES, prepareMunicipalityImage } from "./municipality-image";

interface MunicipalityImageFieldProps {
  label: string;
  value: string;
  onChange: (image: string) => void;
}

// The picker of a brasão or a logo. The file input comes first in the label, so clicking the image picks another one; only the
// button removes it. A chosen image is fitted and checked before it reaches the form, and a refused one says why under the box.
export function MunicipalityImageField({ label, value, onChange }: MunicipalityImageFieldProps) {
  const [error, setError] = useState("");

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    prepareMunicipalityImage(file).then(onChange, (problem: Error) => setError(problem.message));
  }

  return (
    <div className="field">
      <span>{label}</span>
      <label className="brasao-upload-label">
        <input type="file" accept={MUNICIPALITY_IMAGE_TYPES.join(",")} style={{ display: "none" }} onChange={choose} />
        {value ? (
          <div className="brasao-preview-wrap">
            <img src={value} alt={label} className="brasao-preview-img" />
            <button type="button" className="brasao-remove-btn" onClick={() => onChange("")} aria-label={`Remover ${label.toLowerCase()}`}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="brasao-dropzone">
            <ImagePlus size={22} strokeWidth={1.4} />
            <span>Clique para selecionar imagem</span>
            <small>PNG, JPG ou WEBP</small>
          </div>
        )}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
