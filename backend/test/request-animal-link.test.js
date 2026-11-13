import test from "node:test";
import assert from "node:assert/strict";
import { validateRequestAnimalLink } from "../src/services/request-animal-link.js";

const municipalityId = "11111111-1111-4111-8111-111111111111";
const animalId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

test("new animals without persisted identifiers need no database lookup", async () => {
  await validateRequestAnimalLink({ query: async () => assert.fail("no lookup") }, { body: { animals: [{ name: "New" }] }, municipalityId });
});

test("anonymous caller cannot attach an existing animal to a submitted request", async () => {
  await assert.rejects(validateRequestAnimalLink({}, { body: { animal_id: animalId }, municipalityId }), { status: 403 });
});

test("tutor animal references require active ownership within the same municipality", async () => {
  const client = { query: async (sql, values) => {
    assert.match(sql, /r\.animal_id = a\.id AND r\.municipality_id = \$1/);
    assert.doesNotMatch(sql, /a\.municipality_id/);
    assert.match(sql, /t\.user_id = \$3 AND t\.active = TRUE/);
    assert.deepEqual(values, [municipalityId, [animalId], userId]);
    return { rows: [{ id: animalId }] };
  } };
  await validateRequestAnimalLink(client, { body: { animal_id: animalId, animals: [{ id: animalId }] }, municipalityId, user: { id: userId, role: "tutor" } });
  await assert.rejects(validateRequestAnimalLink({ query: async () => ({ rows: [] }) }, { body: { animal_id: animalId }, municipalityId, user: { id: userId, role: "tutor" } }), { status: 403 });
});

test("internal staff may attach only animals in the operation municipality", async () => {
  const client = { query: async (sql, values) => {
    assert.match(sql, /r\.animal_id = a\.id AND r\.municipality_id = \$1/);
    assert.doesNotMatch(sql, /a\.municipality_id/);
    assert.doesNotMatch(sql, /t\.user_id/);
    assert.deepEqual(values, [municipalityId, [animalId]]);
    return { rows: [{ id: animalId }] };
  } };
  await validateRequestAnimalLink(client, { body: { animalId }, municipalityId, user: { id: userId, role: "analista" } });
});
