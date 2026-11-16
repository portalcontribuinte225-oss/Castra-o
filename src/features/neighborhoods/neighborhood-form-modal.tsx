import type { FormEvent } from "react";
import { ConfigActiveToggle, Field, ModalHeader } from "../../components/ui";

export interface NeighborhoodFormValues {
  name: string;
  names: string;
  active: boolean;
}

interface NeighborhoodFormModalProps {
  isEditing: boolean;
  form: NeighborhoodFormValues;
  error: string;
  onChange: (patch: Partial<NeighborhoodFormValues>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}

// Editing changes one neighborhood; creating accepts several at once, one per line.
export function NeighborhoodFormModal({ isEditing, form, error, onChange, onSubmit, onClose }: NeighborhoodFormModalProps) {
  return (
    <div className="modal-backdrop">
      <form className="config-modal compact config-environment-modal" onSubmit={onSubmit}>
        <ModalHeader title={isEditing ? "Editar bairro" : "Criar bairros"} onClose={onClose} />
        {isEditing && (
          <div className="config-modal-options">
            <ConfigActiveToggle checked={form.active} onChange={(checked) => onChange({ active: checked })} />
          </div>
        )}
        {isEditing ? (
          <Field label="Nome" value={form.name} placeholder="Ex: Pinheirinho" invalid={Boolean(error)} onChange={(value) => onChange({ name: value })} />
        ) : (
          <label className={`field${error ? " invalid" : ""}`}>
            <span>Bairros (um por linha)</span>
            <textarea rows={8} value={form.names} placeholder={"Centro\nPinheirinho\nSanta Bárbara"} onChange={(event) => onChange({ names: event.target.value })} />
          </label>
        )}
        {error && <small className="field-error-message">{error}</small>}
        <div className="form-actions">
          <button className="primary-action" type="submit">Salvar</button>
        </div>
      </form>
    </div>
  );
}
