import { describe, expect, it } from "vitest";
import { ProcedureStatus, resolveRequestProcedures } from "../../../shared/request-procedure-contract.js";
import { historyBlocks, issuedPrescriptions } from "./process-report";

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

describe("the prescriptions of the process", () => {
  it("identifies each prescription by its number, animal, procedure and professional", () => {
    const prescription = { text: "Orientações de teste", number: "000001/2026", professionalName: "Veterinária", professionalRegistry: "CRMV 1234", issuedAt: "2026-11-16T14:30:00Z" };
    const animals = resolveRequestProcedures({
      request_type: "Castração, Microchipagem",
      animals: [
        { name: "Bidu", requestTypeIds: ["castration"], requestTypeNames: ["Castração"],
          procedures: [{ requestTypeId: "castration", status: ProcedureStatus.DONE, prescription }] },
        { name: "Mel", requestTypeIds: ["chip"], requestTypeNames: ["Microchipagem"],
          procedures: [{ requestTypeId: "chip", status: ProcedureStatus.SCHEDULED, prescription }, { requestTypeId: "other", status: ProcedureStatus.DONE, prescription: { text: "  " } }] },
      ],
    });
    expect(issuedPrescriptions(animals).map(({ id, subtitle, animal, prescription: data }) => ({ id, subtitle, name: animal.name, data }))).toEqual([
      { id: "0:0", subtitle: "Nº 000001/2026  ·  Animal: Bidu  ·  Procedimento: Castração  ·  Profissional: Veterinária, CRMV 1234", name: "Bidu", data: prescription },
      { id: "1:0", subtitle: "Nº 000001/2026  ·  Animal: Mel  ·  Procedimento: Microchipagem  ·  Profissional: Veterinária, CRMV 1234", name: "Mel", data: prescription },
    ]);
    expect(issuedPrescriptions(animals, { completedOnly: true }).map(({ id }) => id)).toEqual(["0:0"]);
    expect(issuedPrescriptions(undefined)).toEqual([]);
  });
});
