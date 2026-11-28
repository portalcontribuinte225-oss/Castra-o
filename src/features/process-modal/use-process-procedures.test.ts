import { describe, expect, it } from "vitest";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { getHealthEdits } from "./use-process-procedures";

const castration = { requestTypeId: "castration", name: "Castração", status: ProcedureStatus.WAITING };
const microchip = { requestTypeId: "chip", name: "Microchipagem", status: ProcedureStatus.SCHEDULED, microchip: "ABC123" };
const animals = [
  { name: "Bidu", doencas: "Displasia", alergias: "", procedures: [castration, microchip] },
  { name: "Mel", doencas: "", alergias: "Penicilina", procedures: [castration, microchip] },
];

describe("getHealthEdits", () => {
  it("ignores values restored to their saved state", () => {
    expect(getHealthEdits(animals, {})).toEqual([]);
    expect(getHealthEdits(animals, { 0: { doencas: "Displasia" }, 1: { microchip: "ABC123" } })).toEqual([]);
  });

  it("saves each animal's data once in the batch", () => {
    expect(getHealthEdits(animals, { 0: { doencas: "", alergias: " Dipirona ", microchip: "CBA321" }, 1: { alergias: "Cefalexina" } })).toEqual([
      { animalIndex: 0, doencas: "", alergias: "Dipirona", microchip: "CBA321" },
      { animalIndex: 1, alergias: "Cefalexina" },
    ]);
  });

  it("blocks editing the microchip after the microchip procedure has closed", () => {
    const closedChip = { ...microchip, status: ProcedureStatus.DONE };
    expect(getHealthEdits([{ ...animals[0], procedures: [closedChip, castration] }], { 0: { alergias: "Dipirona", microchip: "CBA321" } }))
      .toEqual([{ animalIndex: 0, alergias: "Dipirona" }]);
    expect(getHealthEdits([{ ...animals[0], procedures: [closedChip] }], { 0: { alergias: "Dipirona" } })).toEqual([]);
  });
});
