import test from "node:test";
import assert from "node:assert/strict";
import { AnimalTutorship, isAnimalTutorship, tutorshipRequiresTutor } from "../../shared/request-tutorship-contract.js";

test("the tutorship ids are the ones stored with the requests and the animals, and they cannot be changed", () => {
  assert.deepEqual({ ...AnimalTutorship }, { WITH_TUTOR: "animal_com_tutor", WITHOUT_TUTOR: "animal_sem_tutor" });
  assert.equal(Object.isFrozen(AnimalTutorship), true);
});

test("only the two ids are answers", () => {
  for (const answer of Object.values(AnimalTutorship)) assert.equal(isAnimalTutorship(answer), true, answer);
  for (const other of [undefined, null, "", "owned", "with_tutor", "ANIMAL_COM_TUTOR", " animal_com_tutor", 1, {}, ["animal_com_tutor"]]) assert.equal(isAnimalTutorship(other), false, String(other));
});

test("the tutor is asked for unless the animal has none, and no answer counts as with a tutor", () => {
  assert.equal(tutorshipRequiresTutor(AnimalTutorship.WITH_TUTOR), true);
  assert.equal(tutorshipRequiresTutor(AnimalTutorship.WITHOUT_TUTOR), false);
  for (const none of [undefined, null, ""]) assert.equal(tutorshipRequiresTutor(none), true, String(none));
});
