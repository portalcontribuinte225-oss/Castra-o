import { describe, expect, it } from "vitest";
import { historyBlocks, prescriptionBlocks } from "./process-report";

const label = (status: string) => ({ NOVA: "Nova", CANCELADA: "Cancelada" }[status] || status);
const date = (value: string) => `em ${value}`;

describe("the tramitação of the process report", () => {
  it("lists the records in the order they were kept, with the date and the status as heading and the note as text", () => {
    const blocks = historyBlocks([
      { status: "NOVA", notes: "Assumida por Maria", at: "2026-11-16T10:00:00Z" },
      { status: "CANCELADA", notes: "  Indeferida por Maria  ", at: "2026-11-16T11:00:00Z" },
    ], label, date);
    expect(blocks).toEqual([
      { heading: "em 2026-11-16T10:00:00Z  ·  Nova", text: "Assumida por Maria" },
      { heading: "em 2026-11-16T11:00:00Z  ·  Cancelada", text: "Indeferida por Maria" },
    ]);
  });

  it("keeps a record that lacks a date, a status or a note, and drops what is not a record", () => {
    expect(historyBlocks([{ status: "NOVA" }, { at: "2026-11-16" }, {}, null, "text", 7, []], label, date)).toEqual([
      { heading: "Nova", text: "" },
      { heading: "em 2026-11-16", text: "" },
      { heading: "", text: "" },
    ]);
  });

  it("is empty when there is no history", () => {
    for (const history of [undefined, null, [], "x", {}]) expect(historyBlocks(history, label, date)).toEqual([]);
  });
});

describe("the prescription of the process report", () => {
  it("is one block per line, keeping the empty lines as the space between paragraphs", () => {
    expect(prescriptionBlocks("1. Amoxicilina\r\n\r\n  Orientações: repouso  ")).toEqual([
      { heading: "", text: "1. Amoxicilina" },
      { heading: "", text: "" },
      { heading: "", text: "Orientações: repouso" },
    ]);
  });

  it("is empty when no prescription was issued", () => {
    for (const prescription of [undefined, null, "", "   \n ", 5]) expect(prescriptionBlocks(prescription)).toEqual([]);
  });
});
