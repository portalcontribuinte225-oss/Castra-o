import { describe, expect, it } from "vitest";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { getProcedureDraftEdits } from "./use-process-procedures";

const castration = { requestTypeId: "castration", name: "Castração", status: ProcedureStatus.WAITING };
const microchip = { requestTypeId: "chip", name: "Microchipagem", status: ProcedureStatus.SCHEDULED, microchip: "ABC123" };
const animals = [
  { name: "Bidu", doencas: "Displasia", alergias: "", procedures: [castration, microchip] },
  { name: "Mel", doencas: "", alergias: "Penicilina", procedures: [castration, microchip] },
];

describe("getProcedureDraftEdits", () => {
  it("starts clean and ignores values restored to their saved state", () => {
    expect(getProcedureDraftEdits(animals, {}, {})).toEqual([]);
    expect(getProcedureDraftEdits(animals, { 0: { doencas: "Displasia" } }, { "1:chip": "ABC123" })).toEqual([]);
  });

  it("saves each animal's health once and pairs a microchip draft with its own procedure", () => {
    const changes = getProcedureDraftEdits(animals, { 0: { doencas: "", alergias: "Dipirona" }, 1: { alergias: "Cefalexina" } }, { "0:chip": "CBA321" });
    expect(changes).toEqual([
      { animalIndex: 0, requestTypeId: "chip", edits: { doencas: "", alergias: "Dipirona", microchip: "CBA321" } },
      { animalIndex: 1, requestTypeId: "castration", edits: { alergias: "Cefalexina" } },
    ]);
  });

  it("uses an open procedure for health and excludes drafts for already closed or non-microchip procedures", () => {
    const closedChip = { ...microchip, status: ProcedureStatus.DONE };
    const changes = getProcedureDraftEdits(
      [{ ...animals[0], procedures: [closedChip, castration] }],
      { 0: { alergias: "Dipirona" } },
      { "0:chip": "CBA321", "0:castration": "SHOULDIGNORE" },
    );
    expect(changes).toEqual([{ animalIndex: 0, requestTypeId: "castration", edits: { alergias: "Dipirona" } }]);
  });
});
