export const REQUEST_TYPES_CONFIG_KEY = "castragestao:request-types";

const DEFAULT_REQUEST_TYPES = Object.freeze([
  { id: "castracao", name: "Castração" },
  { id: "microchipagem", name: "Microchipagem" },
  { id: "vacinacao_antirrabica", name: "Vacinação antirrábica" },
  { id: "ninhada", name: "Ninhada" },
  { id: "animal_rua", name: "Animal de Rua" },
]);

// Every default procedure is free, asks for the proof of residence (not required) and is linked to the given breeds.
function buildRequestType({ id, name }, breedIds) {
  return {
    id,
    name,
    fee: "Gratuito",
    charged: false,
    billingDescription: "",
    billingAmount: "",
    billingDueDate: "",
    active: true,
    overrideDailyLimit: false,
    breedIds: [...breedIds],
    documents: [
      {
        id: "comprovante_residencia",
        name: "Comprovante de Residência",
        required: false,
        active: true,
        accept: ["image/jpeg", "image/png", "application/pdf"],
        maxSizeMb: 5,
      },
    ],
  };
}

export function buildDefaultRequestTypes(breedIds = []) {
  return DEFAULT_REQUEST_TYPES.map((type) => buildRequestType(type, breedIds));
}

const sameName = (left, right) => String(left ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
  === String(right ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// What to write for a municipality that already exists: the default procedures it does not have yet, added at the end. A type
// the municipality already has (same id, or same name) is never changed, and nothing is removed. The new types are linked to the
// default breeds the municipality has. Returns `{ skip: reason }` or `{ types, added }`.
export function planDefaultRequestTypes({ requestTypes, breedIds = [] }) {
  const current = Array.isArray(requestTypes) ? requestTypes : [];
  const present = (type) => current.some((item) => item?.id === type.id || sameName(item?.name, type.name));
  const missing = DEFAULT_REQUEST_TYPES.filter((type) => !present(type));
  if (!missing.length) return { skip: "já tem todos os tipos padrão" };
  const added = missing.map((type) => buildRequestType(type, breedIds));
  return { types: [...current, ...added], added: added.map(({ name }) => name) };
}
