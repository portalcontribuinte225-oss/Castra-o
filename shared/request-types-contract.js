// A request carries the procedures (request types of the municipality) chosen for each animal: `animals[].requestTypeIds`.
// Everything else about them is derived from that list on the server, never taken from the client:
//   workflow_data.requestTypeIds / requestTypeNames  the distinct procedures of the whole request, in order
//   animals[].requestTypeNames                       the names of each animal's procedures
//   request_type                                     those names, whole, joined by REQUEST_TYPE_NAME_SEPARATOR
export const MAX_REQUEST_TYPES_PER_ANIMAL = 10;
export const MAX_REQUEST_ANIMALS = 25;
export const REQUEST_TYPE_NAME_SEPARATOR = ", ";
const FREE_FEE_LABEL = "Gratuito";

const distinct = (values) => [...new Set(values)];

/** @returns {string[]} */
function idsOf(value) {
  return Array.isArray(value) ? distinct(value.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim())) : [];
}

/** @returns {string[]} */
export function animalRequestTypeIds(animal) {
  return idsOf(animal?.requestTypeIds);
}

// The procedures of the whole request: the ones of every animal, each once, in the order they were chosen.
/** @returns {string[]} */
export function distinctRequestTypeIds(animals) {
  return distinct((Array.isArray(animals) ? animals : []).flatMap(animalRequestTypeIds));
}

// The entries of the municipality's request types that a request was made with: the animals' procedures, or else the list the
// server stored for the request.
export function resolveRequestTypes({ animals, workflow } = {}, types) {
  const list = Array.isArray(types) ? types.filter((type) => type && typeof type === "object") : [];
  const stored = (workflow && typeof workflow === "object" && !Array.isArray(workflow)) ? workflow : {};
  const ids = distinctRequestTypeIds(animals);
  const chosen = ids.length ? ids : idsOf(stored.requestTypeIds);
  return chosen.map((id) => list.find((type) => type.id === id)).filter(Boolean);
}

// What the server stores for the procedures of a request, from the entries of the municipality's request types.
export function deriveRequestTypeFields(types) {
  const list = Array.isArray(types) ? types : [];
  const names = list.map((type) => type.name);
  return { requestTypeIds: list.map((type) => type.id), requestTypeNames: names, requestType: names.join(REQUEST_TYPE_NAME_SEPARATOR) };
}

export function isRequestTypeCharged(type) {
  return Boolean(type?.charged);
}

// Fees are not added up: free when every procedure is free, otherwise each charged procedure with its value.
export function combineRequestFees(types) {
  const charged = (Array.isArray(types) ? types : []).filter(isRequestTypeCharged);
  if (!charged.length) return FREE_FEE_LABEL;
  return charged.map((type) => `${type.name}: ${type.billingAmount || type.fee || ""}`.trim()).join("; ");
}

