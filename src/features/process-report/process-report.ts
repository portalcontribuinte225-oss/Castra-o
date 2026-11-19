import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";

// The process history and prescriptions come as text blocks for the PDF renderer.
export interface ReportBlock {
  heading: string;
  text: string;
}

interface HistoryEntry {
  at?: unknown;
  status?: unknown;
  notes?: unknown;
}

const isEntry = (value: unknown): value is HistoryEntry => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// One block per record, in the order they were kept (oldest first): the date and the status as heading, the note written then as text.
export function historyBlocks(history: unknown, statusLabel: (status: string) => string, formatDate: (value: string) => string): ReportBlock[] {
  return (Array.isArray(history) ? history : []).filter(isEntry).map((entry) => ({
    heading: [entry.at ? formatDate(String(entry.at)) : "", statusLabel(String(entry.status || ""))].filter(Boolean).join("  ·  "),
    text: String(entry.notes || "").trim(),
  }));
}

// One block per line of the prescription, so a long one flows over the pages; an empty line stays as a space between paragraphs.
export function prescriptionBlocks(prescription: unknown): ReportBlock[] {
  const text = typeof prescription === "string" ? prescription.trim() : "";
  return text ? text.split(/\r?\n/).map((line) => ({ heading: "", text: line.trim() })) : [];
}

export interface ReportPrescription {
  id: string;
  subtitle: string;
  blocks: ReportBlock[];
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});

// Keep the original process-level prescription alongside prescriptions recorded per procedure.
export function reportPrescriptions(animals: unknown, legacyText: unknown, { completedOnly = false } = {}): ReportPrescription[] {
  const list = (Array.isArray(animals) ? animals : []).map(record);
  const legacy = prescriptionBlocks(legacyText);
  const found: ReportPrescription[] = legacy.length
    ? [{ id: "legacy", subtitle: list[0]?.name ? `Animal: ${list[0].name}` : "", blocks: legacy }]
    : [];
  for (const [animalIndex, animal] of list.entries()) {
    const procedures = Array.isArray(animal.procedures) ? animal.procedures.map(record) : [];
    for (const [procedureIndex, procedure] of procedures.entries()) {
      if (completedOnly && procedure.status !== ProcedureStatus.DONE) continue;
      const prescription = record(procedure.prescription);
      const blocks = prescriptionBlocks(prescription.text);
      if (!blocks.length) continue;
      const professional = [prescription.professionalName, prescription.professionalRegistry].filter(Boolean).join(", ");
      found.push({
        id: `${animalIndex}:${procedureIndex}`,
        subtitle: [
          animal.name && `Animal: ${animal.name}`,
          procedure.name && `Procedimento: ${procedure.name}`,
          professional && `Profissional: ${professional}`,
        ].filter(Boolean).join("  ·  "),
        blocks,
      });
    }
  }
  return found;
}
