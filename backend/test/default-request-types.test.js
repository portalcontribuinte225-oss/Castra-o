import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultRequestTypes, REQUEST_TYPES_CONFIG_KEY } from "../src/services/request-type-defaults.js";
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

test("a new municipality gets no identification types: the answer about the tutor is not configured", () => {
  const configs = buildMunicipalityDefaultConfigs({ id: "11111111-1111-4111-8111-111111111111" });
  assert.equal(Object.keys(configs).some((key) => /identification/i.test(key)), false);
});
