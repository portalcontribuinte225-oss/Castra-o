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
      active: false,
      stepTutor: false,
      stepAgenda: true,
      stepDocuments: true,
    },
  ];
}
