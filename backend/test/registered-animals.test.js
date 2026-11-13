import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerRequestAnimals, prepareRegisteredRequest } from "../src/services/registered-animals/registered-request.js";
import { materializeOwnRequestAnimal } from "../src/services/registered-animals/from-request.js";
import { animalFingerprint } from "../src/services/registered-animals/animal-data.js";
import { confirmAnimalMicrochip, applyAnimalRequestTransition } from "../src/services/registered-animals/animal-transitions.js";
import { registeredAnimalDatabase, ANIMAL_TEST_MUNICIPALITY as MUNICIPALITY, ANIMAL_TEST_OTHER as OTHER,
  ANIMAL_TEST_USER as USER, ANIMAL_TEST_REQUEST as REQUEST } from "./fixtures/registered-animal-db.js";

const tutor = { id: USER, role: "tutor", municipalityId: MUNICIPALITY };
const staff = { id: randomUUID(), role: "analista", municipalityId: MUNICIPALITY };
const animalInput = (name = "Luna") => ({ name, species: "Cão", sex: "Fêmea", size: "Pequeno", breedType: "Definida", breedDescription: "Poodle", coat: "Branca", birthDate: "2020-01-01", microchip: "chip-123", identificationTypeId: "animal_com_tutor" });
const requestInput = (animals) => ({ id: REQUEST, tutor_id: USER, tutor_name: "Tutor", cpf: "52998224725", municipality_id: MUNICIPALITY,
  request_type: "PROCEDIMENTO", workflow_data: { identificationTypeId: "animal_com_tutor" }, animals, status: "NOVA" });

async function seed(db, count = 1) {
  db.profiles.set(USER, { id: USER, name: "Tutor Atual", cpf: "52998224725", email: "own@example.test", phone: "", municipality_id: MUNICIPALITY });
  const request = requestInput(Array.from({ length: count }, (_, index) => animalInput(`Animal ${index}`)));
  db.requests.set(REQUEST, request);
  await registerRequestAnimals(db, { body: request, request, user: tutor, tutorId: USER, municipalityId: MUNICIPALITY });
  return request;
}

test("first request creates all canonical UUIDs without reserving declared microchips", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db, 2);
  assert.equal(db.animals.size, 2); assert.equal(db.owners.length, 2); assert.equal(db.records.length, 2);
  assert.equal(request.animal_id, request.animals[0].id); assert.notEqual(request.animals[0].id, request.animals[1].id);
  for (const animal of db.animals.values()) {
    assert.equal(animal.microchip, null); assert.equal(animal.metadata.declaredMicrochip, "CHIP123");
    assert.equal(animal.breed, "Poodle"); assert.equal(animal.color, "Branca"); assert.equal(animal.birth_date, "2020-01-01");
  }
});

test("unclaimed request creates animals and municipal records without inventing owner account", async () => {
  const db = registeredAnimalDatabase(); const request = requestInput([animalInput()]);
  await registerRequestAnimals(db, { body: request, request, municipalityId: MUNICIPALITY, tutorId: null });
  assert.equal(db.animals.size, 1); assert.equal(db.records.length, 1); assert.equal(db.owners.length, 0);
});

test("existing animal request rehydrates immutable identity and rejects lost ownership or death", async () => {
  const db = registeredAnimalDatabase(); const original = await seed(db); const id = original.animals[0].id;
  const settings = { identificationTypes: [{ id: "animal_com_tutor", active: true }] };
  const body = await prepareRegisteredRequest(db, { body: { animals: [{ id, name: "Forged" }], cpf: "another-cpf", workflow_data: {} }, user: tutor, municipalityId: MUNICIPALITY, settings });
  assert.equal(body.animals[0].name, "Animal 0"); assert.equal(body.cpf, "52998224725"); assert.equal(body.tutor_name, "Tutor Atual");
  assert.match(db.calls.find(({ sql }) => sql.includes("SELECT a.* FROM animals a")).sql, /FOR UPDATE OF a/);
  await assert.rejects(prepareRegisteredRequest(db, { body, user: tutor, municipalityId: OTHER, settings }), { status: 404 });
  db.owners[0].active = false;
  await assert.rejects(prepareRegisteredRequest(db, { body, user: tutor, municipalityId: MUNICIPALITY, settings }), { status: 404 });
  db.owners[0].active = true; db.animals.get(id).status = "OBITO";
  await assert.rejects(prepareRegisteredRequest(db, { body, user: tutor, municipalityId: MUNICIPALITY, settings }), { status: 409 });
});

