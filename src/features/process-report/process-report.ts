import { ProcedureStatus, animalPrescriptionRecords } from "../../../shared/request-procedure-contract.js";
import type { PrintablePrescription } from "../process-modal/prescription-pdf";

// The process history comes as text blocks for the PDF.
interface ReportBlock {
  heading: string;
  text: string;
}

interface HistoryEntry {
  at?: unknown;
  status?: unknown;
  notes?: unknown;
  title?: unknown;
}

const isEntry = (value: unknown): value is HistoryEntry => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// One block per record, in the order they were kept (oldest first): the date and the status as heading, the note written then as text.
export function historyBlocks(history: unknown, statusLabel: (status: string) => string, formatDate: (value: string) => string): ReportBlock[] {
  return (Array.isArray(history) ? history : []).filter(isEntry).map((entry) => ({
    heading: [entry.at ? formatDate(String(entry.at)) : "", statusLabel(String(entry.status || ""))].filter(Boolean).join("  ·  "),
    text: [entry.title, entry.notes].filter(Boolean).join(" · ").trim(),
  }));
}

interface IssuedPrescription {
  id: string;
  subtitle: string;
  animal: Record<string, unknown>;
  prescription: PrintablePrescription;
  procedureName?: string;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const textValue = (value: unknown) => typeof value === "string" ? value : "";

// Per-animal emissions, including earlier versions and documents saved on legacy procedures.
export function issuedPrescriptions(animals: unknown, { completedOnly = false } = {}): IssuedPrescription[] {
  const found: IssuedPrescription[] = [];
  for (const [animalIndex, animal] of (Array.isArray(animals) ? animals : []).map(record).entries()) {
    const procedures = Array.isArray(animal.procedures) ? animal.procedures.map(record) : [];
    const prescriptions = animalPrescriptionRecords({ ...animal, procedures });
    for (const [index, row] of prescriptions.entries()) {
      const prescription = record(row);
      const procedure = procedures.find((item) => Boolean(prescription.requestTypeId) && item.requestTypeId === prescription.requestTypeId);
      if (completedOnly && (procedure ? procedure.status !== ProcedureStatus.DONE
        : !procedures.some((item) => item.status === ProcedureStatus.DONE))) continue;
      const text = textValue(prescription.text);
      if (!text.trim()) continue;
      const number = textValue(prescription.number);
      const professionalName = textValue(prescription.professionalName);
      const professionalRegistry = textValue(prescription.professionalRegistry);
      const professional = [professionalName, professionalRegistry].filter(Boolean).join(", ");
      found.push({
        id: `${animalIndex}:${index}`,
        subtitle: [
          number && `Nº ${number}`,
          animal.name && `Animal: ${animal.name}`,
          procedure?.name && `Procedimento: ${procedure.name}`,
          professional && `Profissional: ${professional}`,
        ].filter(Boolean).join("  ·  "),
        animal,
        procedureName: textValue(procedure?.name) || undefined,
        prescription: { text, number, professionalName, professionalRegistry, issuedAt: textValue(prescription.issuedAt) },
      });
    }
  }
  return found;
}
