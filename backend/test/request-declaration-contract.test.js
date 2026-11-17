import test from "node:test";
import assert from "node:assert/strict";
import { DeclarationVariable, declarationVariables, renderDeclaration } from "../../shared/request-declaration-contract.js";

const town = { municipalityName: "Test Town", departmentName: "Animal Department" };
const farmers = /agricultores/;

test("the variables are the municipality and its department, each with the words that go with it in the sentence", () => {
  assert.deepEqual({ ...DeclarationVariable }, { MUNICIPALITY: "municipality", DEPARTMENT: "department" });
  assert.equal(Object.isFrozen(DeclarationVariable), true);
  assert.deepEqual(declarationVariables({ municipalityName: "  Test   Town ", departmentName: " Animal  Department " }), { municipality: "município de Test Town", department: "a Animal Department" });
  assert.deepEqual(declarationVariables({}), { municipality: "município", department: "a Prefeitura" });
  assert.deepEqual(declarationVariables({ municipalityName: "   ", departmentName: null }), { municipality: "município", department: "a Prefeitura" });
});

test("the declaration names the municipality and the department it was given, and no other, and leaves no variable behind", () => {
  const text = renderDeclaration(town).items.join("\n");
  assert.match(text, /sem ônus para a Animal Department\./);
  assert.match(text, /não pertencentes ao município de Test Town, assim como/);
  for (const fixed of ["FUNDAI", "Içara"]) assert.equal(text.includes(fixed), false, fixed);
  assert.equal(/\{\w+\}/.test(text), false);
});

test("without a department the declaration says the Prefeitura, and without a municipality, just the município", () => {
  const withoutDepartment = renderDeclaration({ municipalityName: "Test Town" }).items.join("\n");
  assert.match(withoutDepartment, /sem ônus para a Prefeitura\./);
  assert.match(withoutDepartment, /ao município de Test Town,/);
  const nameless = renderDeclaration({}).items.join("\n");
  assert.match(nameless, /sem ônus para a Prefeitura\./);
  assert.match(nameless, /não pertencentes ao município, assim como/);
  assert.equal(nameless.includes("município de"), false);
});

test("the clause about the farmers' animals only applies to a request with a charged procedure", () => {
  const free = renderDeclaration({ ...town, charged: false }).items;
  const charged = renderDeclaration({ ...town, charged: true }).items;
  assert.equal(free.some((item) => farmers.test(item)), false);
  assert.equal(renderDeclaration(town).items.some((item) => farmers.test(item)), false, "free unless said otherwise");
  assert.equal(charged.filter((item) => farmers.test(item)).length, 1);
  assert.equal(charged.length, free.length + 1);
  assert.deepEqual(charged.filter((item) => !farmers.test(item)), free, "every other clause is the same");
});

test("a name that looks like a variable is written as it is and never filled in again", () => {
  const text = renderDeclaration({ municipalityName: "{department}", departmentName: "{municipality}" }).items.join("\n");
  assert.match(text, /sem ônus para a \{municipality\}\./);
  assert.match(text, /ao município de \{department\},/);
});

test("a very long name is cut, so one clause cannot take the whole page", () => {
  const text = renderDeclaration({ municipalityName: "M".repeat(500), departmentName: "D".repeat(500) }).items.join("\n");
  assert.equal(text.includes("M".repeat(121)), false);
  assert.equal(text.includes("D".repeat(121)), false);
});

test("the recommendations are the same for every municipality, and a copy that can be changed without harm", () => {
  const first = renderDeclaration({ municipalityName: "A" });
  const second = renderDeclaration({ municipalityName: "B", charged: true });
  assert.equal("summary" in first, false, "the screen names the declaration and links to it, with no summary of its own");
  assert.deepEqual(first.recommendations, second.recommendations);
  assert.equal(first.recommendations.length, 3);
  first.items.push("changed"); first.recommendations.push("changed");
  const again = renderDeclaration({ municipalityName: "A" });
  assert.equal(again.items.includes("changed"), false);
  assert.equal(again.recommendations.includes("changed"), false);
});
