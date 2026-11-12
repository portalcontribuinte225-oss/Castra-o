import { describe, expect, it } from "vitest";
import type { AnyRecord } from "../../types";
import {
  ACCESS_REQUEST_SOURCE,
  RequestFilterDimension,
  UNASSIGNED_ASSIGNEE_KEY,
  buildActiveFilterPills,
  buildAssigneeOptions,
  buildRequestFacetCounts,
  buildTypeOptions,
  filterRequestItems,
  formatRequestCount,
  getEmptyListMessage,
  initialRequestFilters,
  isRequestFiltersEmpty,
} from "./request-filters";
import type { RequestListFilters } from "./request-filters";
import { RequestStage, getRequestStage, requestStageOrder } from "./request-stage";

const TODAY = "12/11/2026";

function request(overrides: AnyRecord = {}): AnyRecord {
  return {
    id: "request",
    status: "NOVA",
    tags: [],
    type: "ninhada",
    assignedUserId: "",
    responsible: "",
    preferredSchedule: "",
    appointment: "",
    ...overrides,
  };
}

function accessRequest(id: string, status: string): AnyRecord {
  return { __source: ACCESS_REQUEST_SOURCE, id, status, tags: [], animals: [] };
}

function filters(overrides: Partial<RequestListFilters> = {}): RequestListFilters {
  return { ...initialRequestFilters, ...overrides };
}

const inbox = request({ id: "inbox" });
const analysis = request({
  id: "analysis",
  tags: ["ATRIBUIDA"],
  type: "animal_rua",
  assignedUserId: "u1",
  responsible: "Ana",
});
const scheduled = request({
  id: "scheduled",
  status: "AGENDADA",
  assignedUserId: "u1",
  responsible: "Ana",
  preferredSchedule: TODAY,
  appointment: TODAY,
});
const rescheduled = request({
  id: "rescheduled",
  status: "AGENDADA",
  tags: ["REAGENDADA"],
  type: "Castracao",
  assignedUserId: "u2",
  responsible: "Bruno",
  preferredSchedule: "13/11/2026",
});
const done = request({
  id: "done",
  status: "REALIZADA",
  type: "castracao",
  assignedUserId: "u2",
  responsible: "Bruno",
  appointment: TODAY,
});
const canceled = request({
  id: "canceled",
  status: "CANCELADA",
  type: "Castração",
  assignedUserId: "u1",
  responsible: "Ana",
});
const accessNew = accessRequest("access-new", "NOVA");
const accessDone = accessRequest("access-done", "REALIZADA");

const requests = [inbox, analysis, scheduled, rescheduled, done, canceled];
const items = [...requests, accessNew, accessDone];
const context = { today: TODAY };
const ids = (list: AnyRecord[]) => list.map((item) => item.id);
const run = (override: Partial<RequestListFilters>) => ids(filterRequestItems(items, filters(override), context));

describe("getRequestStage", () => {
  it("derives the stage from status and workflow tags", () => {
    expect(getRequestStage(inbox)).toBe(RequestStage.INBOX);
    expect(getRequestStage(analysis)).toBe(RequestStage.ANALYSIS);
    expect(getRequestStage(scheduled)).toBe(RequestStage.SCHEDULED);
    expect(getRequestStage(rescheduled)).toBe(RequestStage.RESCHEDULED);
    expect(getRequestStage(done)).toBe(RequestStage.DONE);
    expect(getRequestStage(canceled)).toBe(RequestStage.CANCELED);
  });

  it("maps access requests by their adapted status", () => {
    expect(getRequestStage(accessNew)).toBe(RequestStage.INBOX);
    expect(getRequestStage(accessDone)).toBe(RequestStage.DONE);
  });
});

