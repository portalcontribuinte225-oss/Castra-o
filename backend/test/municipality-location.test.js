import test from "node:test";
import assert from "node:assert/strict";
import { formatContactPhone, readMunicipalityLocation } from "../src/services/municipality-location.js";

test("the contact is a phone with DDD kept in its masked form, and empty is allowed", () => {
  assert.equal(readMunicipalityLocation({ contact: "48999990000" }).contact, "(48) 99999-0000");
  assert.equal(readMunicipalityLocation({ contact: "(48) 3433-1234" }).contact, "(48) 3433-1234");
  assert.equal(readMunicipalityLocation({ contact: "" }).contact, "");
  assert.equal(readMunicipalityLocation({ contact: "Setor de Meio Ambiente" }).contact, "");
  assert.equal(formatContactPhone("4834331234"), "(48) 3433-1234");
});

test("a contact that is not a complete phone is refused", () => {
  for (const contact of ["4899", "489999900001", "(48) 9999-00"]) {
    assert.throws(() => readMunicipalityLocation({ contact }), { status: 400, message: /telefone/ }, contact);
  }
});

test("the CEP is kept as 8 digits, and empty is allowed", () => {
  assert.equal(readMunicipalityLocation({ cep: "88820-000" }).cep, "88820000");
  assert.equal(readMunicipalityLocation({ cep: "" }).cep, "");
  assert.throws(() => readMunicipalityLocation({ cep: "8882" }), { status: 400, message: /CEP/ });
});

test("the address fields are trimmed, read in snake or camel case, and limited", () => {
  const read = readMunicipalityLocation({ address: " Rua das Flores ", addressNumber: " 100 ", address_complement: "Sala 2", neighborhood: " Centro " });
  assert.deepEqual(read, { address: "Rua das Flores", address_number: "100", address_complement: "Sala 2", neighborhood: "Centro" });
  assert.throws(() => readMunicipalityLocation({ address: "x".repeat(201) }), { status: 400, message: /address/ });
  assert.throws(() => readMunicipalityLocation({ addressNumber: "1".repeat(21) }), { status: 400, message: /address number/ });
  assert.throws(() => readMunicipalityLocation({ address_complement: "x".repeat(81) }), { status: 400 });
  assert.throws(() => readMunicipalityLocation({ neighborhood: "x".repeat(121) }), { status: 400, message: /neighborhood/ });
});

test("only the fields the body carries are answered, so a partial update leaves the others alone", () => {
  assert.deepEqual(readMunicipalityLocation({}), {});
  assert.deepEqual(readMunicipalityLocation({ neighborhood: "Centro" }), { neighborhood: "Centro" });
  assert.deepEqual(readMunicipalityLocation({ email: "x@y.test", name: "Test Town" }), {});
});
