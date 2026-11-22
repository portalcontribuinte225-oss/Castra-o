import { describe, expect, it } from "vitest";
import { RequestKind } from "../../../shared/request-contract.js";
import { animalAgeLabel, animalWeightLabel, documentCpf } from "./document-fields";
import { stateHeading } from "./brazilian-states";
import { createAnimalRecordPdf } from "./animal-record-pdf";
import { documentFileName, municipalDocumentStamp } from "./municipal-pdf";
import { dataUrlBytes, pdfPagesText } from "./municipal-pdf-test-text";
import { createRequestDocumentPdf } from "./request-document-pdf";

const municipality = { name: "Município Exemplo", state: "SC", department_name: "Secretaria de Teste" };
const base = { protocol: "000007/2026", created_at: "2026-11-20T13:00:00Z", tutor_name: "Tutor Exemplo", cpf: "01234567890", phone: "48999990000",
  animals: [{ name: "Bidu", species: "Canina", microchip: "900100000000001" }] };
const pagesOf = async (bytes: Uint8Array) => (await pdfPagesText(bytes)).map((lines) => lines.join("\n"));

describe("the documents the municipality issues for each request", () => {
  it.each([
    [RequestKind.TRANSFER, "Troca de tutor", "TROCA DE TUTOR", { target_tutor_name: "Novo Tutor", target_tutor_cpf: "98765432100" }, ["NOVO TUTOR", "NOME COMPLETO\nNovo Tutor", "CPF\n987.654.321-00"]],
    [RequestKind.DEATH, "Registro de óbito", "REGISTRO DE ÓBITO", { death_date: "2026-11-18", death_cause: "Causa de teste" }, ["DATA DO ÓBITO\n18/11/2026", "CAUSA MORTIS\nCausa de teste"]],
    [RequestKind.COMPLAINT, "Denúncia", "DENÚNCIA", { notes: "Relato de teste" }, ["DADOS DO DENUNCIANTE", "DESCRIÇÃO\nRelato de teste"]],
  ])("issues %s in the municipal model", async (kind, name, title, extra, lines) => {
    const document = await createRequestDocumentPdf({ ...base, request_type: kind, ...extra }, municipality);
    expect(document.name).toBe(name);
    expect(document.fileName).toBe(`${name} 000007-2026.pdf`);
    const [page] = await pagesOf(document.bytes);
    for (const line of ["PREFEITURA MUNICIPAL DE MUNICÍPIO EXEMPLO", "PROTOCOLO\n000007/2026", "DATA DE EMISSÃO\n20/11/2026", title, "01", "DADOS DA SOLICITAÇÃO", ...lines]) {
      expect(page).toContain(line);
    }
  });

  it("issues the requirement for a procedure request", async () => {
    const document = await createRequestDocumentPdf({ ...base, request_type: RequestKind.PROCEDURE }, municipality);
    expect(document.fileName).toBe("Requerimento 000007-2026.pdf");
    expect((await pagesOf(document.bytes))[0]).toContain("REQUERIMENTO");
  });
});

describe("the record of an animal", () => {
  it("shows the animal, its tutor and its history under the municipal header", async () => {
    const history = {
      animal: { name: "Mel", species: "Felina", sex: "Fêmea", microchip: "900100000000002", status: "ativo" },
      tutor: { tutor_name: "Tutora Exemplo", cpf: "01234567890", phone: "48999990000" },
      history: [{ type: "CIRURGIA_REALIZADA", protocol: "000002/2026", status: "REALIZADA", occurred_at: "2026-11-10T12:00:00Z", notes: "Sem intercorrências" }],
    };
    const { dataUrl, fileName } = await createAnimalRecordPdf({ history, municipality });
    expect(fileName).toBe("Prontuário Mel 900100000000002.pdf");
    const [page] = await pagesOf(dataUrlBytes(dataUrl));
    for (const line of ["PREFEITURA MUNICIPAL DE MUNICÍPIO EXEMPLO", "ANIMAL\nMel", "MICROCHIP\n900100000000002", "PRONTUÁRIO DO ANIMAL", "TUTOR ATUAL",
      "NOME\nTutora Exemplo", "HISTÓRICO DO ANIMAL", "10/11/2026 · Cirurgia realizada", "Protocolo: 000002/2026", "Sem intercorrências"]) {
      expect(page).toContain(line);
    }
    expect(page).not.toContain("Histórico parcial");
  });
});

describe("the fields of the documents", () => {
  it("writes the age from the birth date, the weight with its unit and the masked CPF", () => {
    expect(animalAgeLabel({ birthDate: "2023-11-01" }, new Date(2026, 10, 19))).toBe("3 anos");
    expect(animalAgeLabel({ birthDate: "01/11/2025" }, new Date(2026, 10, 19))).toBe("1 ano");
    expect(animalAgeLabel({ birthDate: "2026-03-20" }, new Date(2026, 10, 19))).toBe("7 meses");
    expect(animalAgeLabel({ age: "2 anos" })).toBe("2 anos");
    expect(animalWeightLabel("12.4")).toBe("12,4 kg");
    expect(animalWeightLabel("12 kg")).toBe("12 kg");
    expect(documentCpf("01234567890")).toBe("012.345.678-90");
    expect(documentCpf("123")).toBe("123");
  });

  it("names the state, the moment of the acceptance and the file without the slash of the number", () => {
    expect(stateHeading("sc")).toBe("Estado de Santa Catarina");
    expect(stateHeading("DF")).toBe("Distrito Federal");
    expect(stateHeading("XX")).toBe("");
    expect(municipalDocumentStamp("2026-11-19T23:34:20Z")).toBe("19/11/2026 · 20:34:20");
    expect(documentFileName("Receita", "000001/2026")).toBe("Receita 000001-2026.pdf");
    expect(documentFileName("Relatório")).toBe("Relatório.pdf");
  });
});
