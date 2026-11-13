import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";

describe("registered animal API boundaries", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", { getItem: () => "session-token" }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("keeps search and pagination scoped to the authenticated mine endpoint", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ animals: [], candidates: [], nextCursor: null })));
    vi.stubGlobal("fetch", fetch);
    await api.getMyAnimals("Bidu & irmãos", "cursor/next");
    expect(fetch.mock.calls[0][0]).toBe("/api/animals/mine?query=Bidu%20%26%20irm%C3%A3os&cursor=cursor%2Fnext");
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer session-token" });
  });

  it("materializes only the explicitly selected source item and fingerprint", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ animal: { id: "canonical-id" } })));
    vi.stubGlobal("fetch", fetch);
    const result = await api.resolvePreviousAnimal({ sourceRequestId: "own-request", animalIndex: 1, fingerprint: "snapshot-hash", name: "Bidu", declaredMicrochip: "untrusted-key" });
    expect(result.animal.id).toBe("canonical-id");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ sourceRequestId: "own-request", animalIndex: 1, fingerprint: "snapshot-hash" });
  });

  it("requests current requirements by selected type and loads document bytes only through authorized preview", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response("%PDF-example", { headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetch);
    const content = await api.getReusedDocumentContent("animal-a", { sourceRequestId: "source-a", attachmentId: "file-a", hash: "content-hash" });
    expect(content).toBeInstanceOf(Blob); expect(await content.text()).toBe("%PDF-example");
    expect(fetch.mock.calls[0][0]).toBe("/api/animals/animal-a/documents/source-a/file-a?hash=content-hash");
    fetch.mockImplementation(async () => new Response(JSON.stringify({ documents: [] })));
    await api.getAnimalRequestContext("animal-a", "type & one");
    expect(fetch.mock.calls[1][0]).toBe("/api/animals/animal-a/request-context?requestTypeId=type%20%26%20one");
  });

  it("loads availability as aggregates and retains conflict status for draft recovery", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ days: [], from: "2026-11-01", to: "2027-01-29" })));
    vi.stubGlobal("fetch", fetch);
    await api.getScheduleAvailability("town-a", "2026-11-01", "2027-01-29");
    expect(fetch.mock.calls[0][0]).toBe("/api/schedule/availability?municipalityId=town-a&from=2026-11-01&to=2027-01-29");
    fetch.mockImplementation(async () => new Response(JSON.stringify({ error: "A vaga foi ocupada. Escolha outra ocorrência." }), { status: 409 }));
    await expect(api.createRequest({})).rejects.toMatchObject({ status: 409, message: "A vaga foi ocupada. Escolha outra ocorrência." });
  });
});
