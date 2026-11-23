import { describe, expect, it } from "vitest";
import { ADOPTION_STATUS_ADOPTED, ADOPTION_STATUS_AVAILABLE } from "../adoption/adoption-status";
import { adoptionSummary, adoptionsInRange, animalCounts, animalProfile, countLabels, requestOrigins } from "./animal-metrics";
import { DashboardPeriod, periodRange } from "./dashboard-period";
import { TEST_NOW, testRequest } from "./dashboard-test-requests";
import { loadConcentration, personLoads, queueBySector, teamSummary } from "./team-metrics";

const range = periodRange(DashboardPeriod.LAST_30_DAYS, { from: "", to: "" }, TEST_NOW);
const teams = { users: [], sectors: [{ id: "s1", name: "Setor Teste" }] };

describe("dashboard team", () => {
  it("sets what each person received against what they closed, leaving out the requests without anyone", () => {
    const requests = [
      testRequest({ responsible: "Pessoa A" }),
      testRequest({ responsible: "Pessoa A", status: "REALIZADA", preferredSchedule: "12/11/2026" }),
      testRequest({ responsible: "Pessoa B" }),
      testRequest(),
    ];
    expect(personLoads(requests, range, teams, null)).toEqual([
      { label: "Pessoa A", assigned: 2, closed: 1 },
      { label: "Pessoa B", assigned: 1, closed: 0 },
    ]);
  });

  it("finds where today's queue waits and how much of it one person holds", () => {
    const requests = [
      testRequest({ responsible: "Pessoa A", assignedSectorId: "s1" }),
      testRequest({ responsible: "Pessoa A" }),
      testRequest({ responsible: "Pessoa B" }),
      testRequest({ status: "REALIZADA", responsible: "Pessoa B", preferredSchedule: "12/11/2026" }),
    ];
    expect(queueBySector(requests, teams)).toEqual([{ label: "Sem setor", value: 2 }, { label: "Setor Teste", value: 1 }]);
    expect(loadConcentration(requests, teams, null)).toEqual({ name: "Pessoa A", count: 2, total: 3, share: 67 });
    expect(loadConcentration([testRequest()], teams, null)).toBeNull();
  });

  it("sums up the team as registered and as it works", () => {
    const people = { users: [{ id: "u1", active: true }, { id: "u2", active: false }, { id: "u3" }], sectors: [{ id: "s1" }, { id: "s2", active: false }] };
    const requests = [
      testRequest({ responsible: "Pessoa A" }),
      testRequest({ responsible: "Pessoa A" }),
      testRequest({ responsible: "Pessoa B" }),
      testRequest({ responsible: "Pessoa B", status: "REALIZADA", preferredSchedule: "12/11/2026" }),
    ];
    expect(teamSummary(requests, range, people, null)).toEqual({ activeUsers: 2, activeSectors: 1, peopleWithQueue: 2, queuePerPerson: 1.5, closedPerPerson: 1 });
  });
});

describe("dashboard animals and adoption", () => {
  it("counts the animals asked for and served in the period, and the share of them with a microchip", () => {
    const requests = [
      testRequest({ animals: [{ name: "A", microchip: "900000000000001" }, { name: "B" }] }),
      testRequest({ status: "REALIZADA", preferredSchedule: "12/11/2026", animals: [{ name: "C" }] }),
    ];
    expect(animalCounts(requests, range)).toEqual({ requested: 3, served: 1, microchipShare: 33 });
  });

  it("counts labels written in different ways as one", () => {
    expect(countLabels(["Cão", " cão", "Gato", ""])).toEqual([
      { label: "Cão", value: 2 },
      { label: "Gato", value: 1 },
      { label: "Não informado", value: 1 },
    ]);
  });

  it("profiles the animals and the origin of the requests of the period", () => {
    const requests = [
      testRequest({ origin: "INTERNA", animals: [{ species: "Gato", sex: "Fêmea", size: "Médio" }, { species: "Cão", sex: "Macho", size: "Pequeno" }] }),
      testRequest(),
      testRequest({ createdAt: "2026-01-01T10:00:00" }),
    ];
    expect(animalProfile(requests, range).species).toEqual([{ label: "Cão", value: 2 }, { label: "Gato", value: 1 }]);
    expect(requestOrigins(requests, range).map((origin) => origin.value)).toEqual([1, 1]);
  });

  it("dates an adoption by the day of adoption and measures the time it took", () => {
    const animals = [
      { status: ADOPTION_STATUS_ADOPTED, createdAt: "2026-11-01T10:00:00", adopted_at: "2026-11-11T10:00:00" },
      { status: ADOPTION_STATUS_ADOPTED, createdAt: "2026-01-01T10:00:00", adopted_at: "2026-02-01T10:00:00" },
      { status: ADOPTION_STATUS_AVAILABLE, interest_count: 3 },
    ];
    expect(adoptionsInRange(animals, range)).toBe(1);
    expect(adoptionSummary(animals, range)).toEqual({ waiting: 1, interests: 3, averageDaysToAdopt: 10 });
  });
});
