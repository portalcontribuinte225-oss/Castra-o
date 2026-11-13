import type { FormEvent } from "react";
import { ConfigActiveToggle, Field, ModalHeader } from "../../components/ui";
import type { AnyRecord } from "../../types";

export interface BreedFormValues {
  names: string;
  speciesId: string;
  requestTypeIds: string[];
  active: boolean;
}

export interface BreedFormErrors {
  names: string;
  speciesId: string;
  requestTypeIds: string;
}

interface BreedFormModalProps {
  isEditing: boolean;
  form: BreedFormValues;
  errors: BreedFormErrors;
  species: AnyRecord[];
  requestTypes: AnyRecord[];
  onChange: (patch: Partial<BreedFormValues>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

export function BreedFormModal({ isEditing, form, errors, species, requestTypes, onChange, onSubmit, onClose }: BreedFormModalProps) {
  function toggleRequestType(requestTypeId: string) {
    onChange({
      requestTypeIds: form.requestTypeIds.includes(requestTypeId)
        ? form.requestTypeIds.filter((id) => id !== requestTypeId)
        : [...form.requestTypeIds, requestTypeId],
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="config-modal compact config-environment-modal" onSubmit={onSubmit}>
        <ModalHeader title={isEditing ? "Editar raça" : "Criar raças"} onClose={onClose} />
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
        <div className="document-button-field">
          <span>Tipos de solicitação</span>
          <div className="document-button-grid">
            {requestTypes.map((type) => (
              <button
                className={form.requestTypeIds.includes(type.id) ? "document-pill selected" : "document-pill"}
                key={type.id}
                type="button"
                onClick={() => toggleRequestType(type.id)}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>
        {errors.requestTypeIds && <small className="field-error-message">{errors.requestTypeIds}</small>}
        {isEditing ? (
          <Field
            label="Nome"
            value={form.names}
            placeholder="Ex: Poodle"
            invalid={Boolean(errors.names)}
            onChange={(value) => onChange({ names: value })}
          />
        ) : (
          <label className={`field${errors.names ? " invalid" : ""}`}>
            <span>Raças (uma por linha)</span>
            <textarea
              rows={6}
              value={form.names}
              placeholder={"Poodle\nSiamês"}
              onChange={(event) => onChange({ names: event.target.value })}
            />
          </label>
        )}
        {errors.names && <small className="field-error-message">{errors.names}</small>}
        <div className="form-actions">
          <button className="primary-action" type="submit">Salvar</button>
        </div>
      </form>
    </div>
  );
}
