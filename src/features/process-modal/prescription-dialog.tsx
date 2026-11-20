import { useState } from "react";
import { FileText } from "lucide-react";
import { MAX_PRESCRIPTION_TEXT, MAX_PROFESSIONAL_TEXT } from "../../../shared/request-procedure-contract.js";
import { CloseButton } from "../../components/close-button";
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
    <div className="modal-backdrop">
      <div className="prescription-modal" role="dialog" aria-modal="true">
        <header className="prescription-modal-header">
          <div className="prescription-modal-title">
            <h2>Receita veterinária</h2>
            <p>{[procedure.name, animalLabel].filter(Boolean).join(" · ")}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="prescription-modal-body">
          <div className="two-column-fields">
            <label className="field">
              <span>Profissional responsável</span>
              <input value={form.professionalName} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave} onChange={(event) => setForm((current) => ({ ...current, professionalName: event.target.value }))} />
            </label>
            <label className="field">
              <span>Registro profissional</span>
              <input value={form.professionalRegistry} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave} placeholder="Ex.: CRMV-SC 12345" onChange={(event) => setForm((current) => ({ ...current, professionalRegistry: event.target.value }))} />
            </label>
          </div>
          <div className="prescription-rx-area">
            <span className="prescription-rx-symbol">Rx</span>
            <label className="field prescription-field">
              <span>Prescrição e orientações</span>
              <textarea
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
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="prm-action-btn prm-action-btn--primary" type="button" disabled={busy || !complete || (!canSave && !unchanged)} onClick={saveAndPrint}>
            <FileText size={15} /> {busy ? "Salvando..." : unchanged ? "Imprimir / PDF" : "Salvar e imprimir"}
          </button>
        </footer>
      </div>
    </div>
  );
}
