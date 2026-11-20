import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestKind } from "../../../shared/request-contract.js";
import { ApiError } from "../../api";
import { RegisteredAnimalsView } from "../registered-animals/registered-animals-view";
import { useRegisteredAnimals } from "../registered-animals/use-registered-animals";
import { AnimalDeathForm } from "./animal-death-form";
import { AnimalHistoryTone, AnimalRecordType, animalHistoryTitle, animalHistoryTone, getAnimalHistoryMunicipality, getAnimalHistorySchedule } from "./animal-history";
import { AnimalRecordView } from "./animal-record-view";
import { buildDeathPayload, buildTransferPayload, describeAnimal, emptyDeathForm, emptyTransferForm, validateDeathForm, validateTransferForm } from "./animal-service-forms";
import { AnimalService } from "./animal-service-types";
import type { AnimalRecord, AnimalSummary } from "./animal-service-types";
import { AnimalServiceWorkspace } from "./animal-service-workspace";
import { AnimalTransferForm } from "./animal-transfer-form";
import { useAnimalRecord } from "./use-animal-record";
import { ANIMAL_SERVICE_FAILURE, submitAnimalServiceRequest } from "./use-animal-service-request";

vi.mock("./use-animal-record", () => ({ useAnimalRecord: vi.fn() }));
vi.mock("../registered-animals/use-registered-animals", () => ({ useRegisteredAnimals: vi.fn() }));

const animal: AnimalSummary = { id: "animal-a", name: "Bidu", species: "Cão", sex: "Macho", microchip: "CHIP123" };
const record: AnimalRecord = {
  animal: { ...animal, status: "ativo" },
  tutor: { tutor_name: "Ana Silva", cpf: "52998224725", phone: "(48) 99999-1234", tutor_email: "ana@example.com", address: "Rua A", city: "Florianópolis", state: "SC" },
  history: [
    { type: AnimalRecordType.DEATH_REQUEST, status: "NOVA", protocol: "000001/2026", occurred_at: "2026-11-13T10:00:00Z", request_id: "request-1", notes: "Observação", data: { registration: { municipality: "Florianópolis" } } },
    { type: AnimalRecordType.SURGERY_DONE, occurred_at: "2026-10-01T10:00:00Z", request_id: "request-2" },
  ],
};
const noop = async () => {};

function mockRecord(state: Partial<ReturnType<typeof useAnimalRecord>>) {
  vi.mocked(useAnimalRecord).mockReturnValue({ record: null, loading: false, error: "", retry: vi.fn(), ...state });
}

beforeEach(() => { vi.clearAllMocks(); });

describe("animal history helpers", () => {
  it("names and colors events and reads their schedule and municipality", () => {
    expect(animalHistoryTitle({ type: RequestKind.DEATH })).toBe("Registro de óbito");
    expect(animalHistoryTitle({ type: "UNKNOWN", title: "Custom title" })).toBe("Custom title");
    expect(animalHistoryTitle({})).toBe("Evento");
    expect(animalHistoryTone({ type: AnimalRecordType.DEATH_REQUEST })).toBe(AnimalHistoryTone.DANGER);
    expect(animalHistoryTone({ type: RequestKind.TRANSFER })).toBe(AnimalHistoryTone.TRANSFER);
    expect(animalHistoryTone({ type: AnimalRecordType.SURGERY_DONE })).toBe(AnimalHistoryTone.SUCCESS);
    expect(animalHistoryTone({ status: "AGENDADA" })).toBe(AnimalHistoryTone.SCHEDULED);
    expect(animalHistoryTone({ status: "NOVA" })).toBe(AnimalHistoryTone.NEUTRAL);
    expect(getAnimalHistorySchedule({ data: { registration: { schedule_date: "20/11/2026" } } })).toBe("20/11/2026");
    expect(getAnimalHistoryMunicipality({ data: { registration: { schedule_municipality: "Palhoça" } } })).toBe("Palhoça");
    expect(getAnimalHistoryMunicipality({})).toBe("");
  });
});

describe("animal service forms", () => {
  it("needs a date and a cause for a death and trims the cause", () => {
    expect(validateDeathForm(emptyDeathForm())).not.toBe("");
    expect(validateDeathForm({ death_date: "2026-11-13", death_cause: "   ", notes: "" })).not.toBe("");
    const filled = { death_date: "2026-11-13", death_cause: "  Illness  ", notes: "" };
    expect(validateDeathForm(filled)).toBe("");
    expect(buildDeathPayload(filled).death_cause).toBe("Illness");
  });

  it("needs the new tutor's name and a valid CPF and sends digits only, with no credential fields", () => {
    expect(validateTransferForm(emptyTransferForm())).not.toBe("");
    expect(validateTransferForm({ ...emptyTransferForm(), target_tutor_name: "New Tutor", target_tutor_cpf: "111.111.111-11" })).not.toBe("");
    const filled = { ...emptyTransferForm(), target_tutor_name: "  New Tutor ", target_tutor_cpf: "111.444.777-35" };
    expect(validateTransferForm(filled)).toBe("");
    const payload = buildTransferPayload(filled);
    expect(payload.target_tutor_cpf).toBe("11144477735");
    expect(payload.target_tutor_name).toBe("New Tutor");
    expect(Object.keys(payload).sort()).toEqual(Object.keys(emptyTransferForm()).sort());
    expect(Object.keys(payload).some((key) => /^(cpf|validation)/i.test(key))).toBe(false);
  });

  it("describes an animal with or without a microchip", () => {
    expect(describeAnimal(animal)).toBe("Bidu · CHIP123");
    expect(describeAnimal({ id: "x" })).toBe("Animal sem nome");
    expect(describeAnimal({ id: "x", name: "Rex", declaredMicrochip: "DECLARED1" })).toBe("Rex · DECLARED1");
  });
});

