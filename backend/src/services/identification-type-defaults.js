export const IDENTIFICATION_TYPES_CONFIG_KEY = "castragestao:identification-types";

export function buildDefaultIdentificationTypes() {
  return [
    {
      id: "animal_com_tutor",
      name: "Animal com Tutor",
      active: true,
      stepTutor: true,
      stepAgenda: true,
      stepDocuments: true,
    },
    {
      id: "animal_sem_tutor",
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
  const index = types.findIndex((type) => type?.id === "animal_sem_tutor");
  if (index < 0) return { skip: "não tem o tipo Animal sem Tutor" };
  if (types[index].active !== false) return { skip: "Animal sem Tutor já está ativo" };
  return { types: types.map((type, position) => (position === index ? { ...type, active: true } : type)) };
}
