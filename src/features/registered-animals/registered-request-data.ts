import type { RegisteredAnimal, ReusableDocumentCandidate, RequestConfigItem } from "./registered-animal-types";

export function resolveRegisteredIdentificationType(types: RequestConfigItem[], animal: RegisteredAnimal) {
  const id = animal.identificationTypeId || "animal_com_tutor";
  return types.find((type) => type.id === id) || null;
}

export function animalForRequest(animal: RegisteredAnimal) {
  return { ...animal, breedDescription: animal.breedDescription || animal.breed || "", coat: animal.coat || "", hasChip: animal.microchip || animal.declaredMicrochip ? "Sim" : "Não", microchip: animal.microchip || animal.declaredMicrochip || "" };
}

export function pickReusableDocuments(candidates: ReusableDocumentCandidate[]) {
  const selected: Record<string, ReusableDocumentCandidate> = {};
  for (const candidate of candidates) {
    if (!candidate.eligible || !candidate.reuseRef) continue;
    const previous = selected[candidate.documentId];
    if (!previous || new Date(candidate.receivedAt || 0).getTime() > new Date(previous.receivedAt || 0).getTime()) selected[candidate.documentId] = candidate;
  }
  return selected;
}
