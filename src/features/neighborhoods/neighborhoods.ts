import { getItemMunicipalityId } from "../../domain";
import { normalizeText } from "../../utils";
import type { AnyRecord } from "../../types";

export const MAX_NEIGHBORHOOD_LENGTH = 120;

export interface Neighborhood {
  id: string;
  name: string;
  active?: boolean;
  municipalityId?: string;
}

// The comparison key of a neighborhood name: "São  João" and "sao joao" are the same neighborhood.
export function neighborhoodKey(name: unknown): string {
  return normalizeText(String(name ?? "")).replace(/\s+/g, " ");
}

function isUsable(item: AnyRecord): boolean {
  return Boolean(item) && item.active !== false && typeof item.name === "string" && item.name.trim() !== "";
}

// A municipality's active neighborhood names, including existing records without an explicit owner.
export function neighborhoodNames(neighborhoods: AnyRecord[] | null | undefined, municipalityId = ""): string[] {
  if (!Array.isArray(neighborhoods)) return [];
  const names = neighborhoods.filter((item) => {
    if (!isUsable(item)) return false;
    const ownerId = getItemMunicipalityId(item);
    return !municipalityId || !ownerId || ownerId === municipalityId;
  }).map((item) => item.name.trim());
  return [...new Set(names)].sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
}

// The registered name that matches what was typed or returned by a lookup (ignoring case and accents), or "" when there is none.
export function findNeighborhoodName(names: string[], value: unknown): string {
  const key = neighborhoodKey(value);
  return key ? names.find((name) => neighborhoodKey(name) === key) || "" : "";
}

// One name per line, trimmed, without blanks and without repeats (ignoring case and accents).
export function parseNeighborhoodLines(text: string): string[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    const key = neighborhoodKey(line);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hasDuplicateNeighborhoodName(neighborhoods: AnyRecord[], name: string, ignoreId?: string): boolean {
  const key = neighborhoodKey(name);
  return neighborhoods.some((item) => item.id !== ignoreId && neighborhoodKey(item.name) === key);
}

// The neighborhoods a list of typed names adds: the ones not registered yet, each with its own id.
export function newNeighborhoods(current: AnyRecord[], names: string[], municipalityId: string, now = Date.now()): AnyRecord[] {
  return names
    .filter((name) => !hasDuplicateNeighborhoodName(current, name))
    .map((name, index) => ({ id: `neighborhood_${now}_${index}`, name, active: true, municipalityId }));
}

// What a form shows as the value of a neighborhood field: a name that is not on the list any more is shown as it was saved.
export function neighborhoodChoices(names: string[], selected: string): string[] {
  return selected && !findNeighborhoodName(names, selected) ? [...names, selected] : names;
}