describe("filterRequestItems", () => {
  it("shows every request, but no access request, when no filter is active", () => {
    expect(run({})).toEqual(ids(requests));
  });

  it("matches any of the selected values inside one group (OR)", () => {
    expect(run({ stages: [RequestStage.SCHEDULED, RequestStage.RESCHEDULED] })).toEqual(["scheduled", "rescheduled"]);
    expect(run({ types: ["Ninhada", "Animal de rua"] })).toEqual(["inbox", "analysis", "scheduled"]);
  });

  it("requires every group to match (AND)", () => {
    expect(run({ types: ["Ninhada", "Animal de rua"], assignees: ["u1"] })).toEqual(["analysis", "scheduled"]);
    expect(run({ stages: [RequestStage.DONE, RequestStage.CANCELED], assignees: ["u2"] })).toEqual(["done"]);
  });

  it("groups legacy type spellings under the same label", () => {
    expect(run({ types: ["Castração"] })).toEqual(["rescheduled", "done", "canceled"]);
  });

  it("filters requests without an assignee", () => {
    expect(run({ assignees: [UNASSIGNED_ASSIGNEE_KEY] })).toEqual(["inbox"]);
  });

  it("filters by today's schedule regardless of stage, and combines with stages", () => {
    expect(run({ todayOnly: true })).toEqual(["scheduled", "done"]);
    expect(run({ todayOnly: true, stages: [RequestStage.DONE] })).toEqual(["done"]);
    expect(run({ todayOnly: true, stages: [RequestStage.INBOX] })).toEqual([]);
  });

  it("only includes access requests when the inbox stage is explicitly selected", () => {
    expect(run({ stages: [RequestStage.INBOX] })).toEqual(["inbox", "access-new"]);
    expect(run({ stages: [RequestStage.INBOX, RequestStage.ANALYSIS] })).toContain("access-new");
    expect(run({ stages: [RequestStage.ANALYSIS] })).not.toContain("access-new");
    expect(run({ stages: [RequestStage.DONE] })).not.toContain("access-done");
  });

  it("drops access requests when a type, assignee or today filter is active", () => {
    expect(run({ stages: [RequestStage.INBOX], types: ["Ninhada"] })).toEqual(["inbox"]);
    expect(run({ stages: [RequestStage.INBOX], assignees: [UNASSIGNED_ASSIGNEE_KEY] })).toEqual(["inbox"]);
    expect(run({ stages: [RequestStage.INBOX], todayOnly: true })).toEqual([]);
  });
});

describe("buildRequestFacetCounts", () => {
  it("counts stages, today, types and assignees for the unfiltered list", () => {
    const counts = buildRequestFacetCounts(items, initialRequestFilters, context);
    expect(counts.stages).toEqual({
      [RequestStage.INBOX]: 2,
      [RequestStage.ANALYSIS]: 1,
      [RequestStage.SCHEDULED]: 1,
      [RequestStage.RESCHEDULED]: 1,
      [RequestStage.DONE]: 1,
      [RequestStage.CANCELED]: 1,
    });
    expect(counts.today).toBe(2);
    expect(counts.types).toEqual({ Ninhada: 2, "Animal de rua": 1, "Castração": 3 });
    expect(counts.assignees).toEqual({ [UNASSIGNED_ASSIGNEE_KEY]: 1, u1: 3, u2: 2 });
  });

  it("applies the other groups to every count and ignores a group's own selection", () => {
    const counts = buildRequestFacetCounts(items, filters({ types: ["Ninhada"] }), context);
    expect(counts.stages).toEqual({
      [RequestStage.INBOX]: 1,
      [RequestStage.ANALYSIS]: 0,
      [RequestStage.SCHEDULED]: 1,
      [RequestStage.RESCHEDULED]: 0,
      [RequestStage.DONE]: 0,
      [RequestStage.CANCELED]: 0,
    });
    expect(counts.today).toBe(1);
    expect(counts.types).toEqual({ Ninhada: 2, "Animal de rua": 1, "Castração": 3 });
    expect(counts.assignees).toEqual({ [UNASSIGNED_ASSIGNEE_KEY]: 1, u1: 1 });
  });

  it("treats today as a regular filter for the other counts", () => {
    const counts = buildRequestFacetCounts(items, filters({ todayOnly: true }), context);
    expect(counts.stages).toEqual({
      [RequestStage.INBOX]: 0,
      [RequestStage.ANALYSIS]: 0,
      [RequestStage.SCHEDULED]: 1,
      [RequestStage.RESCHEDULED]: 0,
      [RequestStage.DONE]: 1,
      [RequestStage.CANCELED]: 0,
    });
    expect(counts.today).toBe(2);
    expect(counts.types).toEqual({ Ninhada: 1, "Castração": 1 });
    expect(counts.assignees).toEqual({ u1: 1, u2: 1 });
  });

  it("counts today within the selected stages", () => {
    const counts = buildRequestFacetCounts(
      items,
      filters({ stages: [RequestStage.SCHEDULED, RequestStage.RESCHEDULED] }),
      context,
    );
    expect(counts.today).toBe(1);
    expect(counts.types).toEqual({ Ninhada: 1, "Castração": 1 });
    expect(counts.stages[RequestStage.INBOX]).toBe(2);
  });

  describe("stay equal to what the list shows once the option is applied", () => {
    const bases: RequestListFilters[] = [
      filters(),
      filters({ types: ["Castração"] }),
      filters({ stages: [RequestStage.DONE, RequestStage.CANCELED], assignees: ["u1"] }),
      filters({ todayOnly: true }),
    ];

    bases.forEach((base, index) => {
      it(`base filters #${index + 1}`, () => {
        const counts = buildRequestFacetCounts(items, base, context);
        requestStageOrder.forEach((stage) => {
          expect(filterRequestItems(items, { ...base, stages: [stage] }, context)).toHaveLength(counts.stages[stage]);
        });
        expect(filterRequestItems(items, { ...base, todayOnly: true }, context)).toHaveLength(counts.today);
        Object.entries(counts.types).forEach(([type, count]) => {
          expect(filterRequestItems(items, { ...base, types: [type] }, context)).toHaveLength(count);
        });
        Object.entries(counts.assignees).forEach(([assignee, count]) => {
          expect(filterRequestItems(items, { ...base, assignees: [assignee] }, context)).toHaveLength(count);
        });
      });
    });
  });
});

