import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultIdentificationTypes, IDENTIFICATION_TYPES_CONFIG_KEY, planDefaultIdentificationTypes } from "../src/services/identification-type-defaults.js";
import { buildMunicipalityDefaultConfigs } from "../src/municipalityDefaults.js";

test("every municipality starts with both identification types active: with a tutor and without a tutor", () => {
  const [withTutor, withoutTutor] = buildDefaultIdentificationTypes();
  assert.deepEqual([withTutor.id, withTutor.name, withTutor.active, withTutor.stepTutor], ["animal_com_tutor", "Animal com Tutor", true, true]);
  assert.deepEqual([withoutTutor.id, withoutTutor.name, withoutTutor.active, withoutTutor.stepTutor], ["animal_sem_tutor", "Animal sem Tutor", true, false]);
  for (const type of [withTutor, withoutTutor]) assert.deepEqual(Object.keys(type), ["id", "name", "active", "stepTutor"], "the agenda and the documents are not configured per type");
});

test("a new municipality gets those types, each time as a separate copy", () => {
  const first = buildMunicipalityDefaultConfigs({ id: "11111111-1111-4111-8111-111111111111" })[IDENTIFICATION_TYPES_CONFIG_KEY];
  const second = buildMunicipalityDefaultConfigs({ id: "22222222-2222-4222-8222-222222222222" })[IDENTIFICATION_TYPES_CONFIG_KEY];
  assert.deepEqual(first.map(({ id, active }) => [id, active]), [["animal_com_tutor", true], ["animal_sem_tutor", true]]);
  first[1].active = false;
  assert.equal(second[1].active, true);
});

test("the load for an existing municipality only turns Animal sem Tutor on, leaving everything else as it is", () => {
  const stored = [{ id: "animal_com_tutor", name: "Com tutor (renomeado)", active: true, stepTutor: true },
    { id: "animal_sem_tutor", name: "Animal sem Tutor", active: false, stepTutor: false },
    { id: "custom", name: "Outro", active: false, stepTutor: true }];
  const before = JSON.stringify(stored);
  const plan = planDefaultIdentificationTypes(stored);
  assert.deepEqual(plan.types.map(({ id, active }) => [id, active]), [["animal_com_tutor", true], ["animal_sem_tutor", true], ["custom", false]]);
  assert.deepEqual(plan.types[1], { ...stored[1], active: true });
  assert.equal(plan.types[0], stored[0]);
  assert.equal(JSON.stringify(stored), before, "the stored value is not changed in place");
});

test("the load leaves alone a municipality with no stored types, without that type, or with it already on", () => {
  assert.match(planDefaultIdentificationTypes(undefined).skip, /não tem tipos/);
  assert.match(planDefaultIdentificationTypes(null).skip, /não tem tipos/);
  assert.match(planDefaultIdentificationTypes([{ id: "animal_com_tutor", active: true }]).skip, /não tem o tipo/);
  assert.match(planDefaultIdentificationTypes([null, { id: "x" }]).skip, /não tem o tipo/);
  assert.match(planDefaultIdentificationTypes([{ id: "animal_sem_tutor", active: true }]).skip, /já está ativo/);
  assert.match(planDefaultIdentificationTypes([{ id: "animal_sem_tutor" }]).skip, /já está ativo/);
});
