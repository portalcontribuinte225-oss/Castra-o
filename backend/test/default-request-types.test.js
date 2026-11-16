import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultRequestTypes, planDefaultRequestTypes, REQUEST_TYPES_CONFIG_KEY } from "../src/services/request-type-defaults.js";
import { buildDefaultBreeds } from "../src/services/breed-defaults.js";
import { buildMunicipalityDefaultConfigs } from "../src/municipalityDefaults.js";

const breedIds = buildDefaultBreeds().map(({ id }) => id);
const names = ["Castração", "Microchipagem", "Vacinação antirrábica", "Remoção de tumor", "Esterilização de animal de rua"];

test("a new municipality starts with five free procedures, each asking for the proof of residence and linked to the default breeds", () => {
  const types = buildMunicipalityDefaultConfigs({ id: "11111111-1111-4111-8111-111111111111" })[REQUEST_TYPES_CONFIG_KEY];
  assert.deepEqual(types.map(({ name }) => name), names);
  assert.deepEqual(types.map(({ id }) => id), ["castracao", "microchipagem", "vacinacao_antirrabica", "remocao_tumor", "esterilizacao_animal_rua"]);
  for (const type of types) {
    assert.deepEqual([type.fee, type.charged, type.active, type.overrideDailyLimit], ["Gratuito", false, true, false], type.id);
    assert.deepEqual(type.breedIds, breedIds, type.id);
    assert.deepEqual(type.documents.map(({ id, required, active }) => [id, required, active]), [["comprovante_residencia", false, true]], type.id);
    assert.equal(type.stepTutor, undefined, "no step is switched off by default");
  }
});

test("each default type is its own copy, so changing one municipality's list never reaches another", () => {
  const first = buildDefaultRequestTypes(breedIds);
  const second = buildDefaultRequestTypes(breedIds);
  first[0].breedIds.pop(); first[0].documents[0].required = true; first[1].active = false;
  assert.equal(second[0].breedIds.length, breedIds.length);
  assert.equal(second[0].documents[0].required, false);
  assert.equal(second[1].active, true);
  assert.deepEqual(buildDefaultRequestTypes().map(({ breedIds: linked }) => linked), [[], [], [], [], []]);
});

test("the load adds only the procedures a municipality lacks, at the end, and never changes or removes what it has", () => {
  const stored = [
    { id: "remocao_tumor", name: "Remoção de tumor", fee: "R$ 30,00", charged: true, active: false, breedIds: ["mine"], overrideDailyLimit: true },
    { id: "esterilizacao_animal_rua", name: "Esterilização de animal de rua", active: true },
    { id: "custom", name: "Atendimento do município", active: true },
  ];
  const before = JSON.stringify(stored);
  const plan = planDefaultRequestTypes({ requestTypes: stored, breedIds });
  assert.deepEqual(plan.added, ["Castração", "Microchipagem", "Vacinação antirrábica"]);
  assert.deepEqual(plan.types.map(({ id }) => id), ["remocao_tumor", "esterilizacao_animal_rua", "custom", "castracao", "microchipagem", "vacinacao_antirrabica"]);
  assert.deepEqual(plan.types.slice(0, 3), stored);
  assert.equal(plan.types[0], stored[0], "an existing type is the same object, untouched");
  assert.deepEqual(plan.types[3].breedIds, breedIds);
  assert.equal(JSON.stringify(stored), before, "the stored value is not changed in place");
});

test("a type the municipality already has under another id but the same name is not added twice", () => {
  const stored = [{ id: "identification_1700000000000", name: " castracao " }, { id: "x", name: "MICROCHIPAGEM" }];
  const plan = planDefaultRequestTypes({ requestTypes: stored, breedIds });
  assert.deepEqual(plan.added, ["Vacinação antirrábica", "Remoção de tumor", "Esterilização de animal de rua"]);
});

test("the new types are linked only to the default breeds the municipality has, and the load is idempotent", () => {
  const owned = breedIds.slice(0, 3);
  const plan = planDefaultRequestTypes({ requestTypes: [], breedIds: owned });
  assert.deepEqual(plan.types.map(({ breedIds: linked }) => linked), names.map(() => owned));
  assert.match(planDefaultRequestTypes({ requestTypes: plan.types, breedIds: owned }).skip, /já tem todos/);
  assert.equal(planDefaultRequestTypes({ requestTypes: undefined }).types.length, 5, "a municipality with no stored list receives all five");
  assert.equal(planDefaultRequestTypes({ requestTypes: null, breedIds: undefined }).types.length, 5);
});

test("a new municipality gets no identification types: the answer about the tutor is not configured", () => {
  const configs = buildMunicipalityDefaultConfigs({ id: "11111111-1111-4111-8111-111111111111" });
  assert.equal(Object.keys(configs).some((key) => /identification/i.test(key)), false);
});
