import { describe, expect, it } from "vitest";
import { emptyMunicipalityForm, formFromMunicipality, formatMunicipalityAddress, municipalityContactIssue, withCepAddress } from "./municipality-address";

describe("formatMunicipalityAddress", () => {
  it("joins the street, the number, the complement and the neighborhood", () => {
    expect(formatMunicipalityAddress({ address: "Rua das Flores", address_number: "100", address_complement: "Sala 2", neighborhood: "Centro" })).toBe("Rua das Flores, 100, Sala 2 - Centro");
    expect(formatMunicipalityAddress({ address: "Rua das Flores", addressNumber: "100", neighborhood: "Centro" })).toBe("Rua das Flores, 100 - Centro");
    expect(formatMunicipalityAddress({ address: " Rua das Flores ", neighborhood: "" })).toBe("Rua das Flores");
  });

  it("shows a municipality saved before the split as it was written", () => {
    expect(formatMunicipalityAddress({ address: "Rua das Flores, 100, Centro" })).toBe("Rua das Flores, 100, Centro");
    expect(formatMunicipalityAddress({})).toBe("");
    expect(formatMunicipalityAddress({ neighborhood: "Centro" })).toBe("Centro");
  });
});

describe("formFromMunicipality", () => {
  it("masks the contact and the CEP and reads the columns of the server", () => {
    expect(formFromMunicipality({ name: "Içara", state: "SC", contact: "48999990000", cep: "88820000", address: "Rua A", address_number: "10", address_complement: "Sala 1",
      neighborhood: "Centro", department_name: "FUNDAI", department_logo: "data:image/png;base64,AAAA", email: "a@b.test", active: false })).toEqual({
      name: "Içara", state: "SC", active: false, brasao: "", departmentLogo: "data:image/png;base64,AAAA", contact: "(48) 99999-0000", email: "a@b.test", address: "Rua A", addressNumber: "10",
      addressComplement: "Sala 1", neighborhood: "Centro", cep: "88820-000", departmentName: "FUNDAI",
    });
  });

  it("starts empty for a new municipality and drops a contact that was free text", () => {
    expect(formFromMunicipality()).toEqual(emptyMunicipalityForm);
    expect(formFromMunicipality({ contact: "Setor de Meio Ambiente" }).contact).toBe("");
  });
});

describe("municipalityContactIssue", () => {
  const form = { contact: "", cep: "" };

  it("accepts an empty contact and CEP, and complete ones", () => {
    expect(municipalityContactIssue(form)).toBe("");
    expect(municipalityContactIssue({ contact: "(48) 99999-0000", cep: "88820-000" })).toBe("");
    expect(municipalityContactIssue({ contact: "(48) 3433-1234", cep: "" })).toBe("");
  });

  it("refuses an incomplete phone or CEP", () => {
    expect(municipalityContactIssue({ ...form, contact: "(48) 9999" })).toMatch(/telefone/);
    expect(municipalityContactIssue({ ...form, cep: "88820" })).toMatch(/CEP/);
  });
});

describe("withCepAddress", () => {
  const form = { ...emptyMunicipalityForm, address: "Rua digitada", neighborhood: "Bairro digitado", name: "Içara", state: "SC" };
  const found = { address: "Rua Cel. Pedro Benedet", neighborhood: "Centro", city: "Criciúma", state: "SC" };

  it("fills the street and the neighborhood, and the city and the state for the support", () => {
    expect(withCepAddress(form, found, true)).toMatchObject({ address: "Rua Cel. Pedro Benedet", neighborhood: "Centro", name: "Criciúma", state: "SC" });
  });

  it("leaves the city and the state alone for a user who cannot set them", () => {
    expect(withCepAddress({ ...form, name: "Içara", state: "SC" }, { ...found, city: "Outra", state: "RS" }, false)).toMatchObject({ name: "Içara", state: "SC", address: "Rua Cel. Pedro Benedet" });
  });

  it("keeps what the CEP does not tell, as a city with a single CEP has no street", () => {
    expect(withCepAddress(form, { address: "", neighborhood: "", city: "Içara", state: "SC" }, true)).toMatchObject({ address: "Rua digitada", neighborhood: "Bairro digitado", name: "Içara" });
  });
});