test("from-request conversion preserves stable fingerprint and is idempotent after UUID is added", async () => {
  const db = registeredAnimalDatabase(); const request = requestInput([animalInput()]); db.requests.set(REQUEST, request);
  const input = { sourceRequestId: REQUEST, animalIndex: 0, fingerprint: animalFingerprint(request.animals[0]), user: tutor, municipalityId: MUNICIPALITY };
  const first = await materializeOwnRequestAnimal(db, input); const repeated = await materializeOwnRequestAnimal(db, input);
  assert.equal(first.id, repeated.id); assert.equal(db.animals.size, 1);
  assert.match(db.calls.find(({ sql }) => sql.startsWith("SELECT * FROM requests")).sql, /FOR UPDATE/);
  db.requests.get(REQUEST).animals[0].name = "Changed";
  await assert.rejects(materializeOwnRequestAnimal(db, input), { status: 409 });
});

test("legacy provenance resolves an existing animal and never creates a clone for former owner", async () => {
  const db = registeredAnimalDatabase(); const original = await seed(db); const animalId = original.animals[0].id;
  const oldItem = animalInput("Animal 0"); db.requests.get(REQUEST).animals = [oldItem]; db.requests.get(REQUEST).animal_id = null;
  const input = { sourceRequestId: REQUEST, animalIndex: 0, fingerprint: animalFingerprint(oldItem), user: tutor, municipalityId: MUNICIPALITY };
  assert.equal((await materializeOwnRequestAnimal(db, input)).id, animalId); assert.equal(db.animals.size, 1);
  db.requests.get(REQUEST).animals = [oldItem]; db.requests.get(REQUEST).animal_id = null; db.owners[0].active = false;
  await assert.rejects(materializeOwnRequestAnimal(db, input), { status: 404 }); assert.equal(db.animals.size, 1);
});

test("internal microchip confirmation rejects global collision and never reassigns another record", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db); const animal = db.animals.get(request.animal_id);
  const foreign = { id: randomUUID(), microchip: "CHIP123" }; db.animals.set(foreign.id, foreign);
  await assert.rejects(confirmAnimalMicrochip(db, { animal, microchip: "chip123", municipalityId: MUNICIPALITY, user: staff }), { status: 409 });
  assert.equal(animal.microchip, null); assert.equal(foreign.microchip, "CHIP123");
  await assert.rejects(confirmAnimalMicrochip(db, { animal, microchip: "free123", municipalityId: MUNICIPALITY, user: tutor }), { status: 403 });
  assert.equal((await confirmAnimalMicrochip(db, { animal, microchip: "free123", municipalityId: MUNICIPALITY, user: staff })).microchip, "FREE123");
});

test("multi-animal attendance writes each record and repeated PATCH transition is a no-op", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db, 2); request.status = "REALIZADA";
  await applyAnimalRequestTransition(db, { previous: { status: "AGENDADA" }, request, user: staff });
  assert.equal(db.records.filter((row) => row.type === "CIRURGIA_REALIZADA").length, 2);
  const count = db.calls.length;
  await applyAnimalRequestTransition(db, { previous: { status: "REALIZADA" }, request, user: staff }); assert.equal(db.calls.length, count);
});