describe("submitting an animal service request", () => {
  it("passes the animal id and payload to the API and returns the created request", async () => {
    const submit = vi.fn(async () => ({ protocol: "000001/2026" }));
    expect(await submitAnimalServiceRequest(submit, "animal-a", { death_date: "2026-11-13" })).toEqual({ created: { protocol: "000001/2026" } });
    expect(submit).toHaveBeenCalledWith("animal-a", { death_date: "2026-11-13" });
  });

  it("shows only the server's own message or a generic text without internals", async () => {
    const denied = async () => { throw new ApiError("Solicitacao nao autorizada para este animal.", 403); };
    expect(await submitAnimalServiceRequest(denied, "animal-a", {})).toEqual({ error: "Solicitacao nao autorizada para este animal." });
    const broken = async () => { throw new TypeError("secret stack detail"); };
    expect(await submitAnimalServiceRequest(broken, "animal-a", {})).toEqual({ error: ANIMAL_SERVICE_FAILURE });
  });
});

describe("animal service screens", () => {
  it("renders the death form for the chosen animal with a destructive confirm action", () => {
    const html = renderToStaticMarkup(<AnimalDeathForm animal={animal} onBack={() => {}} />);
    expect(html).toContain("Registrar óbito"); expect(html).toContain("Bidu · CHIP123");
    expect(html).toContain("Data do óbito"); expect(html).toContain("Causa mortis");
    const confirmButton = html.match(/<button[^>]+>Confirmar óbito<\/button>/)?.[0];
    expect(confirmButton).toContain('type="submit"');
    expect(confirmButton).toContain("tw:border-ui-danger");
  });

  it("renders the transfer form with tutor and address sections and no credential field", () => {
    const html = renderToStaticMarkup(<AnimalTransferForm animal={animal} onBack={() => {}} />);
    expect(html).toContain("Trocar tutor"); expect(html).toContain("Novo tutor"); expect(html).toContain("Endereço");
    expect(html).toContain("Solicitar troca");
    expect(html).not.toContain("Chave"); expect(html).not.toContain("CPF do tutor");
  });

  it("opens the record, transfer or death screen from the chosen service", () => {
    mockRecord({ loading: true });
    const open = (service: AnimalService) => renderToStaticMarkup(<AnimalServiceWorkspace selection={{ animal, service }} onBack={() => {}} downloadRecordPdf={noop} />);
    expect(open(AnimalService.RECORD)).toContain("Carregando prontuário...");
    expect(open(AnimalService.TRANSFER)).toContain("Solicitar troca");
    expect(open(AnimalService.DEATH)).toContain("Confirmar óbito");
  });
});

describe("animal record view", () => {
  it("shows the history and keeps the tutor's CPF and contacts masked", () => {
    mockRecord({ record });
    const html = renderToStaticMarkup(<AnimalRecordView animalId="animal-a" onBack={() => {}} downloadRecordPdf={noop} />);
    expect(html).toContain("Bidu"); expect(html).toContain("Ana Silva");
    expect(html).toContain("***.982.247-**"); expect(html).not.toContain("52998224725");
    expect(html).toContain("(48) *****-1234"); expect(html).toContain("a*****@example.com");
    expect(html).not.toContain("ana@example.com"); expect(html).not.toContain("99999-1234");
    expect(html).toContain("Solicitação de óbito"); expect(html).toContain("Cirurgia realizada"); expect(html).toContain("#000001/2026");
    expect(html).toContain("Baixar prontuário PDF"); expect(html).toContain("para este animal");
  });

  it("states a missing microchip for an animal registered without one", () => {
    mockRecord({ record: { ...record, animal: { ...record.animal, microchip: null } } });
    const html = renderToStaticMarkup(<AnimalRecordView animalId="animal-a" onBack={() => {}} downloadRecordPdf={noop} />);
    expect(html).toContain("Microchip não informado");
  });

  it("handles loading and failure with a retry", () => {
    mockRecord({ loading: true });
    expect(renderToStaticMarkup(<AnimalRecordView animalId="animal-a" onBack={() => {}} downloadRecordPdf={noop} />)).toContain("Carregando prontuário...");
    mockRecord({ error: "Não foi possível carregar o prontuário deste animal." });
    const html = renderToStaticMarkup(<AnimalRecordView animalId="animal-a" onBack={() => {}} downloadRecordPdf={noop} />);
    expect(html).toContain('role="alert"'); expect(html).toContain("Tentar novamente"); expect(html).toContain("Voltar aos meus animais");
  });
});

describe("registered animals list actions", () => {
  it("offers record, transfer and death only for animals already registered", () => {
    vi.mocked(useRegisteredAnimals).mockReturnValue({
      animals: [{ id: "animal-a", name: "Bidu", species: "Cão", confirmedMicrochip: "CHIP123" }],
      candidates: [{ sourceRequestId: "request-1", animalIndex: 0, fingerprint: "fingerprint", name: "Rex", species: "Cão" }],
      nextCursor: null, query: "", setQuery: vi.fn(), loading: false, error: "", resolving: "", resolve: vi.fn(), loadMore: vi.fn(), retry: vi.fn(),
    });
    const html = renderToStaticMarkup(<RegisteredAnimalsView onSelect={() => {}} onNew={() => {}} onService={() => {}} />);
    for (const label of ["Prontuário", "Trocar tutor", "Registrar óbito"]) expect(html.match(new RegExp(label, "g"))).toHaveLength(1);
    expect(html).toContain("Bidu"); expect(html).toContain("Rex");
  });
});
