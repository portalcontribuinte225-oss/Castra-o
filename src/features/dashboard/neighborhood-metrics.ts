import type { AnyRecord } from "../../types";
import { getRequestTypeNames } from "../../analytics";
import { findNeighborhoodName, neighborhoodKey, neighborhoodNames } from "../neighborhoods/neighborhoods";
import { tutorNeighborhoodOf } from "../neighborhoods/neighborhood-report";
import { NOT_INFORMED_LABEL, type MatrixData } from "./dashboard-data";
import { isInRange, type PeriodRange } from "./dashboard-period";
import { percent } from "./metric-math";
import { createdDateOf, isCancelledRequest, isCompletedRequest, isOpenRequest, outcomeDateOf } from "./request-outcome";

export enum NeighborhoodColumn {
  NAME = "name",
  REQUESTED = "requested",
  ANIMALS_SERVED = "animalsServed",
  OPEN = "open",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  COMPLETION_RATE = "completionRate",
  TOP_TYPE = "topType",
  LAST_SERVED = "lastServedAt",
}

export interface NeighborhoodRow {
  key: string;
  name: string;
  registered: boolean;
  requested: number;
  animalsServed: number;
  open: number;
  completed: number;
  cancelled: number;
  completionRate: number | null;
  topType: string;
  lastServedAt: Date | null;
  typeCounts: Record<string, number>;
}

export interface NeighborhoodReport {
  rows: NeighborhoodRow[];
  registeredCount: number;
  servedCount: number;
  neverServedCount: number;
  coverage: number | null;
}

// The neighborhoods of a request, each with how many of its animals live there: an animal without a neighborhood of its
// own counts in the tutor's, and a request without any in "Não informado".
export function requestNeighborhoods(request: AnyRecord): { key: string; name: string; animals: number }[] {
  const animals = Array.isArray(request.animals) && request.animals.length ? request.animals : [{}];
  const places = new Map<string, { key: string; name: string; animals: number }>();
  animals.forEach((animal: AnyRecord) => {
    const name = String(animal?.neighborhood || "").trim() || tutorNeighborhoodOf(request);
    const key = neighborhoodKey(name);
    const place = places.get(key) || { key, name: name || NOT_INFORMED_LABEL, animals: 0 };
    places.set(key, { ...place, animals: place.animals + 1 });
  });
  return [...places.values()];
}

function emptyRow(key: string, name: string, registered: boolean): NeighborhoodRow {
  return { key, name, registered, requested: 0, animalsServed: 0, open: 0, completed: 0, cancelled: 0, completionRate: null, topType: "", lastServedAt: null, typeCounts: {} };
}

function topTypeOf(typeCounts: Record<string, number>): string {
  return Object.entries(typeCounts).sort(([leftName, left], [rightName, right]) => right - left || leftName.localeCompare(rightName, "pt-BR"))[0]?.[0] || "";
}

// Where the work happened: every registered neighborhood (even with nothing yet) plus any other the requests name. The
// counts follow the period; the queue is today's; the last visit looks at the whole history.
export function neighborhoodReport(requests: AnyRecord[], registered: AnyRecord[], requestTypes: AnyRecord[], range: PeriodRange): NeighborhoodReport {
  const names = neighborhoodNames(registered);
  const rows = new Map<string, NeighborhoodRow>(names.map((name) => [neighborhoodKey(name), emptyRow(neighborhoodKey(name), name, true)]));
  requests.forEach((request) => {
    const arrived = isInRange(createdDateOf(request), range);
    const outcome = outcomeDateOf(request);
    const closedInPeriod = !isOpenRequest(request) && isInRange(outcome, range);
    const types = arrived ? getRequestTypeNames(request, requestTypes) : [];
    requestNeighborhoods(request).forEach((place) => {
      const row = rows.get(place.key) || emptyRow(place.key, findNeighborhoodName(names, place.name) || place.name, false);
      rows.set(place.key, row);
      if (arrived) {
        row.requested += 1;
        types.forEach((type) => { row.typeCounts[type] = (row.typeCounts[type] || 0) + 1; });
      }
      if (isOpenRequest(request)) row.open += 1;
      if (closedInPeriod && isCompletedRequest(request)) {
        row.completed += 1;
        row.animalsServed += place.animals;
      }
      if (closedInPeriod && isCancelledRequest(request)) row.cancelled += 1;
      if (isCompletedRequest(request) && outcome && (!row.lastServedAt || outcome > row.lastServedAt)) row.lastServedAt = outcome;
    });
  });
  const finished = [...rows.values()].map((row) => ({ ...row, completionRate: percent(row.completed, row.completed + row.open), topType: topTypeOf(row.typeCounts) }));
  const registeredRows = finished.filter((row) => row.registered);
  const servedCount = registeredRows.filter((row) => row.lastServedAt).length;
  return {
    rows: sortNeighborhoodRows(finished, NeighborhoodColumn.REQUESTED, true),
    registeredCount: registeredRows.length,
    servedCount,
    neverServedCount: registeredRows.length - servedCount,
    coverage: percent(servedCount, registeredRows.length),
  };
}

const SORT_VALUES: Record<NeighborhoodColumn, (row: NeighborhoodRow) => string | number | null> = {
  [NeighborhoodColumn.NAME]: (row) => row.name,
  [NeighborhoodColumn.REQUESTED]: (row) => row.requested,
  [NeighborhoodColumn.ANIMALS_SERVED]: (row) => row.animalsServed,
  [NeighborhoodColumn.OPEN]: (row) => row.open,
  [NeighborhoodColumn.COMPLETED]: (row) => row.completed,
  [NeighborhoodColumn.CANCELLED]: (row) => row.cancelled,
  [NeighborhoodColumn.COMPLETION_RATE]: (row) => row.completionRate,
  [NeighborhoodColumn.TOP_TYPE]: (row) => row.topType || null,
  [NeighborhoodColumn.LAST_SERVED]: (row) => (row.lastServedAt ? row.lastServedAt.getTime() : null),
};

// Orders the rows by a column; rows without a value go last either way, and ties fall back to the name.
export function sortNeighborhoodRows(rows: NeighborhoodRow[], column: NeighborhoodColumn, descending: boolean): NeighborhoodRow[] {
  const valueOf = SORT_VALUES[column];
  return [...rows].sort((left, right) => {
    const a = valueOf(left);
    const b = valueOf(right);
    if (a === null || b === null) {
      if (a !== b) return a === null ? 1 : -1;
    } else if (a !== b) {
      const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR");
      return descending ? -order : order;
    }
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

// What is asked in each neighborhood: the neighborhoods with requests in the period, most asked first, by request type.
export function neighborhoodTypeMatrix(rows: NeighborhoodRow[]): MatrixData {
  const asked = sortNeighborhoodRows(rows.filter((row) => row.requested > 0), NeighborhoodColumn.REQUESTED, true);
  const totals = new Map<string, number>();
  asked.forEach((row) => Object.entries(row.typeCounts).forEach(([type, count]) => totals.set(type, (totals.get(type) || 0) + count)));
  const columns = [...totals].sort(([leftName, left], [rightName, right]) => right - left || leftName.localeCompare(rightName, "pt-BR")).map(([type]) => type);
  return { columns, rows: asked.map((row) => ({ label: row.name, values: columns.map((type) => row.typeCounts[type] || 0) })) };
}
