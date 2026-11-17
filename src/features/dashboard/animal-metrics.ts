import type { AnyRecord } from "../../types";
import { parseAnyDate } from "../../analytics";
import { normalizeText } from "../../utils";
import { RequestOrigin } from "../../../shared/request-contract.js";
import { ADOPTION_STATUS_ADOPTED } from "../adoption-status";
import { getAdoptionInterestCount } from "../adoption-interest-count";
import { NOT_INFORMED_LABEL, type ChartItem } from "./dashboard-data";
import { daysBetween, isInRange, type PeriodRange, type SeriesGrouping } from "./dashboard-period";
import { average, sum } from "./metric-math";
import { arrivedInRange } from "./request-outcome";
import { countSeries, type SeriesPoint } from "./time-series";

export interface AnimalProfile {
  species: ChartItem[];
  sex: ChartItem[];
  size: ChartItem[];
}

export interface AdoptionSummary {
  waiting: number;
  interests: number;
  averageDaysToAdopt: number | null;
}

const ORIGIN_LABELS: Record<string, string> = {
  [RequestOrigin.PUBLIC]: "Formulário público",
  [RequestOrigin.INTERNAL]: "Cadastro interno",
};

// Counts values typed in different ways ("Cão", " cão") as one, shown as first written; blanks count as "Não informado".
export function countLabels(values: unknown[]): ChartItem[] {
  const totals = new Map<string, ChartItem>();
  values.forEach((value) => {
    const label = String(value ?? "").trim() || NOT_INFORMED_LABEL;
    const key = normalizeText(label).toLowerCase();
    const item = totals.get(key) || { label, value: 0 };
    totals.set(key, { ...item, value: item.value + 1 });
  });
  return [...totals.values()].sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "pt-BR"));
}

// The animals of the requests that arrived in the period, by species, sex and size.
export function animalProfile(requests: AnyRecord[], range: PeriodRange): AnimalProfile {
  const animals: AnyRecord[] = arrivedInRange(requests, range).flatMap((request) => (Array.isArray(request.animals) ? request.animals : []));
  return {
    species: countLabels(animals.map((animal) => animal?.species)),
    sex: countLabels(animals.map((animal) => animal?.sex)),
    size: countLabels(animals.map((animal) => animal?.size)),
  };
}

// Where the requests of the period came from: the public form or the staff's own registration.
export function requestOrigins(requests: AnyRecord[], range: PeriodRange): ChartItem[] {
  const arrived = arrivedInRange(requests, range);
  return [RequestOrigin.PUBLIC, RequestOrigin.INTERNAL].map((origin) => ({
    label: ORIGIN_LABELS[origin],
    value: arrived.filter((request) => (request.origin || RequestOrigin.PUBLIC) === origin).length,
  }));
}

function isAdopted(animal: AnyRecord): boolean {
  return animal.status === ADOPTION_STATUS_ADOPTED;
}

function adoptedDateOf(animal: AnyRecord): Date | null {
  return parseAnyDate(animal.adopted_at || animal.adoptedAt || animal.updatedAt || animal.updated_at);
}

export function adoptionsInRange(animals: AnyRecord[], range: PeriodRange): number {
  return animals.filter((animal) => isAdopted(animal) && isInRange(adoptedDateOf(animal), range)).length;
}

// The animals still waiting for a family today, the interest they drew, and how long the adoptions of the period took.
export function adoptionSummary(animals: AnyRecord[], range: PeriodRange): AdoptionSummary {
  const waiting = animals.filter((animal) => !isAdopted(animal));
  const days = animals
    .filter((animal) => isAdopted(animal) && isInRange(adoptedDateOf(animal), range))
    .map((animal) => {
      const joined = parseAnyDate(animal.createdAt || animal.created_at);
      const adopted = adoptedDateOf(animal);
      return joined && adopted ? daysBetween(joined, adopted) : null;
    })
    .filter((value): value is number => value !== null && value >= 0);
  return { waiting: waiting.length, interests: sum(waiting.map(getAdoptionInterestCount)), averageDaysToAdopt: average(days) };
}

export function adoptionSeries(animals: AnyRecord[], range: PeriodRange, grouping: SeriesGrouping, now: Date): SeriesPoint[] {
  return countSeries({ adoptions: animals.filter(isAdopted).map(adoptedDateOf) }, range, grouping, now);
}
