import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { accessRequestAddressIssues, normalizeAccessRequestAddress } from "../../../shared/access-request-address-contract.js";
import { PublicAccessRequestForm, accessRequestIssues } from "./public-access-request-form";

const MUNICIPALITY = "municipality-a";
const neighborhoods = [{ name: "Centro", municipalityId: MUNICIPALITY }, { name: "Liri", municipalityId: MUNICIPALITY }];
const html = () => renderToStaticMarkup(<PublicAccessRequestForm municipalityId={MUNICIPALITY} neighborhoods={neighborhoods} onSubmit={vi.fn()} />);
const filled = {
  requesterType: "ONG", organizationName: "ONG Patas", responsibleName: "Maria Silva", document: "", email: "maria@example.com", phone: "(48) 99999-1234",
  cep: "88801-600", number: "88", state: "SC", address: "Rua Ararangua", neighborhood: "Centro", city: "Criciuma",
};

describe("the credentialing form", () => {
  it("groups the fields in the responsible, address and contact cards, in that order", () => {
    const markup = html();
    const order = [">Responsável<", ">Endereço<", ">Contato<"].map((text) => markup.indexOf(`form-sub-card-title${text}`.replace("title>", "title\">")));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup.match(/two-column-fields/g)).toHaveLength(2);
  });

  it("asks for the same address as the tutor's, with the municipality's neighborhoods, and no longer has loose city and UF fields", () => {
    const markup = html();
    for (const label of ["CEP", "Número", "UF", "Endereço", "Bairro", "Cidade"]) expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toMatch(/<select[^>]*aria-label="Bairro"/);
    expect(markup).toContain(">Centro</option>");
    expect(markup.match(/aria-label="Cidade"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="UF"/g)).toHaveLength(1);
  });

  it("marks only the responsible and the e-mail as required, in their titles, never in the hints", () => {
    const markup = html();
    expect(markup).toContain('>Responsável<span class="required-asterisk">*</span></span>');
    expect(markup).toContain('>E-mail<span class="required-asterisk">*</span></span>');
    expect(markup.match(/required-asterisk/g)).toHaveLength(2);
    expect(markup).not.toMatch(/placeholder="[^"]*\*/);
    expect(markup).toContain("novalidate");
  });

  it("places the send button on the right", () => {
    expect(html()).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*tw:justify-self-end[^"]*"/);
  });
});

describe("what the credentialing form checks", () => {
  it("requires the responsible and a valid e-mail, and lets everything else be left blank", () => {
    const blank = accessRequestIssues({ ...filled, responsibleName: " ", email: "", phone: "", document: "", cep: "", state: "", address: "", number: "", neighborhood: "", city: "" });
    expect(blank.responsibleName).toBe("Informe o nome do responsável.");
    expect(blank.email).toBe("Informe o e-mail para contato.");
    expect(Object.entries(blank).filter(([, issue]) => issue).map(([field]) => field)).toEqual(["responsibleName", "email"]);
    expect(accessRequestIssues({ ...filled, email: "not-an-email" }).email).toBe("Informe um e-mail válido.");
    expect(Object.values(accessRequestIssues(filled)).some(Boolean)).toBe(false);
  });

  it("refuses a phone, a CPF/CNPJ, a CEP or a UF that is given but malformed", () => {
    const issues = accessRequestIssues({ ...filled, phone: "123", document: "111.111.111-11", cep: "8880", state: "S" });
    expect(issues.phone).toBe("Informe um telefone válido.");
    expect(issues.document).toBe("Informe um CPF ou CNPJ válido.");
    expect(issues.cep).toBe("Informe um CEP com 8 dígitos.");
    expect(issues.state).toBe("Informe a UF com 2 letras.");
    expect(accessRequestIssues({ ...filled, document: "Matrícula 12" }).document).toBe("");
  });

  it("stores the address trimmed, with the CEP as 00000-000 and the UF in capitals", () => {
    expect(normalizeAccessRequestAddress({ cep: "88801600", number: " 88 ", state: "sc", address: " Rua A ", neighborhood: " Centro ", city: " Criciuma " }))
      .toEqual({ cep: "88801-600", number: "88", state: "SC", address: "Rua A", neighborhood: "Centro", city: "Criciuma" });
    expect(accessRequestAddressIssues({ address: "x".repeat(201) }).address).toBe("Endereço muito longo.");
  });
});
