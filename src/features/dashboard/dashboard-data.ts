import type { AnyRecord } from "../../types";
import type { PeriodRange, SeriesGrouping } from "./dashboard-period";

// The label of a record that has no value for what is being counted, and of the slice that gathers the smallest categories.
export const NOT_INFORMED_LABEL = "Não informado";
export const OTHERS_LABEL = "Outros";

// One bar, slice or column of a chart; `detail` is the extra line its tooltip shows.
export interface ChartItem {
  label: string;
  value: number;
  detail?: string;
}

export interface MatrixData {
  columns: string[];
  rows: { label: string; values: number[] }[];
}

// What every tab of the dashboard reads: the records of the municipality, already scoped by the app, and the period chosen.
export interface DashboardData {
  requests: AnyRecord[];
  scheduleDays: AnyRecord[];
  adoptionAnimals: AnyRecord[];
  neighborhoods: AnyRecord[];
  requestTypes: AnyRecord[];
  teams: AnyRecord;
  currentUser: AnyRecord | null;
  range: PeriodRange;
  previous: PeriodRange | null;
  grouping: SeriesGrouping;
  now: Date;
}
