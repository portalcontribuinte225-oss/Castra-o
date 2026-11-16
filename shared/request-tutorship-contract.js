// Whether the animal has a tutor, as the person answers it when making the request. The ids are the ones stored with the requests and
// with the registered animals; nothing else is a valid answer, and nothing a municipality configures can add one.
export const AnimalTutorship = Object.freeze({
  WITH_TUTOR: "animal_com_tutor",
  WITHOUT_TUTOR: "animal_sem_tutor",
});

export function isAnimalTutorship(value) {
  return Object.values(AnimalTutorship).includes(value);
}

// The tutor's identity is asked for unless the animal has no tutor. Without an answer the animal is taken to have one.
export function tutorshipRequiresTutor(tutorship) {
  return tutorship !== AnimalTutorship.WITHOUT_TUTOR;
}
