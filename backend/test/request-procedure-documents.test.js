import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { requestDocumentDefinitions, resolveDocumentRequestTypes, PHOTO_DEFINITION } from "../src/services/documents/document-policy.js";
import { definitionsForRequest, prepareRequestDocuments } from "../src/services/documents/request-documents.js";

const oldSecret = process.env.JWT_SECRET;
before(() => { process.env.JWT_SECRET = "isolated-procedure-document-tests"; });
after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });

const NOW = new Date("2026-11-13T12:00:00.000Z");
const PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\ntest document\n").toString("base64")}`;
const documentTypes = [
  { id: "residence", name: "Comprovante de residência", required: false },
  { id: "vaccine-card", name: "Carteira de vacina", required: true },
  { id: "identity", name: "Identidade", required: true },
  { id: "retired", name: "Documento desativado", required: true, active: false },
];
const settings = () => ({
  documentTypes,
  requestTypes: [
    { id: "castration", name: "Castração", documents: [{ id: "residence" }, { id: "identity" }, { id: "retired" }, { id: "extra", name: "Extra", required: false }] },
    { id: "vaccine", name: "Vacinação antirrábica", documents: [{ id: "vaccine-card" }, { id: "extra", name: "Extra", required: true }, { id: "residence" }] },
    { id: "microchip", name: "Microchipagem", documents: [] },
  ],
});
const animals = (...idLists) => idLists.map((requestTypeIds) => ({ requestTypeIds }));
const ids = (definitions) => definitions.map(({ id }) => id);

test("the documents of a request are the sum of its procedures' documents, each once, without the switched-off ones", () => {
  const union = requestDocumentDefinitions(settings(), { animals: animals(["castration"], ["vaccine"]) });
  assert.deepEqual(ids(union), ["residence", "identity", "extra", "vaccine-card"]);
  assert.deepEqual(ids(requestDocumentDefinitions(settings(), { animals: animals(["vaccine", "castration"]) })), ["vaccine-card", "extra", "residence", "identity"]);
  assert.deepEqual(ids(requestDocumentDefinitions(settings(), { animals: animals(["microchip"]) })), []);
});

test("a document is required when any of the procedures requires it, and it is not asked twice", () => {
  const union = requestDocumentDefinitions(settings(), { animals: animals(["castration", "vaccine"]) });
  const required = Object.fromEntries(union.map(({ id, required: needed }) => [id, needed]));
  assert.deepEqual(required, { residence: false, identity: true, extra: true, "vaccine-card": true });
  const onlyCastration = requestDocumentDefinitions(settings(), { animals: animals(["castration"]) });
  assert.equal(onlyCastration.find(({ id }) => id === "extra").required, false, "required by the other procedure only");
});

test("the single type of an old request, by id, by name or as a plain string, still gives its documents", () => {
  assert.deepEqual(ids(requestDocumentDefinitions(settings(), "castration")), ["residence", "identity", "extra"]);
  assert.deepEqual(ids(requestDocumentDefinitions(settings(), "Vacinação antirrábica")), ["vaccine-card", "extra", "residence"]);
  for (const input of [{ requestTypeId: "castration" }, { request_type: "Castração" }, { requestType: "castration" }, { type: "Castração" }, { workflow_data: { requestTypeId: "castration" } }]) {
    assert.deepEqual(ids(requestDocumentDefinitions(settings(), input)), ["residence", "identity", "extra"], JSON.stringify(input));
  }
  assert.deepEqual(requestDocumentDefinitions(settings(), { request_type: "Castração, Vacinação antirrábica" }), [], "a joined text is not a type: the procedures come from the ids");
  assert.deepEqual(resolveDocumentRequestTypes(settings(), { animals: animals(["vaccine"]), requestTypeId: "castration" }).map(({ id }) => id), ["vaccine"]);
});

test("a stored request is read through its animals or its stored list, and always gets the photo definition too", () => {
  const stored = { request_type: "Castração, Vacinação antirrábica", animals: animals(["castration"], ["vaccine"]), workflow_data: { requestTypeIds: ["castration", "vaccine"] } };
  assert.deepEqual(ids(definitionsForRequest(settings(), stored)), ["residence", "identity", "extra", "vaccine-card", PHOTO_DEFINITION.id]);
  const withoutAnimalIds = { request_type: "Castração, Vacinação antirrábica", animals: [{}], workflow_data: { requestTypeIds: ["vaccine"] } };
  assert.deepEqual(ids(definitionsForRequest(settings(), withoutAnimalIds)), ["vaccine-card", "extra", "residence", PHOTO_DEFINITION.id]);
});

const submission = (extra = {}) => ({
  body: { animals: animals(["castration"], ["vaccine"]), declarationAccepted: true }, user: { id: "tutor-1", role: "tutor", municipality_id: "municipality-1" },
  tutorId: "tutor-1", municipalityId: "municipality-1", settings: settings(), requestId: "new-request", animalIds: ["a1", "a2"], now: NOW, ...extra,
});
const client = { query: async () => { throw new Error("no database access expected"); } };
const upload = (documentId) => ({ documentId, dataUrl: PDF, fileName: `${documentId}.pdf` });

test("every document required by any procedure must be attached, and the ones that are attached are accepted from any of them", async () => {
  const all = ["residence", "identity", "extra", "vaccine-card"].map(upload);
  const base = submission();
  const result = await prepareRequestDocuments(client, { ...base, body: { ...base.body, documents: all } });
  assert.deepEqual(result.map(({ documentId }) => documentId), ["residence", "identity", "extra", "vaccine-card"]);
  await assert.doesNotReject(() => prepareRequestDocuments(client, { ...base, body: { ...base.body, documents: all.filter(({ documentId }) => documentId !== "residence") } }), "an optional document may be left out");
  for (const missing of ["identity", "extra", "vaccine-card"]) {
    await assert.rejects(() => prepareRequestDocuments(client, { ...base, body: { ...base.body, documents: all.filter(({ documentId }) => documentId !== missing) } }),
      { status: 400, message: /documento obrigatório/ }, missing);
  }
  await assert.rejects(() => prepareRequestDocuments(client, { ...base, body: { ...base.body, documents: [...all, upload("retired")] } }), { status: 400 });
  const onlyCastration = submission({ body: { animals: animals(["castration"]), declarationAccepted: true } });
  await assert.rejects(() => prepareRequestDocuments(client, { ...onlyCastration, body: { ...onlyCastration.body, documents: [upload("residence"), upload("identity"), upload("vaccine-card")] } }),
    { status: 400, message: /não permitido/ }, "a document of a procedure the request does not have is refused");
});

test("the declaration and the required documents are asked of every public procedure, and never of the staff", async () => {
  const body = { animals: animals(["castration"], ["vaccine"]) };
  await assert.rejects(() => prepareRequestDocuments(client, submission({ body })), { status: 400, message: /declaração/ });
  await assert.rejects(() => prepareRequestDocuments(client, submission({ body: { ...body, declarationAccepted: true } })), { status: 400, message: /documento obrigatório/ });
  const staff = { id: "staff-1", role: "analista", municipality_id: "municipality-1" };
  assert.deepEqual(await prepareRequestDocuments(client, submission({ user: staff, body })), []);
});
