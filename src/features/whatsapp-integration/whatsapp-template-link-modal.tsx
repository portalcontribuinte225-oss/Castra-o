import React, { useState } from "react";
import { Button } from "../../components/button";
import { ConfigDialogBackdrop } from "../../components/config-dialog";
import { ModalHeader } from "../../components/ui";
import { LEGACY_DOCUMENTS_REVIEWED } from "../../../shared/notification-contract.js";
import { WHATSAPP_LEGACY_DOCUMENTS_LABEL, isWhatsappNoticeUse, templateFields, whatsappFieldLabels, whatsappUses } from "../../../shared/whatsapp-templates-contract.js";
import {
  fieldsForVariables, firstMissingVariable, templateBodySegments, templatePreview, templateStatusLabel, variableTone,
} from "./whatsapp-template-display";
import type { WhatsappTemplateRow } from "./whatsapp-integration-types";

interface Props {
  row: WhatsappTemplateRow;
  samples: Record<string, string>;
  // Answers "" when saved, or the message to show; an empty `use` goes back to what the template name says.
  onSave: (use: string, fields: string[]) => Promise<string>;
  onClose: () => void;
}

const noticeUses = whatsappUses.filter((use) => isWhatsappNoticeUse(use.key));
const fieldOptions = Object.entries(whatsappFieldLabels);

function VariableChip({ number }: { number: number }) {
  return <span className={`whatsapp-link-var whatsapp-link-var--${variableTone(number)}`}>{`{{${number}}}`}</span>;
}

// The master links a Meta template to a notice and chooses what fills each numbered variable, seeing the text and a preview.
export function WhatsappTemplateLinkModal({ row, samples, onSave, onClose }: Props) {
  const initialUse = row.linkedUse || row.uses.find((key) => isWhatsappNoticeUse(key)) || "";
  const [use, setUse] = useState(initialUse);
  const [fields, setFields] = useState(() => fieldsForVariables(initialUse ? row.fields : [], row.bodyVariables));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const missing = firstMissingVariable(fields);

  function chooseUse(next: string) {
    setUse(next);
    const mapped = next && next === row.linkedUse ? row.fields : templateFields(next);
    setFields(fieldsForVariables(mapped, row.bodyVariables));
  }

  async function save(nextUse: string, nextFields: string[]) {
    setSaving(true);
    setError("");
    const problem = await onSave(nextUse, nextFields);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <ConfigDialogBackdrop>
      <div className="config-modal" role="dialog" aria-modal="true" aria-label={`Configurar ${row.name}`}>
        <ModalHeader appearance="config" title="Configurar template" subtitle={`${row.name} · ${row.language} · ${templateStatusLabel(row.status)}`} onClose={onClose} />
        <div className="whatsapp-link-section">
          <span className="whatsapp-section-label">Texto na Meta</span>
          {row.bodyText ? (
            <p className="whatsapp-link-body">
              {templateBodySegments(row.bodyText).map((segment, index) => (
                segment.kind === "text" ? <React.Fragment key={index}>{segment.text}</React.Fragment> : <VariableChip key={index} number={segment.number} />
              ))}
            </p>
          ) : <p className="whatsapp-note">Sincronize os templates para ver o texto.</p>}
        </div>

        {row.structureReason ? <p className="whatsapp-outside">{row.structureReason}</p> : (
          <>
            <label className="field">
              <span>Qual aviso este template envia?</span>
              <select value={use} onChange={(event) => chooseUse(event.target.value)}>
                <option value="">Escolha o aviso</option>
                {row.linkedUse === LEGACY_DOCUMENTS_REVIEWED && (
                  <option value={LEGACY_DOCUMENTS_REVIEWED}>{WHATSAPP_LEGACY_DOCUMENTS_LABEL}</option>
                )}
                {noticeUses.map((notice) => <option key={notice.key} value={notice.key}>{notice.label}</option>)}
              </select>
            </label>
            {use && fields.length > 0 && (
              <div className="whatsapp-link-section">
                <span className="whatsapp-section-label">O que vai em cada número</span>
                <div className="whatsapp-link-fields">
                  {fields.map((value, index) => (
                    <label className="whatsapp-link-field" key={index}>
                      <VariableChip number={index + 1} />
                      <select aria-label={`O que vai em {{${index + 1}}}`} value={value} onChange={(event) => setFields((current) => current.map((item, position) => (position === index ? event.target.value : item)))}>
                        <option value="">Escolha a variável</option>
                        {fieldOptions.map(([field, label]) => <option key={field} value={field}>{label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {missing > 0 && <small className="field-error-message">{`Escolha o que vai em {{${missing}}}`}</small>}
              </div>
            )}
            {use && row.bodyText && (
              <div className="whatsapp-link-section">
                <span className="whatsapp-section-label">Prévia</span>
                <p className="whatsapp-link-preview">{templatePreview(row.bodyText, fields, samples)}</p>
              </div>
            )}
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          {row.configured && <Button variant="outline" disabled={saving} onClick={() => save("", [])}>Voltar ao padrão do nome</Button>}
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || Boolean(row.structureReason) || !use || missing > 0} onClick={() => save(use, fields)}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </ConfigDialogBackdrop>
  );
}
