import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { configFieldStyle } from "../../components/ui";
import { MUNICIPALITY_IMAGE_TYPES, prepareMunicipalityImage } from "./municipality-image";

interface MunicipalityImageFieldProps {
  label: string;
  value: string;
  onChange: (image: string) => void;
}

export function MunicipalityImageField({ label, value, onChange }: MunicipalityImageFieldProps) {
  const labelId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => () => {
    selectionVersion.current += 1;
  }, []);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const currentSelection = ++selectionVersion.current;
    setError("");
    try {
      const image = await prepareMunicipalityImage(file);
      if (currentSelection === selectionVersion.current) onChange(image);
    } catch (problem) {
      if (currentSelection === selectionVersion.current) setError((problem as Error).message);
    }
  }

  function removeImage() {
    selectionVersion.current += 1;
    setError("");
    onChange("");
  }

  return (
    <div className={configFieldStyle} role="group" aria-labelledby={labelId}>
      <span id={labelId}>{label}</span>
      <input ref={fileInput} type="file" accept={MUNICIPALITY_IMAGE_TYPES.join(",")} hidden onChange={choose} />
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Card
          as="button"
          className="tw:flex tw:min-h-20 tw:min-w-0 tw:basis-36 tw:grow tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-1.5 tw:px-3 tw:py-2.5 tw:text-sm tw:text-ui-text tw:hover:border-ui-accent tw:hover:bg-card-page tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ui-accent"
          onClick={() => fileInput.current?.click()}
          aria-label={`${value ? "Alterar" : "Selecionar"} ${label.toLowerCase()}`}
        >
          {value ? (
            <img src={value} alt={label} className="tw:size-[52px] tw:rounded-md tw:object-contain" />
          ) : (
            <>
              <ImagePlus size={22} strokeWidth={1.4} aria-hidden="true" />
              <span>Clique para selecionar imagem</span>
              <small className="tw:text-xs tw:text-ui-muted">PNG, JPG ou WEBP</small>
            </>
          )}
        </Card>
        {value && <Button variant="danger" onClick={removeImage} aria-label={`Remover ${label.toLowerCase()}`}>Remover</Button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
