import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MOBILE_PHONE_MESSAGE } from "../../../shared/phone-contract.js";
import { TutorStepFields } from "./tutor-step-fields";
import type { TutorStepData } from "./tutor-step-fields";
import { registrationContactIssues } from "./registration-contact-fields";

const data: TutorStepData = {
  tutor: "Maria Silva", cpf: "529.982.247-25", cep: "88801-600", number: "88", state: "SC", address: "Rua Ararangua",
  neighborhood: "Centro", city: "Criciuma", latitude: "", longitude: "", email: "", phone: "",
};
const noop = vi.fn();
const props = { data, nameInvalid: false, nameIssue: "", cpfInvalid: false, neighborhoodNames: ["Centro", "Liri"], showErrors: false, onField: noop, onMaskedField: noop, onCepChange: noop };
const html = (overrides: Partial<React.ComponentProps<typeof TutorStepFields>> = {}) => renderToStaticMarkup(<TutorStepFields {...props} {...overrides} />);

describe("the mobile in the registration contact", () => {
  it("is required and must be a complete mobile, while the e-mail stays optional but must be valid", () => {
    expect(registrationContactIssues("", "").phone).toBe(MOBILE_PHONE_MESSAGE);
    expect(registrationContactIssues("", "").email).toBe("");
    for (const phone of ["(48) 3333-4444", "(48) 8999-1234", "(48) 99999-12", "123", "abc"]) expect(registrationContactIssues("", phone).phone, phone).toBe(MOBILE_PHONE_MESSAGE);
    for (const phone of ["(48) 99999-1234", "48999991234"]) expect(registrationContactIssues("", phone).phone, phone).toBe("");
    expect(registrationContactIssues("not-an-email", "(48) 99999-1234").email).toBe("Informe um e-mail válido.");
    expect(registrationContactIssues("tutor@example.com", "(48) 99999-1234")).toEqual({ email: "", phone: "" });
    expect(registrationContactIssues("bad", "", false)).toEqual({ email: "", phone: "" });
  });
});

describe("the Tutor step", () => {
  it("shows who is responsible, the address and the contact, in that order, for both forms", () => {
    const markup = html();
    const order = ["Responsável", "Endereço", "Contato de cadastro"].map((text) => markup.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const value of ["Maria Silva", "529.982.247-25", "88801-600", "Rua Ararangua", "Criciuma"]) expect(markup).toContain(value);
  });

  it("asks for the mobile as required and the e-mail as optional, and no longer calls the whole contact optional", () => {
    const markup = html();
    expect(markup).toContain('data-label="Celular *"'); expect(markup).toContain('data-label="E-mail (opcional)"');
    expect(markup).toContain("Contato de cadastro"); expect(markup).not.toContain("Contato de cadastro (opcional)");
    expect(markup).toMatch(/aria-label="Celular de cadastro"[^>]*required/);
    expect(markup).not.toMatch(/aria-label="E-mail de cadastro"[^>]*required/);
  });

  it("shows the contact errors only after an attempt, and the name and CPF errors when they are invalid", () => {
    expect(html()).not.toContain(MOBILE_PHONE_MESSAGE);
    expect(html({ showErrors: true })).toContain(MOBILE_PHONE_MESSAGE);
    expect(html({ showErrors: true, data: { ...data, phone: "(48) 99999-1234" } })).not.toContain(MOBILE_PHONE_MESSAGE);
    expect(html({ showErrors: true, data: { ...data, email: "bad", phone: "(48) 99999-1234" } })).toContain("Informe um e-mail válido.");
    const invalid = html({ nameInvalid: true, nameIssue: "Informe o nome completo.", cpfInvalid: true });
    expect(invalid).toContain("Informe o nome completo."); expect(invalid).toContain("Informe um CPF válido.");
    expect(html()).not.toContain("field-error-message");
  });

  it("offers the registered neighborhoods as a list, and free text when there are none", () => {
    expect(html()).toMatch(/<select[^>]*aria-label="Bairro"/);
    expect(html({ neighborhoodNames: [] })).toMatch(/<input[^>]*aria-label="Bairro"/);
  });

  it("shows the registered place when there is one", () => {
    expect(html()).not.toContain("Localização registrada");
    expect(html({ data: { ...data, latitude: "-28.6", longitude: "-49.3" } })).toContain("Localização registrada: -28.6, -49.3.");
  });

  it("is one copy: the staff's form has no other markup for the same step", () => {
    const markup = html();
    expect(markup).not.toContain("cadunico-row"); expect(markup).not.toContain("Se aplica"); expect(markup).not.toContain("Identificação");
    expect(markup).not.toContain("CadÚnico"); expect(markup).not.toContain("cadunico-square-toggle");
  });
});
