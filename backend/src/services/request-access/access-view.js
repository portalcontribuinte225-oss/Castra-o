const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const text = (value) => (typeof value === "string" ? value : "");

// What the request document prints about each animal. Ids, photos and anything else the request keeps stay out.
const ANIMAL_FIELDS = ["name", "species", "sex", "size", "breedType", "breedDescription", "coat", "birthDate", "age", "weight",
  "dewormed", "vaccinated", "illnessHistory", "food", "hasChip", "microchip"];
// What the document reads from the workflow: the time of the visit, the procedures by name and two answers of the form.
const WORKFLOW_FIELDS = ["scheduleSlotTime", "scheduleTime", "isFarmer", "number"];

function animalView(animal) {
  const source = animal && typeof animal === "object" ? animal : {};
  const ids = Array.isArray(source.requestTypeIds) ? source.requestTypeIds.filter((id) => typeof id === "string") : [];
  return { ...Object.fromEntries(ANIMAL_FIELDS.map((key) => [key, text(source[key])])), ...(ids.length ? { requestTypeIds: ids } : {}) };
}

function workflowView(workflow) {
  const source = workflow && typeof workflow === "object" ? workflow : {};
  const names = (key) => (Array.isArray(source[key]) ? source[key].filter((item) => typeof item === "string") : []);
  const plain = (key) => typeof source[key] === "string" || typeof source[key] === "boolean";
  return {
    ...Object.fromEntries(WORKFLOW_FIELDS.filter(plain).map((key) => [key, source[key]])),
    requestTypeIds: names("requestTypeIds"), requestTypeNames: names("requestTypeNames"),
  };
}

// Allow-list projection: only what the request document prints about the tutor's own request. No history, notes, documents,
// assignment, internal data or other requests ever leave through this view.
export function buildAccessView(row) {
  return {
    protocol: row.protocol,
    request_type: text(row.request_type),
    status: row.status,
    origin: row.origin,
    created_at: toIso(row.created_at),
    signed_at: toIso(row.signed_at),
    schedule_date: row.schedule_date ? String(row.schedule_date) : "",
    schedule_location_name: text(row.schedule_location_name),
    schedule_address: text(row.schedule_address),
    schedule_address_url: text(row.schedule_address_url),
    schedule_municipality: text(row.schedule_municipality),
    municipality: text(row.municipality),
    responsible_unit: text(row.responsible_unit),
    veterinarian: text(row.veterinarian),
    tutor_name: text(row.tutor_name),
    cpf: text(row.cpf),
    phone: text(row.phone),
    tutor_email: text(row.tutor_email),
    cep: text(row.cep),
    address: text(row.address),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state),
    animals: (Array.isArray(row.animals) ? row.animals : []).slice(0, 25).map(animalView),
    workflow_data: workflowView(row.workflow_data),
  };
}
