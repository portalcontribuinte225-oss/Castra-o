import { useId, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { MAX_PRESCRIPTION_TEXT, MAX_PROFESSIONAL_TEXT } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
import { CloseButton } from "../../components/close-button";
import { useModalFocus } from "../../components/modal-focus";
import { ConfigField, configFieldStyle, configTextareaStyle } from "../../components/ui";
import { displayText } from "../../domain";
import type { AnyRecord } from "../../types";
import { createPrescriptionPdfDocument } from "./prescription-pdf";
import type { PrintablePrescription } from "./prescription-pdf";

export interface Prescription {
  text: string;
  professionalName: string;
  professionalRegistry: string;
}

interface PrescriptionDialogProps {
  request: AnyRecord;
  animal: AnyRecord;
  procedure: AnyRecord;
  municipality: AnyRecord | null;
  defaultProfessionalName: string;
  // A saved prescription can still be downloaded after the procedure closes.
  canSave: boolean;
  busy: boolean;
  // Saves the prescription and answers it as the server keeps it, with its number, or nothing when it was not saved.
  onSave: (prescription: Prescription) => Promise<PrintablePrescription | null>;
  onClose: () => void;
}

// The prescription belongs to one procedure and is issued without changing its status.
export function PrescriptionDialog({ request, animal, procedure, municipality, defaultProfessionalName, canSave, busy, onSave, onClose }: PrescriptionDialogProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(overlay);
  const saved: AnyRecord = procedure.prescription || {};
  const savedText = typeof saved.text === "string" ? saved.text : "";
  const [form, setForm] = useState<Prescription>({
    text: savedText, professionalName: saved.professionalName || defaultProfessionalName || "", professionalRegistry: saved.professionalRegistry || "",
  });
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const complete = Boolean(form.text.trim() && form.professionalName.trim() && form.professionalRegistry.trim());
  const unchanged = form.text === savedText && form.professionalName === (saved.professionalName || "") && form.professionalRegistry === (saved.professionalRegistry || "");
  const canExport = unchanged ? Boolean(savedText.trim()) : canSave && complete;
  const pending = busy || generating;
  const animalLabel = [displayText(animal.name) || "Animal sem nome", animal.species, animal.sex].filter(Boolean).join(" · ");

  // A changed prescription is saved first: the PDF carries the number and the date the server gave it.
  async function saveAndDownload() {
    if (pending || !canExport) return;
    setPdfError("");
    setGenerating(true);
    try {
      const issued = unchanged ? saved as PrintablePrescription
        : await onSave({ text: form.text.trim(), professionalName: form.professionalName.trim(), professionalRegistry: form.professionalRegistry.trim() });
      if (!issued) return;
      const { dataUrl, fileName } = await createPrescriptionPdfDocument(request, issued, municipality, animal);
      const anchor = window.document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = fileName;
      anchor.click();
      if (!unchanged) onClose();
    } catch {
      setPdfError(unchanged ? "Não foi possível gerar o PDF da receita. Tente novamente." : "A receita foi salva, mas o PDF não foi gerado. Tente baixar novamente.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="modal-backdrop" ref={overlay} data-managed-dialog="">
      <div className="prescription-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={pending}>
        <header className="prescription-modal-header">
          <div className="prescription-modal-title">
            <h2 id={titleId}>Receita veterinária</h2>
            <p>{[procedure.name, animalLabel].filter(Boolean).join(" · ")}</p>
          </div>
          <CloseButton disabled={pending} onClick={onClose} />
        </header>
        <div className="prescription-modal-body">
          <div className="two-column-fields">
            <ConfigField label="Profissional responsável" value={form.professionalName} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave || pending} onChange={(value) => setForm((current) => ({ ...current, professionalName: value }))} />
            <ConfigField label="Registro profissional" value={form.professionalRegistry} maxLength={MAX_PROFESSIONAL_TEXT} readOnly={!canSave || pending} placeholder="Ex.: CRMV-SC 12345" onChange={(value) => setForm((current) => ({ ...current, professionalRegistry: value }))} />
          </div>
          <label className={configFieldStyle}>
            <span>Prescrição e orientações</span>
            <textarea
              data-ui-input=""
              className={`${configTextareaStyle} tw:min-h-[200px] tw:resize-y tw:font-mono tw:leading-relaxed`}
              value={form.text}
              maxLength={MAX_PRESCRIPTION_TEXT}
              readOnly={!canSave || pending}
              onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              placeholder="Escreva a prescrição e as orientações para o tutor."
              rows={10}
            />
          </label>
          {pdfError && <p role="alert">{pdfError}</p>}
        </div>
        <footer className="prescription-modal-footer">
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
          <Button className="tw:[--ui-action:#020817] tw:[--ui-action-hover:#111827]" disabled={pending || !canExport} onClick={saveAndDownload}>
            <FileText size={15} aria-hidden="true" /> {busy ? "Salvando..." : generating ? "Gerando PDF..." : unchanged ? "Baixar PDF" : "Salvar e baixar PDF"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
