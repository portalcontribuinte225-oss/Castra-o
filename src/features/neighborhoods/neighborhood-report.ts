import type { AnyRecord } from "../../types";
import { neighborhoodKey, neighborhoodNames } from "./neighborhoods";

export const NO_NEIGHBORHOOD_LABEL = "Não informado";
// The value of the filter option that selects the requests without a neighborhood.
export const NO_NEIGHBORHOOD_FILTER = "__none__";

// The neighborhood of the tutor's address, as it was registered with the request.
export function tutorNeighborhoodOf(request: AnyRecord = {}): string {
  return String(request.neighborhood || "").trim();
}

// The distinct neighborhoods where the animals of a request live, in the order of the animals.
export function animalNeighborhoodsOf(request: AnyRecord = {}): string[] {
  const names = (Array.isArray(request.animals) ? request.animals : []).map((animal) => String(animal?.neighborhood || "").trim()).filter(Boolean);
  return names.filter((name, index) => names.findIndex((other) => neighborhoodKey(other) === neighborhoodKey(name)) === index);
}

// Whether the neighborhoods of a request answer a report filter; an empty filter lets everything pass.
export function matchesNeighborhoodFilter(values: string[], selected: string): boolean {
  if (!selected) return true;
  if (selected === NO_NEIGHBORHOOD_FILTER) return values.length === 0;
  const key = neighborhoodKey(selected);
  return values.some((value) => neighborhoodKey(value) === key);
}

// The names a filter offers: the registered neighborhoods plus any other that the requests carry, once each, alphabetical.
export function neighborhoodFilterOptions(valuesOfRequests: string[][], registered: AnyRecord[] | undefined): string[] {
  const options = new Map<string, string>();
  for (const name of [...neighborhoodNames(registered), ...valuesOfRequests.flat()]) {
    const key = neighborhoodKey(name);
    if (key && !options.has(key)) options.set(key, name);
  }
  return [...options.values()].sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
}

export function neighborhoodsLabel(values: string[]): string {
  return values.length ? values.join(", ") : NO_NEIGHBORHOOD_LABEL;
}
