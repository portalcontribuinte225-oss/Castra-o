import { describe, expect, it } from "vitest";
import { RequestStatus } from "../../../shared/request-contract.js";
import { normalizeRequest } from "../../domain";
import {
  AgendaFilterDimension,
  buildAgendaFacetCounts,
  buildAgendaFilterPills,
  clearAgendaFilter,
  filterAgendaRequests,
  initialAgendaFilters,
  isAgendaFiltersEmpty,
  toggleAgendaFilter,
} from "./agenda-filters";
import type { AgendaFilters } from "./agenda-filters";

const request = (id: string, status: string, types: string[]) => normalizeRequest({ id, status, workflowData: { requestTypeNames: types } });

const requests = [
  request("castration-new", RequestStatus.NEW, ["Castração"]),
  request("castration-scheduled", RequestStatus.SCHEDULED, ["Castração", "Microchipagem"]),
  request("chip-done", RequestStatus.COMPLETED, ["Microchipagem"]),
  request("exam-canceled", RequestStatus.CANCELLED, ["Exame"]),
];
const typeOptions = ["Castração", "Microchipagem", "Exame"].map((type) => ({ value: type, label: type }));
const ids = (filters: AgendaFilters) => filterAgendaRequests(requests, filters).map(({ id }) => id);

describe("agenda filters", () => {
  it("shows everything while no option is checked", () => {
    expect(isAgendaFiltersEmpty(initialAgendaFilters)).toBe(true);
    expect(ids(initialAgendaFilters)).toHaveLength(requests.length);
  });

  it("accepts several types and several statuses, matching any type and any status checked", () => {
    const filters = { types: ["Castração", "Exame"], statuses: [RequestStatus.SCHEDULED, RequestStatus.CANCELLED] };
    expect(ids(filters)).toEqual(["castration-scheduled", "exam-canceled"]);
    expect(ids({ ...initialAgendaFilters, types: ["Microchipagem"] })).toEqual(["castration-scheduled", "chip-done"]);
  });

  it("counts every option while keeping the selection of the other group", () => {
    const counts = buildAgendaFacetCounts(requests, { types: ["Castração"], statuses: [RequestStatus.NEW] });
    expect(counts.types).toEqual({ Castração: 1 });
    expect(counts.statuses).toEqual({ [RequestStatus.NEW]: 1, [RequestStatus.SCHEDULED]: 1 });
  });

  it("toggles an option on and off and clears one group at a time", () => {
    const checked = toggleAgendaFilter(initialAgendaFilters, AgendaFilterDimension.STATUSES, RequestStatus.COMPLETED);
    expect(checked).toEqual({ types: [], statuses: [RequestStatus.COMPLETED] });
    expect(toggleAgendaFilter(checked, AgendaFilterDimension.STATUSES, RequestStatus.COMPLETED)).toEqual(initialAgendaFilters);

    const both = { types: ["Exame"], statuses: [RequestStatus.CANCELLED] };
    expect(clearAgendaFilter(both, AgendaFilterDimension.TYPES)).toEqual({ types: [], statuses: [RequestStatus.CANCELLED] });
    expect(clearAgendaFilter(both, AgendaFilterDimension.STATUSES)).toEqual({ types: ["Exame"], statuses: [] });
  });

  it("names each active group in a removable chip", () => {
    const pills = buildAgendaFilterPills(
      { types: ["Castração", "Microchipagem", "Exame"], statuses: [RequestStatus.SCHEDULED] },
      typeOptions,
    );
    expect(pills).toEqual([
      { dimension: AgendaFilterDimension.TYPES, label: "Tipo de atendimento: Castração, Microchipagem +1" },
      { dimension: AgendaFilterDimension.STATUSES, label: "Status: Agendada" },
    ]);
    expect(buildAgendaFilterPills(initialAgendaFilters, typeOptions)).toEqual([]);
  });
});
