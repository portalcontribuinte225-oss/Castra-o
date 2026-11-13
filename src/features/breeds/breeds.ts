import { normalizeText } from "../../utils";

export interface Breed {
  id: string;
  name: string;
  speciesId: string;
  requestTypeIds: string[];
  active?: boolean;
  municipalityId?: string;
}

type BreedLike = Partial<Breed>;

export interface BreedOptionsFilter {
  requestTypeId?: string;
  speciesId?: string;
}

interface SpeciesLike {
  id?: string;
  name?: string;
  active?: boolean;
}

// Active breeds linked to both the request type and the species, in alphabetical order.
export function getBreedOptions<T extends BreedLike>(breeds: T[] | null | undefined, filter: BreedOptionsFilter): T[] {
  const { requestTypeId, speciesId } = filter;
  if (!Array.isArray(breeds) || !requestTypeId || !speciesId) return [];
  return breeds
    .filter(
      (breed) =>
        breed?.active !== false &&
        typeof breed?.name === "string" &&
        breed.name.trim() !== "" &&
        breed.speciesId === speciesId &&
        Array.isArray(breed.requestTypeIds) &&
        breed.requestTypeIds.includes(requestTypeId),
    )
    .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "", "pt-BR", { sensitivity: "base" }));
}

export function findSpeciesIdByName(speciesOptions: SpeciesLike[] | null | undefined, speciesName: string): string | undefined {
  if (!Array.isArray(speciesOptions) || !speciesName) return undefined;
  return speciesOptions.find((species) => species?.active !== false && species?.name === speciesName)?.id;
}

// One breed per line; blank lines and repeated names (ignoring case and accents) are dropped.
export function parseBreedNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    const key = normalizeText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

// Names that already exist for the same species, ignoring case, accents and the item being edited.
export function getDuplicateBreedNames(items: BreedLike[], names: string[], speciesId: string, ignoreId?: string): string[] {
  const existing = new Set(
    items
      .filter((item) => item.speciesId === speciesId && item.id !== ignoreId)
      .map((item) => normalizeText(item.name ?? "")),
  );
  return names.filter((name) => {
    const key = normalizeText(name);
    return key !== "" && existing.has(key);
  });
}
