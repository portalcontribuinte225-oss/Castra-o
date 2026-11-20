import React from "react";
import { secretPreview } from "../../shared/secret-preview-contract.js";
import { Button } from "./button";
import { integrationActionFieldStyle } from "./integration-card";
import { ConfigField } from "./ui";

const MASK = "•";
const PREVIEW_MASK_LENGTH = 24;
const UNKNOWN_PREVIEW_MASK_LENGTH = 32;

interface SavedSecretFieldProps {
  label: string;
  placeholder: string;
  // A secret is stored and nothing new was typed: the field shows its start and the rest masked.
  saved: boolean;
  preview: string;
  value: string;
  onChange: (value: string) => void;
  // Saving and removing never show together.
  showSave: boolean;
  saveLabel: string;
  onSave: () => void;
  saveDisabled?: boolean;
  removeLabel: string;
  removeNote: string;
  confirming: boolean;
  onConfirmingChange: (confirming: boolean) => void;
  onRemove: () => void;
  removeDisabled?: boolean;
}

// The one way every integration shows a saved secret: start visible, rest masked, removal asks for confirmation.
export function SavedSecretField({
  label, placeholder, saved, preview, value, onChange, showSave, saveLabel, onSave, saveDisabled = false,
  removeLabel, removeNote, confirming, onConfirmingChange, onRemove, removeDisabled = false,
}: SavedSecretFieldProps) {
  const masked = preview ? `${preview}${MASK.repeat(PREVIEW_MASK_LENGTH)}` : MASK.repeat(UNKNOWN_PREVIEW_MASK_LENGTH);
  return (
    <>
      <div className={integrationActionFieldStyle}>
        <ConfigField
          label={label}
          type={saved ? "text" : "password"}
          value={saved ? masked : value}
          readOnly={saved}
          autoComplete="new-password"
          placeholder={placeholder}
          onChange={onChange}
        />
        {showSave ? (
          <Button onClick={onSave} disabled={saveDisabled}>{saveLabel}</Button>
        ) : confirming ? (
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button variant="danger" onClick={onRemove}>Confirmar</Button>
            <Button variant="outline" onClick={() => onConfirmingChange(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => onConfirmingChange(true)} disabled={removeDisabled}>{removeLabel}</Button>
        )}
      </div>
      {value && <p className="whatsapp-note">Começa com <code>{secretPreview(value)}</code>…</p>}
      {confirming && !showSave && <p className="whatsapp-note">{removeNote}</p>}
    </>
  );
}
