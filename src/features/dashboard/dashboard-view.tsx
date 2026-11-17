import { useMemo, useState } from "react";
import type { AnyRecord } from "../../types";
import { initialRequestTypes, initialTeams, normalizeRequest } from "../../domain";
import type { DashboardData } from "./dashboard-data";
import { DashboardPeriod, DashboardTab, periodRange, previousPeriodRange, seriesGrouping } from "./dashboard-period";
import { AnimalsTab } from "./tabs/animals-tab";
import { NeighborhoodsTab } from "./tabs/neighborhoods-tab";
import { OverviewTab } from "./tabs/overview-tab";
import { QueueTab } from "./tabs/queue-tab";
import { ScheduleTab } from "./tabs/schedule-tab";
import { TeamTab } from "./tabs/team-tab";

const TABS: { id: DashboardTab; label: string; view: (props: { data: DashboardData }) => JSX.Element }[] = [
  { id: DashboardTab.OVERVIEW, label: "Visão geral", view: OverviewTab },
  { id: DashboardTab.QUEUE, label: "Fila", view: QueueTab },
  { id: DashboardTab.SCHEDULE, label: "Agenda e horários", view: ScheduleTab },
  { id: DashboardTab.NEIGHBORHOODS, label: "Bairros", view: NeighborhoodsTab },
  { id: DashboardTab.TEAM, label: "Equipe", view: TeamTab },
  { id: DashboardTab.ANIMALS, label: "Animais e adoção", view: AnimalsTab },
];

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: DashboardPeriod.LAST_30_DAYS, label: "30 dias" },
  { id: DashboardPeriod.LAST_90_DAYS, label: "90 dias" },
  { id: DashboardPeriod.LAST_12_MONTHS, label: "12 meses" },
  { id: DashboardPeriod.ALL, label: "Tudo" },
];

// The manager's dashboard: one row of controls (tab and period) above everything they scope, then the active tab, which
// computes only its own numbers.
export function DashboardView({
  requests = [],
  adoptionAnimals = [],
  scheduleDays = [],
  neighborhoods = [],
  requestTypes = initialRequestTypes,
  teams = initialTeams,
  currentUser = null,
}: AnyRecord) {
  const [tab, setTab] = useState(DashboardTab.OVERVIEW);
  const [period, setPeriod] = useState(DashboardPeriod.LAST_90_DAYS);
  const normalizedRequests = useMemo(() => requests.map(normalizeRequest), [requests]);
  const data = useMemo<DashboardData>(() => {
    const now = new Date();
    return {
      requests: normalizedRequests,
      scheduleDays,
      adoptionAnimals,
      neighborhoods,
      requestTypes,
      teams,
      currentUser,
      range: periodRange(period, now),
      previous: previousPeriodRange(period, now),
      grouping: seriesGrouping(period),
      now,
    };
  }, [normalizedRequests, scheduleDays, adoptionAnimals, neighborhoods, requestTypes, teams, currentUser, period]);
  const ActiveTab = (TABS.find((item) => item.id === tab) || TABS[0]).view;
  return (
    <section className="dash-root">
      <div className="page-toolbar dash-toolbar">
        <nav className="tab-bar" aria-label="Abas do painel">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? "active" : ""} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="tab-bar" role="group" aria-label="Período">
          {PERIODS.map((item) => (
            <button key={item.id} type="button" className={period === item.id ? "active" : ""} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ActiveTab data={data} />
    </section>
  );
}
