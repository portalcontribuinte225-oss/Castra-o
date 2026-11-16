// What the process report prints besides the documents: the tramitação (what the history of the request recorded) and the prescription.
// Both come as blocks of text for the PDF drawing to wrap and place; nothing here touches the PDF.
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
