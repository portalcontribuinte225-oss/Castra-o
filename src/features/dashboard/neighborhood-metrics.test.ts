import { describe, expect, it } from "vitest";
import { DashboardPeriod, periodRange } from "./dashboard-period";
import { TEST_NOW, testRequest } from "./dashboard-test-requests";
import { NeighborhoodColumn, neighborhoodReport, neighborhoodTypeMatrix, requestNeighborhoods, sortNeighborhoodRows } from "./neighborhood-metrics";

const range = periodRange(DashboardPeriod.LAST_30_DAYS, { from: "", to: "" }, TEST_NOW);
const registered = [
  { id: "n1", name: "Centro", active: true },
  { id: "n2", name: "São João", active: true },
  { id: "n3", name: "Vila Nova", active: true },
  { id: "n4", name: "Bairro Inativo", active: false },
];

describe("dashboard neighborhoods", () => {
  it("places each animal in its own neighborhood, or in the tutor's when it has none", () => {
    const request = testRequest({
      neighborhood: "Centro",
      animals: [{ name: "A", neighborhood: "sao joao" }, { name: "B" }, { name: "C", neighborhood: "São  João" }],
    });
    expect(requestNeighborhoods(request).map((place) => [place.name, place.animals])).toEqual([["sao joao", 2], ["Centro", 1]]);
  });

  it("lists every registered neighborhood, merges spellings and keeps the last visit from the whole history", () => {
    const requests = [
      testRequest({ neighborhood: "centro", status: "AGENDADA" }),
      testRequest({ neighborhood: "CENTRO", status: "REALIZADA", preferredSchedule: "12/11/2026" }),
      testRequest({ neighborhood: "São João", status: "REALIZADA", createdAt: "2025-03-01T09:00:00", preferredSchedule: "15/03/2025" }),
      testRequest({ neighborhood: "Bairro Novo", status: "CANCELADA", updatedAt: "2026-11-14T10:00:00" }),
      testRequest({ neighborhood: "" }),
    ];
    const report = neighborhoodReport(requests, registered, [], range);
    const byName = Object.fromEntries(report.rows.map((row) => [row.name, row]));
    expect(byName.Centro).toMatchObject({ requested: 2, open: 1, completed: 1, animalsServed: 1, completionRate: 50, registered: true });
    expect(byName["São João"]).toMatchObject({ requested: 0, completed: 0, registered: true });
    expect(byName["São João"].lastServedAt).toEqual(new Date(2025, 2, 15));
    expect(byName["Vila Nova"]).toMatchObject({ requested: 0, lastServedAt: null });
    expect(byName["Bairro Novo"]).toMatchObject({ registered: false, cancelled: 1 });
    expect(byName["Não informado"]).toMatchObject({ requested: 1, open: 1 });
    expect(byName["Bairro Inativo"]).toBeUndefined();
    expect(report).toMatchObject({ registeredCount: 3, servedCount: 2, neverServedCount: 1, coverage: 67 });
    expect([report.topDemand?.name, report.topQueue?.name]).toEqual(["Centro", "Centro"]);
  });

  it("sorts by a column with empty values last either way", () => {
    const report = neighborhoodReport([testRequest({ status: "REALIZADA", preferredSchedule: "12/11/2026" })], registered, [], range);
    const ascending = sortNeighborhoodRows(report.rows, NeighborhoodColumn.LAST_SERVED, false).map((row) => row.name);
    const descending = sortNeighborhoodRows(report.rows, NeighborhoodColumn.LAST_SERVED, true).map((row) => row.name);
    expect(ascending[0]).toBe("Centro");
    expect(descending[0]).toBe("Centro");
    expect(sortNeighborhoodRows(report.rows, NeighborhoodColumn.NAME, false).map((row) => row.name)).toEqual(["Centro", "São João", "Vila Nova"]);
  });

  it("builds the neighborhood by request type matrix from the requests of the period", () => {
    const requests = [
      testRequest({ neighborhood: "Centro", type: "Castracao" }),
      testRequest({ neighborhood: "Centro", type: "Castracao" }),
      testRequest({ neighborhood: "Vila Nova", type: "Microchipagem" }),
    ];
    const matrix = neighborhoodTypeMatrix(neighborhoodReport(requests, registered, [], range).rows);
    expect(matrix.rows.map((row) => row.label)).toEqual(["Centro", "Vila Nova"]);
    expect(matrix.columns).toHaveLength(2);
    expect(matrix.rows[0].values.reduce((total, value) => total + value, 0)).toBe(2);
  });
});
