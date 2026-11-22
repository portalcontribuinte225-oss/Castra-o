import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { RequestOrigin } from "../../../shared/request-contract.js";
import { pdfPagesText } from "../municipal-documents/municipal-pdf-test-text";
import { createRequestRequirementPdf } from "./request-requirement-pdf";

const municipality = { name: "Município Exemplo", state: "SC", department_name: "Secretaria Municipal de Teste" };
const animal = {
  name: "Nina", species: "Felina", sex: "Fêmea", breedType: "Indefinida", size: "Pequeno", weight: "4.2", birthDate: "2023-11-01",
  coat: "cinza", vaccinated: "Sim", dewormed: "Sim", illnessHistory: "Não", hasChip: "Nao", requestTypeIds: ["castration"],
};
const source = {
  protocol: "000004/2026",
  origin: RequestOrigin.PUBLIC,
  created_at: "2026-11-19T23:34:25Z",
  signed_at: "2026-11-19T23:34:20Z",
  schedule_date: "2026-11-26",
  schedule_location_name: "Posto Exemplo",
  schedule_address: "Rua Exemplo, 456 - Centro",
  schedule_address_url: "https://maps.example.test/?q=posto",
  tutor_name: "Tutora Exemplo",
  cpf: "01234567890",
  phone: "48999990000",
  notes: "PRIVATE STAFF NOTE",
  animals: [animal, { ...animal, name: "Fubá", species: "Canina", sex: "Macho", birthDate: "", age: "8 meses", declaredMicrochip: "900100000012345", requestTypeIds: ["castration", "microchip"] }],
  workflow_data: { scheduleSlotTime: "09:20", requestTypeIds: ["castration", "microchip"], requestTypeNames: ["Castração", "Microchipagem"] },
};

const textOf = (pages: string[][]) => pages.map((lines) => lines.join("\n"));

describe("the requirement of a procedure request", () => {
  it("follows the model: municipal header, the request, the animals and the declaration with the electronic acceptance", async () => {
    const bytes = await createRequestRequirementPdf(source, municipality);
    const pages = await pdfPagesText(bytes);
    expect(pages).toHaveLength(2);
    const [request, terms] = textOf(pages);
    for (const page of [request, terms]) {
      for (const line of ["ESTADO DE SANTA CATARINA", "PREFEITURA MUNICIPAL DE MUNICÍPIO EXEMPLO", "Secretaria Municipal de Teste", "PROTOCOLO", "000004/2026", "DATA DE EMISSÃO", "19/11/2026", "PROTEÇÃO ANIMAL"]) {
        expect(page).toContain(line);
      }
      expect(page).not.toContain("MODELO ILUSTRATIVO");
      expect(page).not.toContain("Nº DO DOCUMENTO");
    }
    expect(request).toContain("REQUERIMENTO");
    expect(request).toContain("DATA AGENDADA\n26/11/2026");
    expect(request).toContain("HORÁRIO\n09:20");
    expect(request).toContain("LOCAL / POSTO\nPosto Exemplo");
    expect(request).toContain("LINK DO LOCAL\nhttps://maps.example.test/?q=posto");
    expect(request).toContain("CPF\n012.345.678-90");
    expect(request).toContain("01   NINA   ·   Felina · Fêmea");
    expect(request).toContain("IDADE\n3 anos");
    expect(request).toContain("IDADE\n8 meses");
    expect(request).toContain("PESO\n4,2 kg");
    expect(request).toContain("MICROCHIP\nNão");
    expect(request).toContain("MICROCHIP\n900100000012345");
    expect(request).toContain("Castração • Microchipagem");
    expect(request).toContain("Pelagem: cinza · Vacinas: em dia · Vermifugação: sim · Doenças prévias: não relatadas");
    expect(request).not.toContain(source.notes);
    expect(terms).toContain("DECLARAÇÃO DE CIÊNCIA E RESPONSABILIDADES");
    expect(terms).toContain("Eu, Tutora Exemplo, na condição de tutor(a)");
    expect(terms).toContain("01  /  CUIDADOS E AUTORIZAÇÃO");
    expect(terms).toContain("02  /  ELEGIBILIDADE E VERACIDADE DAS INFORMAÇÕES");
    expect(terms.replace(/\s+/g, " ")).toContain("não residentes no município de Município Exemplo");
    expect(terms).toContain("03  /  REGISTRO DE ACEITE ELETRÔNICO");
    expect(terms).toContain("ACEITE ELETRÔNICO CONFIRMADO NO SISTEMA");
    expect(terms).toContain("DATA E HORA DO ACEITE\n19/11/2026 · 20:34:20");
    expect(terms).not.toContain("Assinatura do tutor ou responsável");

    const firstPage = (await PDFDocument.load(bytes)).getPage(0);
    expect(firstPage.node.lookup(PDFName.of("Annots"))).toBeTruthy();
  });

  it("asks a request made at the counter for the tutor's signature on paper", async () => {
    const pages = textOf(await pdfPagesText(await createRequestRequirementPdf({ ...source, origin: RequestOrigin.INTERNAL, signed_at: null }, municipality)));
    const terms = pages[pages.length - 1];
    expect(terms).toContain("03  /  ASSINATURA DO TUTOR OU RESPONSÁVEL");
    expect(terms).toContain("Assinatura do tutor ou responsável");
    expect(terms).not.toContain("ACEITE ELETRÔNICO CONFIRMADO NO SISTEMA");
  });

  it("repeats the header on every page and keeps every animal and the declaration at the end", async () => {
    const animals = Array.from({ length: 10 }, (_, index) => ({ ...animal, name: `Animal ${index + 1}`, illnessHistory: index === 3 ? `Histórico relatado. ${"Texto clínico de teste. ".repeat(60)}Final do histórico.` : "Não" }));
    const pages = textOf(await pdfPagesText(await createRequestRequirementPdf({ ...source, animals }, municipality)));
    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) expect(page).toContain("PREFEITURA MUNICIPAL DE MUNICÍPIO EXEMPLO");
    const body = pages.slice(0, -1).join("\n");
    for (const { name } of animals) expect(body).toContain(name.toLocaleUpperCase("pt-BR"));
    expect(body.replace(/\s+/g, " ")).toContain("Final do histórico.");
    expect(pages[pages.length - 1]).toContain("DECLARAÇÃO DE CIÊNCIA E RESPONSABILIDADES");
  });

  it("writes the street, neighborhood, city and postal code in their own fields", async () => {
    const [page] = textOf(await pdfPagesText(await createRequestRequirementPdf({
      ...source, address: "Rua das Flores, 15, São Luiz, Criciúma, SC, 88802-030", neighborhood: "São Luiz", city: "Criciúma", state: "SC", cep: "88802030",
    }, municipality)));
    expect(page).toContain("ENDEREÇO\nRua das Flores, 15");
    expect(page).toContain("BAIRRO\nSão Luiz");
    expect(page).toContain("CIDADE / UF\nCriciúma / SC");
    expect(page).toContain("CEP\n88802-030");
  });

  it("still reads well without the record of the municipality", async () => {
    const [page] = textOf(await pdfPagesText(await createRequestRequirementPdf({ ...source, schedule_address_url: "" }, null)));
    expect(page).toContain("REQUERIMENTO");
    expect(page).not.toContain("PREFEITURA MUNICIPAL DE");
    expect(page).not.toContain("LINK DO LOCAL");
  });
});
