import { describe, expect, it } from "vitest";
import type { AnyRecord } from "../../types";
import { animalProcedureLabels, requestTypeLabel, requestTypeLabels, storedRequestTypeNames } from "../../domain";
import { countBy, countByMany, getRequestTypeName, getRequestTypeNames } from "../../analytics";

const withProcedures = (overrides: AnyRecord = {}): AnyRecord => ({
  type: "Castração, Microchipagem, Vacinação antirrábica",
  request_type: "Castração, Microchipagem, Vacinação antirrábica",
  animals: [{ requestTypeIds: ["castration", "microchip"] }, { requestTypeIds: ["vaccine"] }],
  workflow_data: {
    requestTypeIds: ["castration", "microchip", "vaccine"],
    requestTypeNames: ["Castração", "Microchipagem", "Vacinação antirrábica"],
  },
  ...overrides,
});

describe("the procedures of a request, by name", () => {
  it("lists each stored procedure whole, never a summary", () => {
    expect(storedRequestTypeNames(withProcedures())).toEqual(["Castração", "Microchipagem", "Vacinação antirrábica"]);
    expect(requestTypeLabels(withProcedures())).toEqual(["Castração", "Microchipagem", "Vacinação antirrábica"]);
    expect(requestTypeLabel(withProcedures())).toBe("Castração, Microchipagem, Vacinação antirrábica");
  });

  it("reads the stored names from camelCase workflows too, ignores blanks and repeats, and labels legacy spellings", () => {
    const request = { workflowData: { requestTypeNames: ["castracao", "  ", 5, "Microchipagem", "castracao"] } };
    expect(storedRequestTypeNames(request)).toEqual(["Castração", "Microchipagem"]);
  });

  it("falls back to the single type of a request made before procedures existed", () => {
    expect(storedRequestTypeNames({ type: "ninhada" })).toEqual([]);
    expect(requestTypeLabels({ type: "ninhada" })).toEqual(["Ninhada"]);
    expect(requestTypeLabels({ request_type: "animal_rua", workflow_data: { requestTypeNames: [] } })).toEqual(["Animal de rua"]);
    expect(requestTypeLabels({})).toEqual(["Castração"]);
  });

  it("names the procedures of one animal through the ids and names the request stored", () => {
    const request = withProcedures();
    expect(animalProcedureLabels(request.animals[0], request)).toEqual(["Castração", "Microchipagem"]);
    expect(animalProcedureLabels(request.animals[1], request)).toEqual(["Vacinação antirrábica"]);
    expect(animalProcedureLabels({ requestTypeIds: ["unknown", "vaccine"] }, request)).toEqual(["Vacinação antirrábica"]);
    expect(animalProcedureLabels({}, request)).toEqual([]);
    expect(animalProcedureLabels(request.animals[0], { type: "Castração" })).toEqual([]);
  });
});

describe("reports and dashboard by procedure", () => {
  const types = [{ id: "castration", name: "Castração" }];

  it("counts a request under each of its procedures, once each", () => {
    const requests = [withProcedures(), withProcedures({ workflow_data: { requestTypeNames: ["Castração"] } }), { type: "ninhada" }, {}];
    expect(countByMany(requests, (request) => getRequestTypeNames(request, types))).toEqual([
      { label: "Castração", value: 2 },
      { label: "Microchipagem", value: 1 },
      { label: "Vacinação antirrábica", value: 1 },
      { label: "Ninhada", value: 1 },
      { label: "Não informado", value: 1 },
    ].sort((first, second) => second.value - first.value));
  });

  it("keeps counting a request once when it is counted by a single key", () => {
    expect(countBy([withProcedures(), { type: "ninhada" }], (request) => getRequestTypeName(request, types))).toHaveLength(2);
    expect(countByMany([], () => ["x"])).toEqual([]);
    expect(countByMany([{}], () => [])).toEqual([{ label: "Não informado", value: 1 }]);
  });

  it("names the procedures of a request for the table and the export, one by one", () => {
    expect(getRequestTypeNames(withProcedures(), types)).toEqual(["Castração", "Microchipagem", "Vacinação antirrábica"]);
    expect(getRequestTypeNames({ requestTypeId: "castration" }, types)).toEqual(["Castração"]);
    expect(getRequestTypeNames({}, types)).toEqual(["Não informado"]);
  });
});
