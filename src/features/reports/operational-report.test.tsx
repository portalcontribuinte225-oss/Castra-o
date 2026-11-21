import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { normalizeRequest } from "../../domain";
import { ReportsView } from "../reports";
import { NO_NEIGHBORHOOD_FILTER } from "../neighborhoods/neighborhood-report";
import { ActiveFiltersBar } from "../request-filters/active-filters-bar";
import { RequestFilterDimension } from "../request-filters/request-filters";
import { RequestFiltersDrawer } from "../request-filters/request-filters-drawer";
import { RequestStage } from "../request-filters/request-stage";
import { buildOperationalReport } from "./operational-report";
import { ReportFilterFields } from "./report-filter-fields";
import {
  buildReportFilterDetails,
  buildReportPills,
  buildReportScope,
  clearReportFilter,
  emptyReportQuery,
  hasInvalidReportPeriod,
  ReportFilterDimension,
} from "./report-filters";
import type { ReportQuery } from "./report-filters";
import { buildReportPrintHtml } from "./report-print";

const users = [
  { id: "one", name: "Ana", email: "ana-a@example.test" },
  { id: "two", name: "Ana", email: "ana-b@example.test" },
];
const day = "20/11/2026";
const scheduleDays = [
  { date: day, municipalityId: "town-a", id: "standard", kind: "Agenda normal" },
  { date: day, municipalityId: "town-b", id: "special-other", kind: "Mutirão" },
  { date: day, municipalityId: "town-a", id: "special", kind: "Mutirão" },
];
const common = {
  createdAt: "2026-11-18T12:00:00",
  status: "AGENDADA",
  tutor: "João",
  schedule_date: day,
  municipalityId: "town-a",
  neighborhood: "São João",
  animals: [{ name: "Mel", neighborhood: "Centro" }],
  workflowData: { requestTypeNames: ["Castração", "Vacinação antirrábica"], scheduleOccurrenceKey: "day:special" },
  assignedUserId: "one",
  fee: "R$ 10,00",
};

