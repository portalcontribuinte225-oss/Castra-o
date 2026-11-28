import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dataUrlBytes, pdfPagesText } from "../municipal-documents/municipal-pdf-test-text";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { PrescriptionDialog } from "./prescription-dialog";
import { createPrescriptionPdfDocument } from "./prescription-pdf";

const municipality = { id: "city-a", name: "São José", state: "SC", department_name: "Secretaria de Teste" };
const request = { municipalityId: "city-a", protocol: "000123/2026", tutor_name: "Ana & Mauro" };
const animal = { name: "Bidu", species: "Canina", breedDescription: "Poodle", sex: "Macho", weight: "9.2", microchip: "123456789" };
const prescription = {
  number: "000001/2026",
  professionalName: "Beatriz Souza",
  professionalRegistry: "CRMV-SC 1234",
  text: "Primeira orientação\n\nSegunda orientação <especial>",
  issuedAt: "2026-11-24T02:00:00Z",
};

describe("the veterinary prescription", () => {
  it("follows the model: header with the number of the prescription, the patient, the prescription and the signature", async () => {
    const { dataUrl, fileName } = await createPrescriptionPdfDocument(request, [{ prescription, animal }], municipality);
    expect(fileName).toBe("Receita 000001-2026.pdf");
    const pages = await pdfPagesText(dataUrlBytes(dataUrl));
    expect(pages).toHaveLength(1);
    const text = pages[0].join("\n");
    for (const line of [
      "ESTADO DE SANTA CATARINA", "PREFEITURA MUNICIPAL DE SÃO JOSÉ", "Secretaria de Teste",
      "PROTOCOLO\n000123/2026", "DATA DE EMISSÃO\n23/11/2026", "Nº DO DOCUMENTO\n000001/2026",
      "Dr(a). Beatriz Souza", "RECEITUÁRIO VETERINÁRIO", "TUTOR(A)\nAna & Mauro", "PET\nBidu", "ESPÉCIE / RAÇA\nCanina / Poodle",
      "PESO\n9,2 kg", "MICROCHIP\n123456789", "PRESCRIÇÃO:", "Primeira orientação", "Segunda orientação <especial>",
      "São José/SC, 23 de novembro de 2026.", "CRMV-SC 1234 · Assinatura do profissional",
    ]) expect(text).toContain(line);
    expect(text).not.toContain("DOCUMENTO CLÍNICO");
    expect(text).not.toContain("MODELO ILUSTRATIVO");
  });

  it("does not repeat the title a professional already wrote", async () => {
    const { dataUrl } = await createPrescriptionPdfDocument(request, [{ prescription: { ...prescription, professionalName: "Dra. Beatriz" }, animal }], municipality);
    const text = (await pdfPagesText(dataUrlBytes(dataUrl)))[0].join("\n");
    expect(text).toContain("Dra. Beatriz");
    expect(text).not.toContain("Dr(a). Dra. Beatriz");
  });

  it("keeps each number, animal and optional procedure in the unified PDF", async () => {
    const { dataUrl, fileName } = await createPrescriptionPdfDocument(request, [
      { prescription, animal, procedureName: "Castração" },
      { prescription: { ...prescription, number: "000002/2026" }, animal: { ...animal, name: "Mel" } },
    ], municipality);
    const pages = await pdfPagesText(dataUrlBytes(dataUrl));
    expect(fileName).toBe("Receitas 000123-2026.pdf");
    expect(pages).toHaveLength(2);
    expect(pages[0].join("\n")).toContain("PROCEDIMENTO\nCastração");
    expect(pages[0].join("\n")).toContain("000001/2026");
    expect(pages[1].join("\n")).toContain("PET\nMel");
    expect(pages[1].join("\n")).toContain("000002/2026");
  });

  it("keeps the last lines and the signature when the prescription runs onto another page with the header", async () => {
    const text = Array.from({ length: 65 }, (_, index) => `ORIENTACAO ${index + 1}`).concat("ORIENTACAO FINAL").join("\n");
    const { dataUrl } = await createPrescriptionPdfDocument(request, [{ prescription: { ...prescription, text }, animal }], municipality);
    const pages = await pdfPagesText(dataUrlBytes(dataUrl));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page).toContain("PREFEITURA MUNICIPAL DE SÃO JOSÉ");
    const last = pages[pages.length - 1].join("\n");
    for (const value of ["ORIENTACAO FINAL", "Dr(a). Beatriz Souza", "CRMV-SC 1234 · Assinatura do profissional"]) expect(last).toContain(value);
  });
});

describe("the prescription dialog", () => {
  const render = (record: Partial<typeof prescription> | undefined, readOnly: boolean) => renderToStaticMarkup(
    <PrescriptionDialog request={request} municipality={municipality} animals={[{ ...animal, procedures: [
      { requestTypeId: "castration", status: ProcedureStatus.DONE, name: "Castração", prescription: record },
    ] }]} defaultProfessionalName="Operador atual" readOnly={readOnly} busy={false} onClose={() => undefined} onSave={() => undefined} />,
  );
  const button = (html: string, label: string) => html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}</button>`))?.[0] || "";

  it("downloads a saved prescription even after the procedure no longer accepts a new one", () => {
    const html = render(prescription, true);
    expect(html).toContain("Baixar receitas salvas");
    expect(button(html, "Baixar PDF")).not.toContain(" disabled=");
    expect(html).not.toContain("Salvar receitas");
  });

  it("asks for the prescription before saving a new one, starting with the name of who is signed in", () => {
    const html = render(undefined, false);
    expect(html).toContain("Geral do animal");
    expect(button(html, "Salvar receitas")).toContain(" disabled=");
    expect(render({ text: "Orientação cadastrada" }, false)).toContain('value="Operador atual"');
  });
});
