import type { AnyRecord } from "../../types";
import { NO_RESPONSIBLE_LABEL, countBy, getRequestClosedByName, getTeamUserName, topItems } from "../../analytics";
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

export interface TeamSummary {
  activeUsers: number;
  activeSectors: number;
  peopleWithQueue: number;
  queuePerPerson: number | null;
  closedPerPerson: number | null;
}

const NO_SECTOR_LABEL = "Sem setor";
const MAX_PEOPLE = 8;

// The person a request is assigned to: the team user of the assignment, or the name written as responsible. A sector is
// not a person, so a request assigned only to a sector has none.
function personOf(request: AnyRecord, teams: AnyRecord, currentUser: AnyRecord | null): string {
  return getTeamUserName(request.assignedUserId, teams, currentUser) || String(request.assignedUserName || request.responsible || "").trim();
}

// Who closed a request, when that is a person: the author of the closing step, without the fallback to the sector.
function closerOf(request: AnyRecord, teams: AnyRecord, currentUser: AnyRecord | null): string {
  const name = getRequestClosedByName(request, teams, currentUser);
  return name === NO_RESPONSIBLE_LABEL || name === request.assignedSectorName ? "" : name;
}

// The mean with one decimal, for small averages such as requests per person; null when there is no one to divide by.
function perPerson(total: number, people: number): number | null {
  return people > 0 ? Math.round((total / people) * 10) / 10 : null;
}

// The team as registered (active users and sectors) and as it works: who holds today's queue, how much each holds and how
// much each person who closed requests in the period closed.
export function teamSummary(requests: AnyRecord[], range: PeriodRange, teams: AnyRecord, currentUser: AnyRecord | null): TeamSummary {
  const assigned = requests.filter(isOpenRequest).map((request) => personOf(request, teams, currentUser)).filter(Boolean);
  const closers = closedInRange(requests, range).map((request) => closerOf(request, teams, currentUser)).filter(Boolean);
  const peopleWithQueue = new Set(assigned).size;
  return {
    activeUsers: (teams.users || []).filter((user: AnyRecord) => user.active !== false).length,
    activeSectors: (teams.sectors || []).filter((sector: AnyRecord) => sector.active !== false).length,
    peopleWithQueue,
    queuePerPerson: perPerson(assigned.length, peopleWithQueue),
    closedPerPerson: perPerson(closers.length, new Set(closers).size),
  };
}

// What each person received (the requests that arrived in the period under their name) against what they closed in it.
export function personLoads(requests: AnyRecord[], range: PeriodRange, teams: AnyRecord, currentUser: AnyRecord | null): PersonLoad[] {
  const loads = new Map<string, PersonLoad>();
  const add = (name: string, field: "assigned" | "closed") => {
    if (!name) return;
    const load = loads.get(name) || { label: name, assigned: 0, closed: 0 };
    loads.set(name, { ...load, [field]: load[field] + 1 });
  };
  arrivedInRange(requests, range).forEach((request) => add(personOf(request, teams, currentUser), "assigned"));
  closedInRange(requests, range).forEach((request) => add(closerOf(request, teams, currentUser), "closed"));
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

// How much of today's queue assigned to people sits with the person who holds the most.
export function loadConcentration(requests: AnyRecord[], teams: AnyRecord, currentUser: AnyRecord | null): LoadConcentration | null {
  const people = requests.filter(isOpenRequest).map((request) => personOf(request, teams, currentUser)).filter(Boolean);
  const [top] = countBy(people.map((name) => ({ name })), (item) => item.name);
  if (!top) return null;
  return { name: top.label, count: top.value, total: people.length, share: percent(top.value, people.length) };
}
