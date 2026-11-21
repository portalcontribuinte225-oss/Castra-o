import { animalRequestTypeIds, distinctRequestTypeIds, isRequestTypeCharged } from "../../../shared/request-types-contract.js";
import type { AnyRecord } from "../../types";
import { getBreedOptions, findSpeciesIdByName } from "../breeds/breeds";

// What one animal of a request asks for: the procedures (request types of the municipality) chosen for it.
export function blankAnimal(): AnyRecord {
  return {
    name: "", species: "", sex: "", breedType: "", breedDescription: "", size: "", weight: "", age: "", birthDate: "", coat: "", neighborhood: "",
    hasChip: "", microchip: "", dewormed: "", vaccinated: "", illnessHistory: "", food: "", requestTypeIds: [],
  };
}

export interface BreedContext {
  requestTypes: AnyRecord[];
  breeds: AnyRecord[];
  speciesOptions: AnyRecord[];
}

function linkedBreedFilter(animal: AnyRecord, { requestTypes, speciesOptions }: BreedContext) {
  const chosen = animalRequestTypeIds(animal);
  const breedIds = [...new Set(requestTypes.filter((type) => chosen.includes(type.id)).flatMap((type) => (Array.isArray(type.breedIds) ? type.breedIds : [])))];
  return { breedIds, speciesId: findSpeciesIdByName(speciesOptions, animal.species) };
}

// Use the procedure's choices when they are available for this species, otherwise use the municipality's species catalog.
export function breedOptionsFor(animal: AnyRecord, context: BreedContext): AnyRecord[] {
  const filter = linkedBreedFilter(animal, context);
  const linked = getBreedOptions(context.breeds, filter);
  return linked.length ? linked : getBreedOptions(context.breeds, { speciesId: filter.speciesId });
}

// Only an explicit list of linked breeds limits the choice when the procedures change.
export function withProcedures(animal: AnyRecord, ids: string[], context: BreedContext): AnyRecord {
  const next: AnyRecord = { ...animal, requestTypeIds: [...ids] };
  const options = getBreedOptions(context.breeds, linkedBreedFilter(next, context));
  const stale = next.breedType === "Definida" && options.length > 0 && !options.some((breed) => breed.name === next.breedDescription);
  return stale ? { ...next, breedDescription: "" } : next;
}

export function withProceduresAt(animals: AnyRecord[], index: number, ids: string[], context: BreedContext): AnyRecord[] {
  return animals.map((animal, position) => (position === index ? withProcedures(animal, ids, context) : animal));
}

// A new animal like the one before it: same species, size, breed, neighborhood and procedures; the rest (name, sex, age...) is left blank.
export function duplicateAnimal(animals: AnyRecord[], fromIndex: number): AnyRecord[] {
  const source = animals[fromIndex];
  if (!source) return animals;
  const { species, size, breedType, breedDescription, neighborhood } = source;
  return [...animals, { ...blankAnimal(), species, size, breedType, breedDescription, neighborhood: neighborhood || "", requestTypeIds: animalRequestTypeIds(source) }];
}

// Gives every animal the procedures of the one at `sourceIndex`.
export function applyProceduresToAll(animals: AnyRecord[], sourceIndex: number, context: BreedContext): AnyRecord[] {
  const source = animals[sourceIndex];
  if (!source) return animals;
  const ids = animalRequestTypeIds(source);
  return animals.map((animal, position) => (position === sourceIndex ? animal : withProcedures(animal, ids, context)));
}

// The distinct procedures of the whole request, as a string that changes only when that set changes.
export function procedureSignature(animals: AnyRecord[]): string {
  return [...distinctRequestTypeIds(animals)].sort().join("|");
}

export function needsProcedure(animal: AnyRecord, hasConfiguredTypes: boolean): boolean {
  return hasConfiguredTypes && animalRequestTypeIds(animal).length === 0;
}

// "Animal 2" and, next to it, the name and the species when they are filled in.
export function animalHeader(animal: AnyRecord, index: number): { title: string; detail: string } {
  return { title: `Animal ${index + 1}`, detail: [animal.name, animal.species].filter((part) => typeof part === "string" && part.trim()).join(" · ") };
}

// What the list shows next to a procedure: free, or the value charged.
export function requestTypeFeeLabel(type: AnyRecord): string {
  return isRequestTypeCharged(type) ? String(type.billingAmount || type.fee || "Cobrado") : "Gratuito";
}

// The documents of several procedures as one list: each document once (the first one found), required when any procedure requires it.
export function mergeProcedureDocuments(lists: AnyRecord[][]): AnyRecord[] {
  const merged = new Map<string, AnyRecord>();
  for (const document of lists.flat()) {
    const known = merged.get(document.id);
    merged.set(document.id, known ? { ...known, required: Boolean(known.required || document.required) } : document);
  }
  return [...merged.values()];
}

// The names of an animal's procedures, in the order chosen.
export function procedureNames(animal: AnyRecord, requestTypes: AnyRecord[]): string[] {
  return animalRequestTypeIds(animal).map((id) => requestTypes.find((type) => type.id === id)?.name).filter(Boolean);
}
