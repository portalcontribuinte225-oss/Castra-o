import { useId } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/button";
import { ConfigDialogBackdrop } from "../../components/config-dialog";
import { ConfigActiveToggle, ConfigField, ModalHeader } from "../../components/ui";
import type { AnyRecord } from "../../types";

export interface BreedFormValues {
  name: string;
  speciesId: string;
  active: boolean;
}

export interface BreedFormErrors {
  name: string;
  speciesId: string;
}

interface BreedFormModalProps {
  isEditing: boolean;
  form: BreedFormValues;
  errors: BreedFormErrors;
  saving: boolean;
  saveError: string;
  species: AnyRecord[];
  onChange: (patch: Partial<BreedFormValues>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

export function BreedFormModal({ isEditing, form, errors, saving, saveError, species, onChange, onSubmit, onClose }: BreedFormModalProps) {
  const title = isEditing ? "Editar raça" : "Criar raça";
  const speciesErrorId = useId();
  const nameErrorId = useId();
  return (
    <ConfigDialogBackdrop>
      <form className="config-modal compact config-environment-modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <ModalHeader appearance="config" title={title} onClose={onClose} />
        <div className="config-modal-options">
          <ConfigActiveToggle checked={form.active} onChange={(checked) => onChange({ active: checked })} />
        </div>
        <label className={`field${errors.speciesId ? " invalid" : ""}`}>
          <span>Espécie</span>
          <select
            value={form.speciesId}
            aria-invalid={Boolean(errors.speciesId)}
            aria-describedby={errors.speciesId ? speciesErrorId : undefined}
            onChange={(event) => onChange({ speciesId: event.target.value })}
          >
            <option value="">Selecione</option>
            {species.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {errors.speciesId && <small id={speciesErrorId} className="field-error-message" role="alert">{errors.speciesId}</small>}
        <ConfigField
          label="Nome"
          value={form.name}
          placeholder="Ex: Poodle"
          invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? nameErrorId : undefined}
          onChange={(value) => onChange({ name: value })}
        />
        {errors.name && <small id={nameErrorId} className="field-error-message" role="alert">{errors.name}</small>}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="form-actions">
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </ConfigDialogBackdrop>
  );
}