describe("operational reports", () => {
  it("combines municipal filters with the shared stages, procedures and assignee groups", () => {
    const requests = [
      { ...common, id: "first", protocol: "A-1" },
      { ...common, id: "second", protocol: "A-2", status: "REALIZADA", assignedUserId: "two", workflowData: { ...common.workflowData, requestTypeNames: ["Microchipagem"] } },
      { ...common, id: "other-tutor", tutor: "Olga" },
      { ...common, id: "free", fee: "Gratuito" },
      { ...common, id: "no-area", neighborhood: "" },
      { ...common, id: "other-animal", animals: [{ name: "Rex", neighborhood: "Cohab" }] },
      { ...common, id: "old", createdAt: "2026-11-15T12:00:00" },
      { ...common, id: "wrong-stage", status: "NOVA" },
      { ...common, id: "wrong-type", workflowData: { ...common.workflowData, requestTypeNames: ["Exame"] } },
      { ...common, id: "unassigned", assignedUserId: "" },
      { ...common, id: "regular", workflowData: { ...common.workflowData, scheduleOccurrenceKey: "day:standard" } },
    ].map(normalizeRequest);
    const query: ReportQuery = {
      today: day,
      search: "joao",
      filters: { stages: [RequestStage.SCHEDULED, RequestStage.DONE], types: ["Castração", "Microchipagem"], assignees: ["one", "two"], todayOnly: true },
      report: { start: "2026-11-18", end: "2026-11-20", fee: "charged", agendaKind: "mutirao", tutorNeighborhood: "Sao Joao", animalNeighborhood: "centro" },
    };
    const scope = buildReportScope(requests, query, users, scheduleDays, []);
    expect(scope.activeRequests.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(scope.counts.stages[RequestStage.INBOX]).toBe(1);
    expect(scope.counts.assignees.__unassigned__).toBe(1);
    expect(scope.assigneeOptions).toEqual(expect.arrayContaining([
      { value: "one", label: "Ana (ana-a@example.test)" },
      { value: "two", label: "Ana (ana-b@example.test)" },
    ]));

    const report = buildOperationalReport(scope.activeRequests, scope.assigneeOptions);
    expect(report.rows.map(({ cells }) => cells[0])).toEqual(["A-1", "A-2"]);
    expect(report.breakdowns[0]).toEqual({
      title: "Etapa",
      total: 2,
      items: [{ label: "Agendadas", value: 1 }, { label: "Realizadas", value: 1 }],
    });
    expect(report.activeCount).toBe(1);
    expect(report.completedCount).toBe(1);

    const details = buildReportFilterDetails(query, scope.typeOptions, scope.assigneeOptions);
    expect(details).toContainEqual(["Etapa", "Agendadas, Realizadas"]);
    expect(details).toContainEqual(["Agendadas para", day]);
    const printHtml = buildReportPrintHtml(report, query, details, new Date("2026-11-20T15:00:00"));
    expect(printHtml).toContain("<span>Total</span><strong>2</strong>");
    expect(printHtml).toContain("<td>A-1</td>");
    expect(printHtml).toContain("<td>A-2</td>");
    expect(printHtml).not.toContain("<td>regular</td>");
    expect(printHtml).toContain("<td>Etapa</td><td>Agendadas, Realizadas</td>");
  });

  it("uses the occurrence key and never borrows the agenda of another municipality for a matching date", () => {
    const requests = [
      { ...common, id: "local-standard", workflowData: { scheduleOccurrenceKey: "day:standard" } },
      { ...common, id: "local-special" },
      { ...common, id: "other-special", municipalityId: "town-b", workflowData: { scheduleOccurrenceKey: "day:special-other" } },
      { ...common, id: "missing", municipalityId: "town-c" },
    ].map(normalizeRequest);
    const query = { ...emptyReportQuery, report: { ...emptyReportQuery.report, agendaKind: "mutirao" } };
    expect(buildReportScope(requests, query, users, scheduleDays, []).activeRequests.map(({ id }) => id)).toEqual(["local-special", "other-special"]);
  });

  it("matches appointments of different procedures of the same request and preserves legacy appointment dates", () => {
    const otherDay = "21/11/2026";
    const days = [...scheduleDays, { date: otherDay, id: "regular-later", kind: "Agenda normal", municipalityId: "town-a" }];
    const requests = [
      {
        ...common, id: "multiprocedure", animals: [{ name: "Mel", procedures: [
          { requestTypeId: "castration", status: "AGENDADO", schedule: { date: day, occurrenceKey: "day:special", slotTime: "08:00" } },
          { requestTypeId: "chip", status: "AGENDADO", schedule: { date: otherDay, occurrenceKey: "day:regular-later", slotTime: "09:00" } },
        ] }],
      },
      { ...common, id: "legacy", status: "CANCELADA", schedule_date: "", appointment: otherDay, workflowData: {} },
    ].map(normalizeRequest);
    const withAgendaKind = (agendaKind: string) => buildReportScope(requests, {
      ...emptyReportQuery, report: { ...emptyReportQuery.report, agendaKind },
    }, users, days, []).activeRequests.map(({ id }) => id);
    expect(withAgendaKind("agenda")).toEqual(["multiprocedure", "legacy"]);
    expect(withAgendaKind("mutirao")).toEqual(["multiprocedure"]);
  });

  it("clears one dimension while retaining the other facets and exposes the extra report filters in the shared controls", () => {
    const query: ReportQuery = {
      ...emptyReportQuery,
      search: "123",
      filters: { ...emptyReportQuery.filters, stages: [RequestStage.INBOX] },
      report: { ...emptyReportQuery.report, start: "2026-11-21", end: "2026-11-20", animalNeighborhood: NO_NEIGHBORHOOD_FILTER },
    };
    expect(hasInvalidReportPeriod(query.report)).toBe(true);
    expect(clearReportFilter(query, ReportFilterDimension.PERIOD)).toMatchObject({
      search: "123", filters: { stages: [RequestStage.INBOX] }, report: { start: "", end: "", animalNeighborhood: NO_NEIGHBORHOOD_FILTER },
    });
    expect(clearReportFilter(query, RequestFilterDimension.STAGES)).toMatchObject({ filters: { stages: [] }, report: query.report });
    expect(clearReportFilter(query, ReportFilterDimension.SEARCH)).toMatchObject({ search: "", report: query.report });

    const scope = buildReportScope([], query, users, [], []);
    const noop = vi.fn();
    const chips = renderToStaticMarkup(
      <ActiveFiltersBar filters={query.filters} pills={buildReportPills(query, scope.pills)} resultCount={0} onClearAll={noop} onClearDimension={noop} />,
    );
    expect(chips).toContain('aria-label="Remover filtro Bairro do animal: Não informado"');
    expect(chips).toContain('aria-label="Remover filtro Busca: 123"');
    const drawer = renderToStaticMarkup(
      <RequestFiltersDrawer
        sectionLabel="Relatórios" filters={query.filters} counts={scope.counts}
        typeOptions={scope.typeOptions} assigneeOptions={scope.assigneeOptions} resultCount={0}
        additionalFilters={<ReportFilterFields filters={query.report} tutorNeighborhoods={["Centro"]} animalNeighborhoods={["Cohab"]} onChange={noop} />}
        onToggleStage={noop} onToggleType={noop} onToggleAssignee={noop} onClearAll={noop} onClose={noop} applyDisabled
      />,
    );
    expect(drawer).toContain('aria-label="Bairro do animal"');
    expect(drawer).toContain('aria-label="Taxas"');
    expect(drawer).toContain('role="alert"');
    expect(drawer).toMatch(/<button[^>]*disabled=""[^>]*>Ver 0 solicitações<\/button>/);
  });

  it("renders the shared filters alongside Buscar, Exportar and Prontuário on the report entry point", () => {
    const html = renderToStaticMarkup(<ReportsView />);
    expect(html).toContain('aria-label="Filtros de relatórios"');
    expect(html).toContain("Buscar");
    expect(html).toContain("Exportar");
    expect(html).toContain("Prontuário");
    expect(html).not.toContain("reports-filter-grid");
  });
});
