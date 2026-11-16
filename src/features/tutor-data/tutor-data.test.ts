import { describe, expect, it } from "vitest";
import { formFromTutor, hasTutorChanges, tutorFormIssues, tutorPayload } from "./tutor-data";
import type { TutorData } from "./tutor-data";

const tutor: TutorData = { id: "t1", hasAccess: true, name: "Maria Silva", cpf: "52998224725", email: "maria@example.test", phone: "48999990000", emailVerified: false, phoneVerified: false,
  address: "Rua Velha, 10", neighborhood: "Centro", city: "Criciúma", state: "SC", cep: "88800000" };

describe("formFromTutor", () => {
  it("formats the phone and the CEP and starts without a password", () => {
    expect(formFromTutor(tutor)).toEqual({ name: "Maria Silva", email: "maria@example.test", phone: "(48) 99999-0000", address: "Rua Velha, 10", neighborhood: "Centro",
      city: "Criciúma", state: "SC", cep: "88800-000", password: "" });
  });
});

describe("tutorFormIssues", () => {
  it("accepts what the server returned", () => {
    expect(tutorFormIssues(formFromTutor(tutor))).toEqual({});
  });

  it("reports each field the server would refuse", () => {
    const form = { ...formFromTutor(tutor), name: "A", email: "nope", phone: "(48) 1234", cep: "123", state: "Santa", password: "123" };
    expect(Object.keys(tutorFormIssues(form)).sort()).toEqual(["cep", "email", "name", "password", "phone", "state"]);
  });

  it("lets the e-mail, address and password stay empty, but not the mobile", () => {
    expect(tutorFormIssues({ ...formFromTutor(tutor), email: "", cep: "", state: "", password: "" })).toEqual({});
    expect(tutorFormIssues({ ...formFromTutor(tutor), phone: "" }).phone).toMatch(/celular completo/);
  });

  it("accepts only a complete mobile as the tutor's phone", () => {
    for (const phone of ["(48) 3333-4444", "(48) 8999-1234", "(48) 99999-12", "123"]) expect(tutorFormIssues({ ...formFromTutor(tutor), phone }).phone, phone).toMatch(/celular completo/);
    for (const phone of ["(48) 99999-1234", "48999991234"]) expect(tutorFormIssues({ ...formFromTutor(tutor), phone }).phone, phone).toBeUndefined();
  });
});

describe("hasTutorChanges", () => {
  it("is false until something differs from what is saved", () => {
    expect(hasTutorChanges(tutor, formFromTutor(tutor))).toBe(false);
    expect(hasTutorChanges(tutor, { ...formFromTutor(tutor), name: " Maria Silva " })).toBe(false);
    expect(hasTutorChanges(tutor, { ...formFromTutor(tutor), neighborhood: "Pinheirinho" })).toBe(true);
  });

  it("counts a typed password as a change", () => {
    expect(hasTutorChanges(tutor, { ...formFromTutor(tutor), password: "nova senha" })).toBe(true);
  });
});

describe("tutorPayload", () => {
  it("sends digits for the contacts and the CEP, the UF in capitals, and the password only when typed", () => {
    const form = { ...formFromTutor(tutor), state: "sc", name: " Maria Souza " };
    expect(tutorPayload(form)).toEqual({ name: "Maria Souza", email: "maria@example.test", phone: "48999990000", address: "Rua Velha, 10", neighborhood: "Centro",
      city: "Criciúma", state: "SC", cep: "88800000" });
    expect(tutorPayload({ ...form, password: "nova senha" })).toMatchObject({ password: "nova senha" });
  });
});
