import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NO_SHOW_CANCEL_REASON } from "../../../shared/notification-contract.js";
import { ADOPTION_STATUS_ADOPTED, ADOPTION_STATUS_AVAILABLE } from "../adoption-status";
import type { DashboardData } from "./dashboard-data";
import { DashboardPeriod, periodRange, previousPeriodRange, seriesGrouping } from "./dashboard-period";
import { TEST_NOW, testRequest } from "./dashboard-test-requests";
import { DashboardView } from "./dashboard-view";
import { AnimalsTab } from "./tabs/animals-tab";
import { NeighborhoodsTab } from "./tabs/neighborhoods-tab";
import { OverviewTab } from "./tabs/overview-tab";
import { QueueTab } from "./tabs/queue-tab";
import { ScheduleTab } from "./tabs/schedule-tab";
import { TeamTab } from "./tabs/team-tab";

function dashboardData(fields: Partial<DashboardData> = {}): DashboardData {
  const range = periodRange(DashboardPeriod.LAST_30_DAYS, { from: "", to: "" }, TEST_NOW);
  return {
    requests: [],
    scheduleDays: [],
    adoptionAnimals: [],
    neighborhoods: [],
    requestTypes: [],
    teams: { users: [], sectors: [] },
    currentUser: null,
    range,
    previous: previousPeriodRange(range, TEST_NOW),
    grouping: seriesGrouping(range, TEST_NOW),
    now: TEST_NOW,
    ...fields,
  };
}

const filled = dashboardData({
  requests: [
    testRequest({ responsible: "Pessoa A", neighborhood: "Centro" }),
    testRequest({ status: "AGENDADA", neighborhood: "Centro", preferredSchedule: "20/11/2026", scheduleSlotTime: "08:00" }),
    testRequest({ status: "REALIZADA", responsible: "Pessoa A", preferredSchedule: "12/11/2026", scheduleSlotTime: "08:00" }),
    testRequest({ status: "CANCELADA", preferredSchedule: "13/11/2026", scheduleSlotTime: "10:00", workflow_data: { cancelReason: NO_SHOW_CANCEL_REASON } }),
    testRequest({ origin: "INTERNA", neighborhood: "Bairro Novo", createdAt: "2026-10-01T15:00:00" }),
  ],
  scheduleDays: [
    { date: "12/11/2026", slots: [{ time: "08:00", vacancies: 2 }, { time: "10:00", vacancies: 2 }], locationName: "Clínica Teste" },
    { date: "20/11/2026", slots: [{ time: "08:00", vacancies: 2 }], locationName: "Clínica Teste" },
  ],
  adoptionAnimals: [
    { status: ADOPTION_STATUS_ADOPTED, createdAt: "2026-11-01T10:00:00", adopted_at: "2026-11-11T10:00:00" },
    { status: ADOPTION_STATUS_AVAILABLE, interest_count: 2 },
  ],
  neighborhoods: [{ id: "n1", name: "Centro", active: true }, { id: "n2", name: "Vila Nova", active: true }],
});

const TABS = [
  { name: "overview", Tab: OverviewTab, expected: ["Entradas e realizadas", "Pede atenção hoje"] },
  { name: "queue", Tab: QueueTab, expected: ["Idade da fila", "Motivos de cancelamento"] },
  { name: "schedule", Tab: ScheduleTab, expected: ["Ocupação de cada dia", "Quando as solicitações chegam"] },
  { name: "neighborhoods", Tab: NeighborhoodsTab, expected: ["Nunca atendido", "O que se pede em cada bairro"] },
  { name: "team", Tab: TeamTab, expected: ["Concentração da fila", "Fila por setor"] },
  { name: "animals", Tab: AnimalsTab, expected: ["Aguardando adoção", "Origem das solicitações"] },
];

describe("dashboard tabs", () => {
  it.each(TABS)("renders the $name tab with records", ({ Tab, expected }) => {
    const html = renderToStaticMarkup(<Tab data={filled} />);
    expected.forEach((text) => expect(html).toContain(text));
  });

  it.each(TABS)("renders the $name tab without records, saying so instead of drawing empty charts", ({ Tab }) => {
    const html = renderToStaticMarkup(<Tab data={dashboardData()} />);
    expect(html).not.toContain("NaN");
    expect(html).toContain("Sem dados no período.");
  });

  it("opens on the overview with only date inputs for the period", () => {
    const html = renderToStaticMarkup(<DashboardView requests={[]} />);
    expect(html).toContain("Visão geral");
    expect(html).toContain("Entradas e realizadas");
    expect(html).not.toMatch(/>(?:30 dias|90 dias|12 meses)</);
    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html.match(/data-ui-input=""/g)).toHaveLength(2);
  });

  it("shows six cards on every tab", () => {
    TABS.forEach(({ Tab }) => expect(renderToStaticMarkup(<Tab data={filled} />).match(/data-dashboard-metric=""/g)).toHaveLength(6));
  });

  it("marks the registered neighborhoods without any visit and points to where they are registered when there are none", () => {
    expect(renderToStaticMarkup(<NeighborhoodsTab data={filled} />)).toContain("Vila Nova");
    expect(renderToStaticMarkup(<NeighborhoodsTab data={dashboardData()} />)).toContain("Configurar Ambiente → Bairros");
  });
});
