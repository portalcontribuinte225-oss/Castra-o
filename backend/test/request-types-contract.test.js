import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REQUEST_TYPES_PER_ANIMAL, animalRequestTypeIds, combineRequestFees, deriveRequestTypeFields, distinctRequestTypeIds, resolveRequestTypes,
} from "../../shared/request-types-contract.js";

const castration = { id: "castration", name: "Castração", charged: false, fee: "Gratuito" };
const microchip = { id: "microchip", name: "Microchipagem", charged: true, billingAmount: "R$ 20,00", fee: "R$ 20,00" };
const vaccine = { id: "vaccine", name: "Vacinação antirrábica", charged: true, fee: "R$ 10,00" };
const types = [castration, microchip, vaccine];

test("the procedures of an animal are its distinct, non-empty string ids, in the order chosen", () => {
  assert.deepEqual(animalRequestTypeIds({ requestTypeIds: ["castration", " microchip ", "castration", "", 5, null, "vaccine"] }), ["castration", "microchip", "vaccine"]);
  for (const animal of [undefined, null, {}, { requestTypeIds: "castration" }, { requestTypeIds: {} }, "text"]) assert.deepEqual(animalRequestTypeIds(animal), [], String(animal));
  assert.equal(MAX_REQUEST_TYPES_PER_ANIMAL, 10);
});

test("the procedures of a request are the ones of every animal, each once, in order", () => {
  const animals = [{ requestTypeIds: ["microchip", "castration"] }, { requestTypeIds: ["castration", "vaccine"] }, {}];
  assert.deepEqual(distinctRequestTypeIds(animals), ["microchip", "castration", "vaccine"]);
  assert.deepEqual(distinctRequestTypeIds(undefined), []);
});

test("a request resolves to its animals' procedures first, then to its stored list, then to its single old type", () => {
  const animals = [{ requestTypeIds: ["microchip"] }, { requestTypeIds: ["castration", "microchip"] }];
  assert.deepEqual(resolveRequestTypes({ animals }, types), [microchip, castration]);
  assert.deepEqual(resolveRequestTypes({ animals: [{}], workflow: { requestTypeIds: ["vaccine", "castration"] } }, types), [vaccine, castration]);
  assert.deepEqual(resolveRequestTypes({ workflow: { requestTypeId: "microchip" } }, types), [microchip]);
  assert.deepEqual(resolveRequestTypes({ requestTypeId: "castration", workflow: { requestTypeId: "microchip" } }, types), [castration]);
  assert.deepEqual(resolveRequestTypes({ requestType: "Microchipagem" }, types), [microchip]);
  assert.deepEqual(resolveRequestTypes({ requestType: "vaccine" }, types), [vaccine]);
  assert.deepEqual(resolveRequestTypes({ animals, workflow: { requestTypeId: "vaccine" }, requestTypeId: "vaccine", requestType: "Vacinação antirrábica" }, types), [microchip, castration],
    "the animals win over every single-type field");
});

test("a procedure the municipality does not have is not resolved, and nothing resolves without types", () => {
  assert.deepEqual(resolveRequestTypes({ animals: [{ requestTypeIds: ["castration", "gone"] }] }, types), [castration]);
  assert.deepEqual(resolveRequestTypes({ animals: [{ requestTypeIds: ["castration"] }] }, undefined), []);
  assert.deepEqual(resolveRequestTypes({ requestType: "Desconhecido" }, types), []);
  assert.deepEqual(resolveRequestTypes(undefined, types), []);
  assert.deepEqual(resolveRequestTypes({ workflow: [] , requestType: "castration" }, types), [castration]);
});

test("the stored fields are derived from the types: ids, names and the whole names joined, never a summary", () => {
  assert.deepEqual(deriveRequestTypeFields([castration, microchip, vaccine]), {
    requestTypeIds: ["castration", "microchip", "vaccine"],
    requestTypeNames: ["Castração", "Microchipagem", "Vacinação antirrábica"],
    requestType: "Castração, Microchipagem, Vacinação antirrábica",
  });
  assert.deepEqual(deriveRequestTypeFields([castration]), { requestTypeIds: ["castration"], requestTypeNames: ["Castração"], requestType: "Castração" });
  assert.deepEqual(deriveRequestTypeFields([]), { requestTypeIds: [], requestTypeNames: [], requestType: "" });
});

test("fees are not added up: free when every procedure is free, otherwise each charged one with its value", () => {
  assert.equal(combineRequestFees([castration]), "Gratuito");
  assert.equal(combineRequestFees([]), "Gratuito");
  assert.equal(combineRequestFees(undefined), "Gratuito");
  assert.equal(combineRequestFees([castration, microchip]), "Microchipagem: R$ 20,00");
  assert.equal(combineRequestFees([microchip, castration, vaccine]), "Microchipagem: R$ 20,00; Vacinação antirrábica: R$ 10,00");
});

