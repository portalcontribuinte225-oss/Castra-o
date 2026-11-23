import { MAX_REQUEST_TYPES_PER_ANIMAL, animalRequestTypeIds, deriveRequestTypeFields } from "../../../shared/request-types-contract.js";

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

// A configuration item that belongs to the municipality of the operation and is switched on (items without an owner are shared).
export function activeInMunicipality(item, municipalityId) {
  return Boolean(item) && typeof item === "object" && !Array.isArray(item)
    && item.active !== false && (!item.municipalityId || item.municipalityId === municipalityId);
}

// Checks the procedures sent for each animal against the active request types of the municipality and derives what is stored.
// Answers `null` when no animal carries procedures, which only a complaint may do; otherwise `{ animals, types, fields }`: the
// animals with their procedures normalized, the request types in the order they were chosen and the derived fields.
export function prepareRequestProcedures({ animals, municipalityId, settings }) {
  const list = Array.isArray(animals) ? animals : [];
  const carries = (animal) => Boolean(animal) && typeof animal === "object" && Object.hasOwn(animal, "requestTypeIds");
  if (!list.some(carries)) return null;
  const candidates = (Array.isArray(settings?.requestTypes) ? settings.requestTypes : []).filter((item) => activeInMunicipality(item, municipalityId));
  const chosen = [];
  const nextAnimals = list.map((animal) => {
    if (!carries(animal)) invalid("Escolha ao menos um procedimento para cada animal.");
    const sent = animal.requestTypeIds;
    if (!Array.isArray(sent) || sent.length > MAX_REQUEST_TYPES_PER_ANIMAL || sent.some((id) => typeof id !== "string")) invalid("Procedimentos do animal inválidos.");
    const ids = animalRequestTypeIds(animal);
    if (!ids.length) invalid("Escolha ao menos um procedimento para cada animal.");
    for (const id of ids) {
      const type = candidates.find((item) => item.id === id);
      if (!type) invalid("Tipo de solicitação inválido para o município.");
      if (!chosen.includes(type)) chosen.push(type);
    }
    return { ...animal, requestTypeIds: ids };
  });
  return { animals: nextAnimals, types: chosen, fields: deriveRequestTypeFields(chosen) };
}

// The part of the request's workflow that holds the derived procedures; the client's own copy of these keys is never kept.
export const DERIVED_WORKFLOW_KEYS = Object.freeze(["requestTypeIds", "requestTypeNames"]);

export function withDerivedProcedures(workflow, fields) {
  const next = { ...workflow };
  for (const key of DERIVED_WORKFLOW_KEYS) delete next[key];
  if (!fields) return next;
  delete next.requestTypeId;
  return { ...next, requestTypeIds: fields.requestTypeIds, requestTypeNames: fields.requestTypeNames };
}

const procedureSignature = (animals) => JSON.stringify((Array.isArray(animals) ? animals : []).map(animalRequestTypeIds));

// For the generic PATCH: when the procedures of the animals changed, the same checks as at creation apply and the derived
// fields follow, and animals left without any procedure are refused. Otherwise nothing is touched, so a request keeps working
// even if one of its types was switched off after it was made. Answers `null` when there is nothing to change, or
// `{ animals, requestType, workflow }`.
export function updateRequestProcedures({ previousAnimals, nextAnimals, workflow, municipalityId, settings }) {
  if (procedureSignature(previousAnimals) === procedureSignature(nextAnimals)) return null;
  const procedures = prepareRequestProcedures({ animals: nextAnimals, municipalityId, settings });
  if (!procedures) invalid("Escolha ao menos um procedimento para cada animal.");
  return { animals: procedures.animals, requestType: procedures.fields.requestType, workflow: withDerivedProcedures(workflow, procedures.fields) };
}
