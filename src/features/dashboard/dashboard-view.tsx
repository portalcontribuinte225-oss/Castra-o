import { useMemo, useState } from "react";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import type { AnyRecord } from "../../types";
import { initialRequestTypes, initialTeams, normalizeRequest } from "../../domain";
import type { DashboardData } from "./dashboard-data";
import {
  DashboardPeriod,
  DashboardTab,
  periodRange,
  previousPeriodRange,
  seriesGrouping,
  typedRangeOf,
  type TypedRange,
} from "./dashboard-period";
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

const pressedControlStyle = "tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:enabled:hover:bg-card-page tw:aria-pressed:border-[color:var(--ink-700)] tw:aria-pressed:bg-[var(--ui-action-soft)] tw:aria-pressed:font-semibold tw:aria-pressed:text-[color:var(--selected-ink)]";
const dateRangeStyle = "tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:text-sm tw:font-medium tw:text-ui-text tw:max-[420px]:w-full";

// The manager's dashboard: one row of controls (tab and period) above everything they scope, then the active tab, which
// computes only its own numbers. The date fields start at the default range and can be edited.
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
  const [customRange, setCustomRange] = useState<TypedRange | null>(null);
  const normalizedRequests = useMemo(() => requests.map(normalizeRequest), [requests]);
  const data = useMemo<DashboardData>(() => {
    const now = new Date();
    const range = customRange
      ? periodRange(DashboardPeriod.CUSTOM, customRange, now)
      : periodRange(DashboardPeriod.LAST_90_DAYS, { from: "", to: "" }, now);
    return {
      requests: normalizedRequests,
      scheduleDays,
      adoptionAnimals,
      neighborhoods,
      requestTypes,
      teams,
      currentUser,
      range,
      previous: previousPeriodRange(range, now),
      grouping: seriesGrouping(range, now),
      now,
    };
  }, [normalizedRequests, scheduleDays, adoptionAnimals, neighborhoods, requestTypes, teams, currentUser, customRange]);
  const shown = typedRangeOf(data.range, data.now);
  // An edited date starts a custom range and keeps the other date as shown.
  const typeDay = (field: keyof TypedRange, value: string) => {
    if (!value) return;
    setCustomRange({ ...shown, [field]: value });
  };
  const ActiveTab = (TABS.find((item) => item.id === tab) || TABS[0]).view;
  return (
    <section className="dash-root">
      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <nav className="tw:grid tw:min-w-0 tw:max-w-full tw:grid-flow-col tw:auto-cols-fr tw:gap-1.5 tw:max-[900px]:w-full tw:max-[900px]:grid-flow-row tw:max-[900px]:grid-cols-3 tw:max-[480px]:grid-cols-2" aria-label="Abas do painel">
          {TABS.map((item) => (
            <Button key={item.id} variant="custom" className={`${pressedControlStyle} tw:min-w-0 tw:max-[900px]:whitespace-normal`} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2" role="group" aria-label="Período">
          <label className={dateRangeStyle}>
            <span>De</span>
            <Input type="date" value={shown.from} max={shown.to} onChange={(event) => typeDay("from", event.target.value)} />
          </label>
          <label className={dateRangeStyle}>
            <span>até</span>
            <Input type="date" value={shown.to} min={shown.from} onChange={(event) => typeDay("to", event.target.value)} />
          </label>
        </div>
      </div>
      <ActiveTab data={data} />
    </section>
  );
}
