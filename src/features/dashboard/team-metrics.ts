import type { AnyRecord } from "../../types";
import { NO_RESPONSIBLE_LABEL, countBy, getRequestClosedByName, getRequestUserName, topItems } from "../../analytics";
import type { ChartItem } from "./dashboard-data";
import type { PeriodRange } from "./dashboard-period";
import { percent } from "./metric-math";
import { arrivedInRange, closedInRange, isOpenRequest } from "./request-outcome";

export interface PersonLoad {
  label: string;
  assigned: number;
  closed: number;
}

export interface LoadConcentration {
  name: string;
  count: number;
  total: number;
  share: number | null;
}

const NO_SECTOR_LABEL = "Sem setor";
const MAX_PEOPLE = 8;

// What each person received (the requests that arrived in the period under their name) against what they closed in it.
export function personLoads(requests: AnyRecord[], range: PeriodRange, teams: AnyRecord, currentUser: AnyRecord | null): PersonLoad[] {
  const loads = new Map<string, PersonLoad>();
  const add = (name: string, field: "assigned" | "closed") => {
    if (!name || name === NO_RESPONSIBLE_LABEL) return;
    const load = loads.get(name) || { label: name, assigned: 0, closed: 0 };
    loads.set(name, { ...load, [field]: load[field] + 1 });
  };
  arrivedInRange(requests, range).forEach((request) => add(getRequestUserName(request), "assigned"));
  closedInRange(requests, range).forEach((request) => add(getRequestClosedByName(request, teams, currentUser), "closed"));
  return [...loads.values()]
    .sort((left, right) => right.assigned + right.closed - (left.assigned + left.closed) || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, MAX_PEOPLE);
}

function sectorNameOf(request: AnyRecord, teams: AnyRecord): string {
  const sector = (teams.sectors || []).find((item: AnyRecord) => item.id === request.assignedSectorId);
  return request.assignedSectorName || sector?.name || NO_SECTOR_LABEL;
}

// Where today's queue is waiting, by sector.
export function queueBySector(requests: AnyRecord[], teams: AnyRecord): ChartItem[] {
  return topItems(countBy(requests.filter(isOpenRequest), (request) => sectorNameOf(request, teams)), MAX_PEOPLE);
}

// How much of today's assigned queue sits with the person who holds the most.
export function loadConcentration(requests: AnyRecord[]): LoadConcentration | null {
  const assigned = requests.filter(isOpenRequest).filter((request) => getRequestUserName(request) !== NO_RESPONSIBLE_LABEL);
  const [top] = countBy(assigned, getRequestUserName);
  if (!top) return null;
  return { name: top.label, count: top.value, total: assigned.length, share: percent(top.value, assigned.length) };
}