describe("filter options", () => {
  const users = [
    { id: "u1", name: "Ana Souza" },
    { id: "u2", name: "Bruno" },
  ];

  it("lists distinct type labels, merging legacy spellings and ignoring access requests", () => {
    expect(buildTypeOptions(items).map((option) => option.label)).toEqual(["Animal de rua", "Castração", "Ninhada"]);
  });

  it("keeps selected types even when no request has them", () => {
    expect(buildTypeOptions(requests, ["Denúncia"]).map((option) => option.label)).toEqual([
      "Animal de rua",
      "Castração",
      "Denúncia",
      "Ninhada",
    ]);
  });

  it("lists assignees by user name with the unassigned option first", () => {
    expect(buildAssigneeOptions(items, users)).toEqual([
      { value: UNASSIGNED_ASSIGNEE_KEY, label: "Sem responsável" },
      { value: "u1", label: "Ana Souza" },
      { value: "u2", label: "Bruno" },
    ]);
  });

  it("falls back to the request's responsible text, then to a generic label", () => {
    expect(buildAssigneeOptions([analysis, rescheduled], []).map((option) => option.label)).toEqual(["Ana", "Bruno"]);
    expect(buildAssigneeOptions([request({ assignedUserId: "u9" })], []).map((option) => option.label)).toEqual([
      "Responsável não identificado",
    ]);
  });

  it("tolerates a missing user list", () => {
    expect(buildAssigneeOptions([analysis], undefined)).toEqual([{ value: "u1", label: "Ana" }]);
  });

  it("only offers the unassigned option when it exists or is selected", () => {
    expect(buildAssigneeOptions([analysis], users).some((option) => option.value === UNASSIGNED_ASSIGNEE_KEY)).toBe(false);
    expect(buildAssigneeOptions([analysis], users, [UNASSIGNED_ASSIGNEE_KEY])[0].value).toBe(UNASSIGNED_ASSIGNEE_KEY);
  });

  it("tells apart users that share the same name", () => {
    const list = [request({ assignedUserId: "11111111-aaaa" }), request({ assignedUserId: "22222222-bbbb" })];
    const withEmail = [
      { id: "11111111-aaaa", name: "Maria", email: "maria.a@example.com" },
      { id: "22222222-bbbb", name: "Maria", email: "maria.b@example.com" },
    ];
    expect(buildAssigneeOptions(list, withEmail).map((option) => option.label)).toEqual([
      "Maria (maria.a@example.com)",
      "Maria (maria.b@example.com)",
    ]);
    const withoutEmail = [
      { id: "11111111-aaaa", name: "Maria" },
      { id: "22222222-bbbb", name: "Maria" },
    ];
    expect(buildAssigneeOptions(list, withoutEmail).map((option) => option.label)).toEqual([
      "Maria (111111)",
      "Maria (222222)",
    ]);
  });

  it("ignores access requests", () => {
    expect(buildAssigneeOptions([accessNew], users)).toEqual([]);
  });
});

