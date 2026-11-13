import { normalizeText } from "../../utils";

export interface Breed {
  id: string;
  name: string;
  speciesId: string;
  active?: boolean;
  municipalityId?: string;
}

type BreedLike = Partial<Breed>;

export interface BreedOptionsFilter {
  breedIds?: string[];
  speciesId?: string;
}

interface SpeciesLike {
  id?: string;
  name?: string;
  active?: boolean;
}

export interface BreedGroup<TBreed, TSpecies> {
  species: TSpecies;
  breeds: TBreed[];
}

function isUsableBreed(breed: BreedLike): boolean {
  return breed?.active !== false && typeof breed?.name === "string" && breed.name.trim() !== "";
}

function compareByName(left: { name?: string }, right: { name?: string }): number {
  return (left.name ?? "").localeCompare(right.name ?? "", "pt-BR", { sensitivity: "base" });
}

// Active breeds of the species that the request type links to (breedIds), in alphabetical order.
export function getBreedOptions<T extends BreedLike>(breeds: T[] | null | undefined, filter: BreedOptionsFilter): T[] {
  const { breedIds, speciesId } = filter;
  if (!Array.isArray(breeds) || !Array.isArray(breedIds) || breedIds.length === 0 || !speciesId) return [];
  return breeds
    .filter((breed) => isUsableBreed(breed) && breed.speciesId === speciesId && typeof breed.id === "string" && breedIds.includes(breed.id))
    .sort(compareByName);
}

// Active species that have at least one active breed, each with its breeds; both in alphabetical order.
export function groupBreedsBySpecies<TBreed extends BreedLike, TSpecies extends SpeciesLike>(
  breeds: TBreed[] | null | undefined,
  species: TSpecies[] | null | undefined,
): BreedGroup<TBreed, TSpecies>[] {
  if (!Array.isArray(breeds) || !Array.isArray(species)) return [];
  return species
    .filter((item) => item?.active !== false && typeof item?.name === "string" && item.name.trim() !== "" && Boolean(item.id))
    .map((item) => ({
      species: item,
      breeds: breeds.filter((breed) => isUsableBreed(breed) && breed.speciesId === item.id).sort(compareByName),
    }))
    .filter((group) => group.breeds.length > 0)
    .sort((left, right) => compareByName(left.species, right.species));
}

export function findSpeciesIdByName(speciesOptions: SpeciesLike[] | null | undefined, speciesName: string): string | undefined {
  if (!Array.isArray(speciesOptions) || !speciesName) return undefined;
  return speciesOptions.find((species) => species?.active !== false && species?.name === speciesName)?.id;
}

// A breed name already used by another breed of the same species, ignoring case, accents and the item being edited.
export function hasDuplicateBreedName(items: BreedLike[], name: string, speciesId: string, ignoreId?: string): boolean {
  const key = normalizeText(name);
  if (!key) return false;
  return items.some((item) => item.speciesId === speciesId && item.id !== ignoreId && normalizeText(item.name ?? "") === key);
}
