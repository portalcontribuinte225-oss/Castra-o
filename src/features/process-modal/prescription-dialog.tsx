import { useId, useState } from "react";
import { MAX_PRESCRIPTION_TEXT, MAX_PROFESSIONAL_TEXT, ProcedureStatus, animalPrescriptionRecords } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
import { ConfigField, configTextareaStyle } from "../../components/ui";
import { displayText } from "../../domain";
import type { AnyRecord } from "../../types";
import { issuedPrescriptions } from "../process-report/process-report";
import { downloadProcessFile } from "./process-document-preview";
import { ProcessDialog } from "./process-dialog";
import { createPrescriptionPdfDocument } from "./prescription-pdf";
import { processAnimalLabel } from "./procedures-tab";
import type { PrescriptionDraft, ProcessAnimal } from "./process-types";

interface PrescriptionDialogProps {
  request: AnyRecord;
  animals: ProcessAnimal[];
  municipality: AnyRecord | null;
  defaultProfessionalName: string;
  readOnly: boolean;
  busy: boolean;
  onSave: (prescriptions: PrescriptionDraft[]) => void;
  onClose: () => void;
}

export function PrescriptionDialog({ request, animals, municipality, defaultProfessionalName, readOnly, busy, onSave, onClose }: PrescriptionDialogProps) {
  const animalHeadingId = useId();
  const [initial] = useState(() => animals.map((animal, animalIndex): PrescriptionDraft => {
    const active = animalPrescriptionRecords(animal).findLast((record) => !record.archived);
    return { animalIndex, requestTypeId: active?.requestTypeId || "", text: active?.text || "",
      professionalName: active?.professionalName || defaultProfessionalName, professionalRegistry: active?.professionalRegistry || "" };
  }));
  const [drafts, setDrafts] = useState(initial);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const records = issuedPrescriptions(animals);
  const changed = drafts.map((draft) => ({ ...draft, text: draft.text.trim(), professionalName: draft.professionalName.trim(), professionalRegistry: draft.professionalRegistry.trim() }))
    .filter((draft, index) => JSON.stringify(draft) !== JSON.stringify(initial[index]) && (draft.text || initial[index].text));
  const valid = changed.length > 0 && changed.every((draft) => !draft.text || Boolean(draft.professionalName && draft.professionalRegistry));
  const disabled = busy || exporting;

  function change(index: number, patch: Partial<PrescriptionDraft>) {
    setDrafts((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));
  }

  async function download(items: typeof records) {
    setError("");
    setExporting(true);
    try {
      const pdf = await createPrescriptionPdfDocument(request, items, municipality);
      downloadProcessFile(pdf.dataUrl, pdf.fileName);
    } catch {
      setError("Não foi possível gerar o PDF das receitas. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ProcessDialog title="Receita unificada" busy={disabled} onClose={onClose}
      actions={!readOnly && <Button disabled={disabled || !valid} onClick={() => onSave(changed)}>{busy ? "Salvando..." : "Salvar receitas"}</Button>}>
      {!readOnly && <p className="prm-dialog-description">Edite as orientações de cada animal em uma única janela.</p>}
      {animals.map((animal, index) => {
        const draft = drafts[index];
        const choices = animal.procedures.filter((item) => item.status !== ProcedureStatus.REMOVED || item.requestTypeId === draft.requestTypeId);
        return (
          <fieldset className="prm-recipe-animal" key={index} disabled={disabled} aria-labelledby={`${animalHeadingId}-${index}`}>
            <h4 id={`${animalHeadingId}-${index}`}>
              {[animal.species, animal.sex, animal.name].map(displayText).filter(Boolean).join(" · ") || processAnimalLabel(animal, index)}
            </h4>
            <label className="prm-field"><span>Procedimento (opcional)</span>
              <select value={draft.requestTypeId} disabled={readOnly} data-dialog-initial-focus={!readOnly && index === 0 ? "" : undefined}
                onChange={(event) => change(index, { requestTypeId: event.target.value })}>
                <option value="">Geral do animal</option>
                {choices.map((item) => <option key={item.requestTypeId} value={item.requestTypeId}>{item.name}</option>)}
              </select>
            </label>
            <label className="prm-field"><span>Orientações</span>
              <textarea data-ui-input="" className={configTextareaStyle} value={draft.text} readOnly={readOnly}
                maxLength={MAX_PRESCRIPTION_TEXT} rows={2} placeholder="Preencha quando houver receita para este animal" onChange={(event) => change(index, { text: event.target.value })} />
            </label>
            {(draft.text || initial[index].text) && <div className="two-column-fields">
              <ConfigField className="prm-field" label="Profissional responsável" value={draft.professionalName} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={readOnly}
                onChange={(value) => change(index, { professionalName: value })} />
              <ConfigField className="prm-field" label="Registro profissional" value={draft.professionalRegistry} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={readOnly}
                onChange={(value) => change(index, { professionalRegistry: value })} />
            </div>}
          </fieldset>
        );
      })}
      {records.length > 0 && (
        <div className="prm-saved-recipes">
          <Button variant="outline" disabled={disabled} onClick={() => void download(records)}>Baixar receitas salvas</Button>
          <ul>
            {records.map((record) => <li key={record.id}>
              <span>{record.subtitle || "Receita registrada"}</span>
              <Button variant="outline" disabled={disabled} onClick={() => void download([record])}>Baixar PDF</Button>
            </li>)}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </ProcessDialog>
  );
}