test("completing a legacy declaration never confirms its chip without explicit staff evidence", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db);
  Object.assign(request, { status: "REALIZADA", animal_microchip: "LEGACYDECLARED" });
  request.animals[0].microchip = "LEGACYDECLARED";
  await applyAnimalRequestTransition(db, { previous: { status: "AGENDADA" }, request, user: staff });
  assert.equal(db.animals.get(request.animal_id).microchip, null);
  assert.equal(db.records.some((row) => row.type === "MICROCHIP_CONFIRMADO"), false);
  request.workflow_data.attendanceMicrochip = "ACTUALREAD123";
  await applyAnimalRequestTransition(db, { previous: { status: "AGENDADA" }, request, user: staff });
  assert.equal(db.animals.get(request.animal_id).microchip, "ACTUALREAD123");
});

test("a concurrent global chip unique collision becomes a safe domain conflict", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db); const animal = db.animals.get(request.animal_id);
  const racingClient = { query(sql, values) {
    if (sql.startsWith("UPDATE animals SET microchip")) throw Object.assign(new Error("private unique constraint details"), { code: "23505" });
    return db.query(sql, values);
  } };
  await assert.rejects(confirmAnimalMicrochip(racingClient, { animal, microchip: "RACINGCHIP", municipalityId: MUNICIPALITY, user: staff }),
    (error) => error.status === 409 && !error.message.includes("private unique"));
  assert.equal(animal.microchip, null);
});

test("municipal transfer closes only scoped relationships and links a trusted existing profile", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db); const targetId = randomUUID();
  db.profiles.set(targetId, { id: targetId, name: "New Tutor", cpf: "11144477735", municipality_id: MUNICIPALITY });
  const outside = { id: randomUUID(), animal_id: request.animal_id, user_id: randomUUID(), active: true, municipality_id: OTHER };
  db.owners.push(outside);
  Object.assign(request, { status: "REALIZADA", request_type: "TROCA_TUTOR", target_tutor_cpf: "11144477735", target_tutor_name: "New Tutor" });
  await applyAnimalRequestTransition(db, { previous: { status: "NOVA" }, request, user: staff });
  assert.equal(db.owners[0].active, false); assert.equal(outside.active, true); assert.equal(db.owners.at(-1).user_id, targetId);
  assert.equal(db.calls.some(({ sql }) => /^UPDATE animal_tutors/.test(sql) && !sql.includes("id=ANY")), false);
  const ownerCount = db.owners.length;
  await applyAnimalRequestTransition(db, { previous: { status: "AGENDADA" }, request, user: staff });
  assert.equal(db.owners.length, ownerCount, "reopening a completed transfer cannot duplicate its side effects");
});

test("readonly incomplete registration stays incomplete and cannot bypass server validation", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db); const row = db.animals.get(request.animal_id);
  delete row.metadata.registration.breedType;
  await assert.rejects(prepareRegisteredRequest(db, { body: { animals: [{ id: row.id, breedType: "Definida" }] }, user: tutor,
    municipalityId: MUNICIPALITY, settings: { identificationTypes: [{ id: "animal_com_tutor", active: true }] } }), { status: 409 });
});

test("death applies to all UUIDs once and complaints never write surgical records", async () => {
  const db = registeredAnimalDatabase(); const request = await seed(db, 2);
  Object.assign(request, { status: "REALIZADA", request_type: "ANIMAL_OBITO" });
  await applyAnimalRequestTransition(db, { previous: { status: "NOVA" }, request, user: staff });
  assert.ok([...db.animals.values()].every((row) => row.status === "OBITO"));
  const updates = db.calls.filter(({ sql }) => sql.startsWith("UPDATE animals SET status")).length;
  await applyAnimalRequestTransition(db, { previous: { status: "NOVA" }, request, user: staff });
  assert.equal(db.calls.filter(({ sql }) => sql.startsWith("UPDATE animals SET status")).length, updates);
  request.request_type = "DENUNCIA";
  await applyAnimalRequestTransition(db, { previous: { status: "NOVA" }, request, user: staff });
  assert.equal(db.records.some((row) => row.type === "CIRURGIA_REALIZADA"), false);
});
