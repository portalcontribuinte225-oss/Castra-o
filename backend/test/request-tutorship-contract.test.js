import test from "node:test";
import assert from "node:assert/strict";
import { AnimalTutorship } from "../../shared/request-tutorship-contract.js";
import { buildDefaultIdentificationTypes } from "../src/services/identification-type-defaults.js";

test("the tutorship ids are the ones stored with the requests and the animals, and the default identification types use them", () => {
  assert.deepEqual({ ...AnimalTutorship }, { WITH_TUTOR: "animal_com_tutor", WITHOUT_TUTOR: "animal_sem_tutor" });
  assert.equal(Object.isFrozen(AnimalTutorship), true);
  assert.deepEqual(buildDefaultIdentificationTypes().map((type) => type.id), [AnimalTutorship.WITH_TUTOR, AnimalTutorship.WITHOUT_TUTOR]);
});
