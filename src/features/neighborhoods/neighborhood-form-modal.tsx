import { useId } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/button";
import { ConfigDialogBackdrop } from "../../components/config-dialog";
import { ConfigActiveToggle, ConfigField, ModalHeader, configFieldStyle, configTextareaStyle } from "../../components/ui";

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
  const title = isEditing ? "Editar bairro" : "Criar bairros";
  const errorId = useId();
  return (
    <ConfigDialogBackdrop>
      <form className="config-modal compact config-environment-modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <ModalHeader appearance="config" title={title} onClose={onClose} />
        {isEditing && (
          <div className="config-modal-options">
            <ConfigActiveToggle checked={form.active} onChange={(checked) => onChange({ active: checked })} />
          </div>
        )}
        {isEditing ? (
          <ConfigField
            label="Nome"
            value={form.name}
            placeholder="Ex: Pinheirinho"
            invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(value) => onChange({ name: value })}
          />
        ) : (
          <label className={configFieldStyle}>
            <span>Bairros (um por linha)</span>
            <textarea
              data-ui-input=""
              className={`${configTextareaStyle} tw:resize-y`}
              rows={8}
              value={form.names}
              placeholder={"Centro\nPinheirinho\nSanta Bárbara"}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => onChange({ names: event.target.value })}
            />
          </label>
        )}
        {error && <small id={errorId} className="field-error-message" role="alert">{error}</small>}
        <div className="form-actions">
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </ConfigDialogBackdrop>
  );
}