describe("buildActiveFilterPills", () => {
  const options = {
    types: [
      { value: "Ninhada", label: "Ninhada" },
      { value: "Animal de rua", label: "Animal de rua" },
    ],
    assignees: [
      { value: "u1", label: "Ana" },
      { value: "u2", label: "Bruno" },
      { value: "u3", label: "Carla" },
    ],
  };

  it("has no pills when nothing is filtered, and the today toggle never gets one", () => {
    expect(buildActiveFilterPills(initialRequestFilters, options)).toEqual([]);
    expect(buildActiveFilterPills(filters({ todayOnly: true }), options)).toEqual([]);
  });

  it("adds a stage pill for any stage selection", () => {
    expect(buildActiveFilterPills(filters({ stages: [RequestStage.INBOX] }), options)).toEqual([
      { dimension: RequestFilterDimension.STAGES, label: "Etapa: Novas" },
    ]);
    expect(
      buildActiveFilterPills(filters({ stages: [RequestStage.SCHEDULED, RequestStage.RESCHEDULED] }), options),
    ).toEqual([{ dimension: RequestFilterDimension.STAGES, label: "Etapa: Agendadas, Reagendadas" }]);
    expect(buildActiveFilterPills(filters({ stages: [RequestStage.DONE], todayOnly: true }), options)).toEqual([
      { dimension: RequestFilterDimension.STAGES, label: "Etapa: Realizadas" },
    ]);
  });

  it("summarizes long selections and keeps a stable group order", () => {
    const pills = buildActiveFilterPills(
      filters({
        stages: [RequestStage.CANCELED, RequestStage.SCHEDULED, RequestStage.DONE],
        types: ["Ninhada"],
        assignees: ["u3", "u1", "u2"],
      }),
      options,
    );
    expect(pills).toEqual([
      { dimension: RequestFilterDimension.STAGES, label: "Etapa: Agendadas, Realizadas +1" },
      { dimension: RequestFilterDimension.TYPES, label: "Tipo: Ninhada" },
      { dimension: RequestFilterDimension.ASSIGNEES, label: "Responsável: Ana, Bruno +1" },
    ]);
  });
});

describe("getEmptyListMessage / isRequestFiltersEmpty / formatRequestCount", () => {
  it("keeps the plain and today-only messages when there is nothing to clear but today", () => {
    expect(getEmptyListMessage(initialRequestFilters)).toEqual({
      title: "Nenhuma solicitação encontrada",
      text: "Quando houver registros, eles aparecerão aqui.",
      canClear: false,
    });
    expect(getEmptyListMessage(filters({ todayOnly: true }))).toMatchObject({
      title: "Nenhuma agenda para hoje",
      canClear: false,
    });
  });

  it("offers to clear filters in every other case", () => {
    expect(getEmptyListMessage(filters({ types: ["Ninhada"] })).canClear).toBe(true);
    expect(getEmptyListMessage(filters({ assignees: ["u1"] })).canClear).toBe(true);
    expect(getEmptyListMessage(filters({ stages: [RequestStage.SCHEDULED] })).canClear).toBe(true);
    expect(getEmptyListMessage(filters({ stages: [RequestStage.DONE], todayOnly: true })).canClear).toBe(true);
  });

  it("detects a fully cleared filter state", () => {
    expect(isRequestFiltersEmpty(initialRequestFilters)).toBe(true);
    expect(isRequestFiltersEmpty(filters({ todayOnly: true }))).toBe(false);
    expect(isRequestFiltersEmpty(filters({ stages: [RequestStage.INBOX] }))).toBe(false);
  });

  it("formats the result count in the singular and plural", () => {
    expect(formatRequestCount(0)).toBe("0 solicitações");
    expect(formatRequestCount(1)).toBe("1 solicitação");
    expect(formatRequestCount(45)).toBe("45 solicitações");
  });
});
