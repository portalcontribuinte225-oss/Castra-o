import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../api";
import { AuthAudience } from "../../../shared/auth-contract.js";

describe("auth API boundaries", () => {
  const values = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  beforeEach(() => {
    values.clear(); setItem.mockClear();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) || null, setItem, removeItem: (key: string) => values.delete(key) });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("sends audience and municipality while persisting only the issued token", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ token: "session-token", user: { id: "tutor-a", mustChangePassword: true } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const user = await api.login("12345678900", "initial-secret", AuthAudience.TUTOR, "municipality-a");
    expect(user.mustChangePassword).toBe(true);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ identifier: "12345678900", password: "initial-secret", audience: AuthAudience.TUTOR, municipalityId: "municipality-a" });
    expect([...values.entries()]).toEqual([["castragestao:token", "session-token"]]);
    expect(setItem).not.toHaveBeenCalledWith("castragestao:user", expect.anything());
  });

  it("strips enrollment before returning a request and delivers the credential only via the callback", async () => {
    const enrollment = { temporaryPassword: "one-time-secret", cpf: "12345678900", municipalityId: "municipality-a" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ request: { id: "request-a", protocol: "000001/2026" }, enrollment }), { status: 201 })));
    const onEnrollment = vi.fn();
    const row = await api.createRequest({}, onEnrollment);
    expect(row).toEqual({ id: "request-a", protocol: "000001/2026" });
    expect(onEnrollment).toHaveBeenCalledTimes(1);
    expect(onEnrollment).toHaveBeenCalledWith(enrollment);
    expect(values.size).toBe(0);
  });

  it("preserves safe HTTP status, error code and retry information", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }), { status: 429, headers: { "Retry-After": "60" } })));
    await expect(api.login("cpf", "password", AuthAudience.TUTOR, "municipality-a")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfter: 60 });
    try { await api.login("cpf", "password"); } catch (failure) { expect(failure).toBeInstanceOf(ApiError); }
  });

  it("uses the dedicated current-password endpoint rather than administrative user upsert", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ token: "new-session-token", user: { id: "tutor-a", mustChangePassword: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await api.changePassword({ currentPassword: "old-secret", password: "new longer secret" });
    expect(fetch.mock.calls[0][0]).toContain("/auth/change-password");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ currentPassword: "old-secret", password: "new longer secret" });
    expect(values.get("castragestao:token")).toBe("new-session-token");
  });

  it("does not invalidate a newer session because an older request returned unauthorized", async () => {
    values.set("castragestao:token", "old-token");
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("fetch", vi.fn(async () => {
      values.set("castragestao:token", "new-token");
      return new Response(JSON.stringify({ error: "Sessão expirada." }), { status: 401 });
    }));
    await expect(api.getSession()).rejects.toMatchObject({ status: 401 });
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(values.get("castragestao:token")).toBe("new-token");
  });
});
