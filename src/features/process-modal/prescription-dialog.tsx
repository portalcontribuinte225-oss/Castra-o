import { useId, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { MAX_PRESCRIPTION_TEXT, MAX_PROFESSIONAL_TEXT } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { useModalFocus } from "../../components/modal-focus";
import { ConfigField, configFieldStyle, configTextareaStyle } from "../../components/ui";
import { displayText } from "../../domain";
import type { AnyRecord } from "../../types";
import { printHtmlViaIframe } from "../process-report/print-html";
import { buildPrescriptionPrintHtml } from "./prescription-print";

export interface Prescription {
  text: string;
  professionalName: string;
  professionalRegistry: string;
}

interface PrescriptionDialogProps {
  request: AnyRecord;
  animal: AnyRecord;
  procedure: AnyRecord;
  municipality: AnyRecord;
  defaultProfessionalName: string;
  // A prescription that was saved can still be printed when the procedure no longer accepts a new one.
  canSave: boolean;
  busy: boolean;
  onSave: (prescription: Prescription) => Promise<boolean>;
  onClose: () => void;
}

// The prescription of one procedure of one animal: written and signed by the professional, printed or saved as PDF. It never changes the
// status of the procedure.
export function PrescriptionDialog({ request, animal, procedure, municipality, defaultProfessionalName, canSave, busy, onSave, onClose }: PrescriptionDialogProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(overlay);
  const saved: AnyRecord = procedure.prescription || {};
  const [form, setForm] = useState<Prescription>({
    text: saved.text || "", professionalName: saved.professionalName || defaultProfessionalName || "", professionalRegistry: saved.professionalRegistry || "",
  });
  const complete = Boolean(form.text.trim() && form.professionalName.trim() && form.professionalRegistry.trim());
  const unchanged = form.text === (saved.text || "") && form.professionalName === (saved.professionalName || "") && form.professionalRegistry === (saved.professionalRegistry || "");
  const print = (prescription: Prescription, issuedAt?: string) => printHtmlViaIframe(buildPrescriptionPrintHtml(request, prescription, municipality, animal, procedure.name, issuedAt));
  const animalLabel = [displayText(animal.name) || "Animal sem nome", animal.species, animal.sex].filter(Boolean).join(" · ");

  async function saveAndPrint() {
    const prescription = { text: form.text.trim(), professionalName: form.professionalName.trim(), professionalRegistry: form.professionalRegistry.trim() };
    if (!unchanged && !(await onSave(prescription))) return;
    print(prescription, unchanged ? saved.issuedAt : undefined);
  }

  return (
    <div className="modal-backdrop" ref={overlay} data-managed-dialog="">
      <div className="prescription-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="prescription-modal-header">
          <div className="prescription-modal-title">
            <h2 id={titleId}>Receita veterinária</h2>
            <p>{[procedure.name, animalLabel].filter(Boolean).join(" · ")}</p>
          </div>
          <CloseButton disabled={busy} onClick={onClose} />
        </header>
        <div className="prescription-modal-body">
          <div className="two-column-fields">
            <ConfigField label="Profissional responsável" value={form.professionalName} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave} onChange={(value) => setForm((current) => ({ ...current, professionalName: value }))} />
            <ConfigField label="Registro profissional" value={form.professionalRegistry} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave} placeholder="Ex.: CRMV-SC 12345" onChange={(value) => setForm((current) => ({ ...current, professionalRegistry: value }))} />
          </div>
          <div className="prescription-rx-area">
            <span className="prescription-rx-symbol">Rx</span>
            <label className={configFieldStyle}>
              <span>Prescrição e orientações</span>
              <textarea
                data-ui-input=""
                className={`${configTextareaStyle} tw:min-h-[200px] tw:resize-y tw:font-mono tw:leading-relaxed`}
                value={form.text}
                maxLength={MAX_PRESCRIPTION_TEXT}
                readOnly={!canSave}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                placeholder="Escreva a prescrição e as orientações para o tutor."
                rows={10}
              />
            </label>
          </div>
        </div>
        <footer className="prescription-modal-footer">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button className="tw:[--ui-action:#020817] tw:[--ui-action-hover:#111827]" disabled={busy || !complete || (!canSave && !unchanged)} onClick={saveAndPrint}>
            <FileText size={15} aria-hidden="true" /> {busy ? "Salvando..." : unchanged ? "Imprimir / PDF" : "Salvar e imprimir"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
