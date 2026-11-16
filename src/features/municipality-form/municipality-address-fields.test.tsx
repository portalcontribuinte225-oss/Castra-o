import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MunicipalityAddressFields } from "./municipality-address-fields";
import { emptyMunicipalityForm } from "./municipality-address";

const noop = () => undefined;

describe("MunicipalityAddressFields", () => {
  it("asks for the CEP first and then for the number, the street, the complement and the neighborhood", () => {
    const html = renderToStaticMarkup(<MunicipalityAddressFields form={emptyMunicipalityForm} setForm={noop} canEditCity />);
    const positions = ["CEP", "Número", "Rua", "Complemento", "Bairro"].map((label) => html.indexOf(`<span>${label}</span>`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it("lets the support type the city and the state, and only shows them to anyone else", () => {
    const form = { ...emptyMunicipalityForm, name: "Içara", state: "SC" };
    const support = renderToStaticMarkup(<MunicipalityAddressFields form={form} setForm={noop} canEditCity />);
    expect(support).toContain("<span>Município</span>");
    expect(support).toContain("<span>UF</span>");
    const admin = renderToStaticMarkup(<MunicipalityAddressFields form={form} setForm={noop} canEditCity={false} />);
    expect(admin).not.toContain("<span>Município</span>");
    expect(admin).toContain("Içara / SC");
  });

  it("shows the saved values", () => {
    const html = renderToStaticMarkup(<MunicipalityAddressFields form={{ ...emptyMunicipalityForm, cep: "88820-000", address: "Rua das Flores", addressNumber: "100", neighborhood: "Centro" }} setForm={noop} canEditCity />);
    for (const value of ["88820-000", "Rua das Flores", "100", "Centro"]) expect(html).toContain(`value="${value}"`);
  });
});
