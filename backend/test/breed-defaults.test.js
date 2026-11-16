import test from "node:test";
import assert from "node:assert/strict";
import { BREEDS_CONFIG_KEY, buildDefaultBreeds, planBreedSeed } from "../src/services/breed-defaults.js";
import { buildMunicipalityDefaultConfigs, upsertMunicipalityDefaultConfigs } from "../src/municipalityDefaults.js";

const municipality = { id: "11111111-1111-4111-8111-111111111111", name: "Test Town", state: "SC" };
const species = [{ id: "canino", name: "Canino", active: true }, { id: "felino", name: "Felino", active: true }];

test("the default breeds are the five most common dogs and cats, active, with stable ids", () => {
  const breeds = buildDefaultBreeds();
  assert.deepEqual(breeds.filter(({ speciesId }) => speciesId === "canino").map(({ name }) => name),
    ["Shih Tzu", "Pastor Alemão", "Golden Retriever", "Labrador Retriever", "Poodle"]);
  assert.deepEqual(breeds.filter(({ speciesId }) => speciesId === "felino").map(({ name }) => name),
    ["Siamês", "Persa", "Maine Coon", "Ragdoll", "Angorá"]);
  assert.deepEqual(breeds.map(({ id }) => id), ["canino_shih_tzu", "canino_pastor_alemao", "canino_golden_retriever", "canino_labrador_retriever",
    "canino_poodle", "felino_siames", "felino_persa", "felino_maine_coon", "felino_ragdoll", "felino_angora"]);
  assert.equal(breeds.every(({ active }) => active === true), true);
  assert.equal(JSON.stringify(buildDefaultBreeds()), JSON.stringify(breeds), "building twice gives the same list");
});

test("a new municipality starts with the breeds, on the species it also starts with, and its request types link them", () => {
  const configs = buildMunicipalityDefaultConfigs(municipality);
  const speciesIds = configs["castragestao:species"].map(({ id }) => id);
  assert.deepEqual(configs[BREEDS_CONFIG_KEY], buildDefaultBreeds());
  for (const breed of configs[BREEDS_CONFIG_KEY]) assert.ok(speciesIds.includes(breed.speciesId), breed.id);
  const everyId = buildDefaultBreeds().map(({ id }) => id);
  assert.equal(configs["castragestao:request-types"].length > 0, true);
  for (const type of configs["castragestao:request-types"]) assert.deepEqual(type.breedIds, everyId, type.id);
  const [first, second] = configs["castragestao:request-types"];
  first.breedIds.pop();
  assert.equal(second.breedIds.length, everyId.length, "each request type has its own list");
});

test("creating a municipality writes the breeds only when it has none, while the other defaults still refresh", async () => {
  const queries = [];
  const client = { query: async (sql, values) => { queries.push({ sql, key: values[0] }); return { rows: [] }; } };
  await upsertMunicipalityDefaultConfigs(client, municipality, { id: "admin-1" });
  const breeds = queries.find(({ key }) => key === BREEDS_CONFIG_KEY);
  assert.match(breeds.sql, /DO NOTHING/);
  assert.doesNotMatch(breeds.sql, /DO UPDATE/);
  for (const other of queries.filter(({ key }) => key !== BREEDS_CONFIG_KEY)) assert.match(other.sql, /DO UPDATE/, other.key);
});

test("the load for an existing municipality leaves alone one that has breeds or lacks the default species", () => {
  const breeds = [{ id: "mine", name: "Minha raça", speciesId: "canino", active: true }];
  assert.match(planBreedSeed({ species, breeds, requestTypes: [] }).skip, /já tem raças/);
  assert.match(planBreedSeed({ species: [{ id: "canino" }], breeds: [], requestTypes: [] }).skip, /espécies padrão/);
  assert.match(planBreedSeed({ species: [{ id: "cao" }, { id: "gato" }], breeds: undefined, requestTypes: [] }).skip, /espécies padrão/);
  assert.match(planBreedSeed({ species: undefined, breeds: undefined, requestTypes: undefined }).skip, /espécies padrão/);
});

test("the load adds the breeds when there are none, and links only the request types that link none", () => {
  const everyId = buildDefaultBreeds().map(({ id }) => id);
  const requestTypes = [{ id: "a", name: "A" }, { id: "b", name: "B", breedIds: [] }, { id: "c", name: "C", breedIds: ["canino_poodle"] }, null];
  const before = JSON.stringify(requestTypes);
  for (const breeds of [undefined, null, []]) {
    const plan = planBreedSeed({ species, breeds, requestTypes });
    assert.deepEqual(plan.breeds, buildDefaultBreeds());
    assert.deepEqual(plan.requestTypes.map((type) => type?.breedIds), [everyId, everyId, ["canino_poodle"], undefined]);
    assert.equal(plan.requestTypes[2], requestTypes[2], "a request type that already links breeds is not rewritten");
    assert.deepEqual(plan.requestTypes.slice(0, 2).map(({ id, name }) => [id, name]), [["a", "A"], ["b", "B"]]);
  }
  assert.equal(JSON.stringify(requestTypes), before, "the stored values are not changed in place");
  assert.equal(planBreedSeed({ species, breeds: [], requestTypes: undefined }).requestTypes, undefined);
});
