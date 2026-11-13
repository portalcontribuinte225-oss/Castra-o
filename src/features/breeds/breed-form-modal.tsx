import type { FormEvent } from "react";
import { ConfigActiveToggle, Field, ModalHeader } from "../../components/ui";
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
  species: AnyRecord[];
  onChange: (patch: Partial<BreedFormValues>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

export function BreedFormModal({ isEditing, form, errors, species, onChange, onSubmit, onClose }: BreedFormModalProps) {
  return (
    <div className="modal-backdrop">
      <form className="config-modal compact config-environment-modal" onSubmit={onSubmit}>
        <ModalHeader title={isEditing ? "Editar raça" : "Criar raça"} onClose={onClose} />
        <div className="config-modal-options">
          <ConfigActiveToggle checked={form.active} onChange={(checked) => onChange({ active: checked })} />
        </div>
        <label className={`field${errors.speciesId ? " invalid" : ""}`}>
          <span>Espécie</span>
          <select value={form.speciesId} onChange={(event) => onChange({ speciesId: event.target.value })}>
            <option value="">Selecione</option>
            {species.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {errors.speciesId && <small className="field-error-message">{errors.speciesId}</small>}
        <Field
          label="Nome"
          value={form.name}
          placeholder="Ex: Poodle"
          invalid={Boolean(errors.name)}
          onChange={(value) => onChange({ name: value })}
        />
        {errors.name && <small className="field-error-message">{errors.name}</small>}
        <div className="form-actions">
          <button className="primary-action" type="submit">Salvar</button>
        </div>
      </form>
    </div>
  );
}
