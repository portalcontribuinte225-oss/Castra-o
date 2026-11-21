import test from "node:test";
import assert from "node:assert/strict";
import { prepareAnimalNeighborhoods } from "../src/services/request-neighborhoods.js";
import { activeNeighborhoods, normalizeNeighborhoodName } from "../src/services/neighborhood-defaults.js";
import { prepareRequestSubmission } from "../src/services/request-submission.js";

const MUNICIPALITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const neighborhoods = [
  { id: "centro", name: "Centro", active: true },
  { id: "pinheirinho", name: " Pinheirinho ", active: true, municipalityId: MUNICIPALITY },
  { id: "old", name: "Bairro Antigo", active: false },
  { id: "foreign", name: "De Outra Cidade", active: true, municipalityId: OTHER },
  { id: "legacy-foreign", name: "Distrito de Outra Cidade", active: true, municipality_id: OTHER },
];
const prepare = (animals, list = neighborhoods) => prepareAnimalNeighborhoods({ animals, municipalityId: MUNICIPALITY, settings: { neighborhoods: list } });

test("the neighborhoods of a municipality are the active ones that are shared or its own", () => {
  assert.deepEqual(activeNeighborhoods(neighborhoods, MUNICIPALITY).map(({ id }) => id), ["centro", "pinheirinho"]);
  assert.deepEqual(activeNeighborhoods(neighborhoods, OTHER).map(({ id }) => id), ["centro", "foreign", "legacy-foreign"]);
  assert.deepEqual(activeNeighborhoods(undefined, MUNICIPALITY), []);
  assert.equal(normalizeNeighborhoodName("  São   João "), "sao joao");
});

test("a new animal must name its neighborhood, and the name is the one registered", () => {
  assert.throws(() => prepare([{ name: "Rex" }]), { status: 400, message: /Informe o bairro do animal/ });
  assert.throws(() => prepare([{ neighborhood: "   " }]), { status: 400 });
  assert.throws(() => prepare([{ neighborhood: "Centro" }, { neighborhood: "" }]), { status: 400, message: /animal 2/ });
  assert.deepEqual(prepare([{ neighborhood: "centro" }, { neighborhood: "PINHEIRINHO" }]).map((animal) => animal.neighborhood), ["Centro", "Pinheirinho"]);
});

test("a neighborhood outside the municipality list, switched off or from another municipality is refused", () => {
  for (const name of ["Bairro Antigo", "De Outra Cidade", "Distrito de Outra Cidade", "Inventado"]) {
    assert.throws(() => prepare([{ neighborhood: name }]), { status: 400, message: /Escolha um bairro da lista/ }, name);
  }
});

test("without registered neighborhoods the answer is free text, still required and limited", () => {
  assert.deepEqual(prepare([{ neighborhood: " Vila Nova " }], []), [{ neighborhood: "Vila Nova" }]);
  assert.deepEqual(prepare([{ neighborhood: "Vila Nova" }], [{ name: "Distrito", municipality_id: OTHER }]), [{ neighborhood: "Vila Nova" }]);
  assert.throws(() => prepare([{}], []), { status: 400 });
  assert.throws(() => prepare([{ neighborhood: "x".repeat(121) }], []), { status: 400, message: /muito longo/ });
});

test("animals that already exist keep their own record and are not asked again", () => {
  const existing = { id: "33333333-3333-4333-8333-333333333333", name: "Mia" };
  assert.deepEqual(prepare([existing]), [existing]);
  assert.deepEqual(prepare([null, "text"]), [null, "text"]);
});

const settings = { requestTypes: [{ id: "castration", name: "Castração", active: true }], neighborhoods };
const submit = (body) => prepareRequestSubmission({ body: { cpf: "52998224725", phone: "(48) 99999-1234", tutor_name: "Maria", workflow_data: {}, ...body }, user: null, municipalityId: MUNICIPALITY, workflow: { followUp: { enabled: false } }, settings });

test("the submission carries the normalized neighborhood of each animal and refuses the request without it", () => {
  const ok = submit({ request_type: "Castração", animals: [{ name: "Rex", requestTypeIds: ["castration"], neighborhood: "centro" }] });
  assert.equal(ok.animals[0].neighborhood, "Centro");
  assert.throws(() => submit({ request_type: "Castração", animals: [{ name: "Rex", requestTypeIds: ["castration"] }] }), { status: 400, message: /bairro/ });
});

test("a complaint has no animal neighborhood to ask", () => {
  assert.doesNotThrow(() => submit({ request_type: "DENUNCIA", phone: "48999990000", animals: [{ name: "Rex" }] }));
});
