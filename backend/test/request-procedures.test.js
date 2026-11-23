import test from "node:test";
import assert from "node:assert/strict";
import {
  DERIVED_WORKFLOW_KEYS, activeInMunicipality, prepareRequestProcedures, updateRequestProcedures, withDerivedProcedures,
} from "../src/services/request-procedures.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const settings = {
  requestTypes: [
    { id: "castration", name: "Castração", active: true },
    { id: "microchip", name: "Microchipagem", active: true, municipalityId: MUNICIPALITY },
    { id: "vaccine", name: "Vacinação antirrábica", active: false },
    { id: "foreign", name: "De outro município", active: true, municipalityId: OTHER },
  ],
};
const prepare = (animals) => prepareRequestProcedures({ animals, municipalityId: MUNICIPALITY, settings });

test("an item belongs to the operation when it is on and either shared or owned by the municipality", () => {
  assert.equal(activeInMunicipality({ id: "a", active: true }, MUNICIPALITY), true);
  assert.equal(activeInMunicipality({ id: "a" }, MUNICIPALITY), true);
  assert.equal(activeInMunicipality({ id: "a", municipalityId: MUNICIPALITY }, MUNICIPALITY), true);
  for (const item of [{ id: "a", active: false }, { id: "a", municipalityId: OTHER }, null, [], "a"]) assert.equal(activeInMunicipality(item, MUNICIPALITY), false, JSON.stringify(item));
});

test("a request whose animals carry no procedures is made the old way and is left to the single-type rules", () => {
  assert.equal(prepare([{ name: "Rex" }, {}]), null);
  assert.equal(prepare([]), null);
  assert.equal(prepare(undefined), null);
  assert.equal(prepare([null, "text"]), null);
});

test("each animal's procedures are checked and normalized, and the request's types and fields are derived in order", () => {
  const result = prepare([
    { name: "Rex", species: "Canino", requestTypeIds: ["microchip", " castration ", "microchip"] },
    { name: "Mia", requestTypeIds: ["castration"], breedDescription: "Siamês" },
  ]);
  assert.deepEqual(result.animals, [
    { name: "Rex", species: "Canino", requestTypeIds: ["microchip", "castration"] },
    { name: "Mia", requestTypeIds: ["castration"], breedDescription: "Siamês" },
  ]);
  assert.deepEqual(result.types.map(({ id }) => id), ["microchip", "castration"]);
  assert.deepEqual(result.fields, { requestTypeIds: ["microchip", "castration"], requestTypeNames: ["Microchipagem", "Castração"], requestType: "Microchipagem, Castração" });
});

test("an unknown, switched-off or foreign procedure is refused, and so is an animal without any", () => {
  for (const ids of [["unknown"], ["vaccine"], ["foreign"], ["castration", "foreign"]]) {
    assert.throws(() => prepare([{ requestTypeIds: ids }]), { status: 400, message: /Tipo de solicitação inválido/ }, ids.join());
  }
  assert.throws(() => prepare([{ requestTypeIds: ["castration"] }, {}]), { status: 400, message: /ao menos um procedimento/ });
  assert.throws(() => prepare([{ requestTypeIds: ["castration"] }, { requestTypeIds: [] }]), { status: 400, message: /ao menos um procedimento/ });
  assert.throws(() => prepare([{ requestTypeIds: ["", " "] }]), { status: 400, message: /ao menos um procedimento/ });
});

test("a malformed or oversized list of procedures is refused before anything is looked up", () => {
  for (const requestTypeIds of ["castration", { 0: "castration" }, [5], [null], [["castration"]], Array(11).fill("castration")]) {
    assert.throws(() => prepare([{ requestTypeIds }]), { status: 400, message: /Procedimentos do animal inválidos/ }, JSON.stringify(requestTypeIds));
  }
  assert.doesNotThrow(() => prepare([{ requestTypeIds: Array(10).fill("castration") }]));
});

test("the derived workflow keys are replaced by the server's, and the client's copies are never kept", () => {
  const forged = { requestTypeIds: ["foreign"], requestTypeNames: ["Forjado"], requestTypeId: "foreign", notes: "kept" };
  const fields = { requestTypeIds: ["castration"], requestTypeNames: ["Castração"], requestType: "Castração" };
  assert.deepEqual(withDerivedProcedures(forged, fields), { notes: "kept", requestTypeIds: ["castration"], requestTypeNames: ["Castração"] });
  assert.deepEqual(withDerivedProcedures(forged, null), { requestTypeId: "foreign", notes: "kept" }, "an old-style request keeps only its single type for the route to settle");
  assert.deepEqual(withDerivedProcedures({}, null), {});
  assert.equal(Object.isFrozen(DERIVED_WORKFLOW_KEYS), true);
  assert.deepEqual([...DERIVED_WORKFLOW_KEYS], ["requestTypeIds", "requestTypeNames"]);
});

test("a PATCH that leaves the procedures as they were touches nothing, even if one of the types was switched off since; one that drops them is refused", () => {
  const stored = [{ name: "Rex", requestTypeIds: ["vaccine"] }];
  const same = [{ name: "Rex II", requestTypeIds: ["vaccine"], species: "Canino" }];
  assert.equal(updateRequestProcedures({ previousAnimals: stored, nextAnimals: same, workflow: {}, municipalityId: MUNICIPALITY, settings }), null);
  assert.throws(() => updateRequestProcedures({ previousAnimals: stored, nextAnimals: [{ name: "Rex" }], workflow: {}, municipalityId: MUNICIPALITY, settings }),
    /ao menos um procedimento/, "animals sent back without procedures are refused");
});

test("a PATCH that changes the procedures applies the creation checks and derives the fields again", () => {
  const workflow = { requestTypeIds: ["vaccine"], requestTypeNames: ["Vacinação antirrábica"], scheduleTime: "08:00" };
  const update = updateRequestProcedures({ previousAnimals: [{ requestTypeIds: ["vaccine"] }], nextAnimals: [{ requestTypeIds: ["castration", "microchip"] }],
    workflow, municipalityId: MUNICIPALITY, settings });
  assert.deepEqual(update.animals, [{ requestTypeIds: ["castration", "microchip"] }]);
  assert.equal(update.requestType, "Castração, Microchipagem");
  assert.deepEqual(update.workflow, { scheduleTime: "08:00", requestTypeIds: ["castration", "microchip"], requestTypeNames: ["Castração", "Microchipagem"] });
  assert.throws(() => updateRequestProcedures({ previousAnimals: [{ requestTypeIds: ["castration"] }], nextAnimals: [{ requestTypeIds: ["foreign"] }],
    workflow, municipalityId: MUNICIPALITY, settings }), { status: 400 });
  assert.throws(() => updateRequestProcedures({ previousAnimals: [{ requestTypeIds: ["castration"] }], nextAnimals: [{ requestTypeIds: ["castration"] }, { requestTypeIds: [] }],
    workflow, municipalityId: MUNICIPALITY, settings }), { status: 400 });
});
