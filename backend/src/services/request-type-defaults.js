export const REQUEST_TYPES_CONFIG_KEY = "castragestao:request-types";

const DEFAULT_REQUEST_TYPES = Object.freeze([
  { id: "castracao", name: "Castração" },
  { id: "microchipagem", name: "Microchipagem" },
  { id: "vacinacao_antirrabica", name: "Vacinação antirrábica" },
  { id: "remocao_tumor", name: "Remoção de tumor" },
  { id: "esterilizacao_animal_rua", name: "Esterilização de animal de rua" },
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
