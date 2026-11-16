import { AnimalTutorship } from "../../../shared/request-tutorship-contract.js";

export const IDENTIFICATION_TYPES_CONFIG_KEY = "castragestao:identification-types";

export function buildDefaultIdentificationTypes() {
  return [
    {
      id: AnimalTutorship.WITH_TUTOR,
      name: "Animal com Tutor",
      active: true,
      stepTutor: true,
      stepAgenda: true,
      stepDocuments: true,
    },
    {
      id: AnimalTutorship.WITHOUT_TUTOR,
      name: "Animal sem Tutor",
      active: true,
      stepTutor: false,
      stepAgenda: true,
      stepDocuments: true,
    },
  ];
}

// What to write for a municipality that already exists: "Animal sem Tutor" turned on when it is there but inactive, which is how
// it used to start. Nothing else is touched (names, steps and any type the municipality added stay as they are).
// Returns `{ skip: reason }` or the new `types`.
export function planDefaultIdentificationTypes(types) {
  if (!Array.isArray(types)) return { skip: "não tem tipos de identificação gravados (vale o padrão de leitura, que já é ativo)" };
  const index = types.findIndex((type) => type?.id === AnimalTutorship.WITHOUT_TUTOR);
  if (index < 0) return { skip: "não tem o tipo Animal sem Tutor" };
  if (types[index].active !== false) return { skip: "Animal sem Tutor já está ativo" };
  return { types: types.map((type, position) => (position === index ? { ...type, active: true } : type)) };
}
