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

  it("discovers without sending and sends only the selected opaque recovery option", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ recoveryToken: "recovery-token", options: [{ id: "sms-option", channel: "sms", maskedDestination: "(48) *****-1234" }] })));
    vi.stubGlobal("fetch", fetch);
    const context = { audience: AuthAudience.TUTOR, municipalityId: "town-a" };
    await api.getRecoveryOptions({ ...context, identifier: "52998224725" });
    expect(fetch.mock.calls).toHaveLength(1); expect(fetch.mock.calls[0][0]).toBe("/api/auth/recovery-options");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ ...context, identifier: "52998224725" });
    await api.forgotPassword({ ...context, recoveryToken: "recovery-token", optionId: "sms-option" });
    expect(fetch.mock.calls[1][0]).toBe("/api/auth/forgot-password");
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ ...context, recoveryToken: "recovery-token", optionId: "sms-option" });
    expect(values.size).toBe(0);
  });

  it("does not persist a late login after closing its context or starting a newer login", async () => {
    let resolveOld: (value: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const fetch = vi.fn().mockImplementationOnce(() => oldResponse).mockResolvedValueOnce(new Response(JSON.stringify({ token: "new-token", user: { id: "new-user" } })));
    vi.stubGlobal("fetch", fetch);
    const oldLogin = api.login("old-user", "old-pass");
    const rejected = expect(oldLogin).rejects.toMatchObject({ name: "AbortError" });
    await api.login("new-user", "new-pass");
    resolveOld(new Response(JSON.stringify({ token: "stale-token", user: { id: "old-user" } })));
    await rejected;
    expect(values.get("castragestao:token")).toBe("new-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "closed-token", user: { id: "closed-user" } }))));
    await expect(api.login("closed", "password", AuthAudience.TUTOR, "town-a", { isCurrent: () => false })).rejects.toMatchObject({ name: "AbortError" });
    expect(values.get("castragestao:token")).toBe("new-token");
  });

  it("does not restore a session after logout or let an old reset act on a newer session", async () => {
    let resolveLogin: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveLogin = resolve; })));
    const pendingLogin = api.login("user", "password");
    const loginRejected = expect(pendingLogin).rejects.toMatchObject({ name: "AbortError" });
    api.logout(); resolveLogin(new Response(JSON.stringify({ token: "stale-token", user: { id: "user" } })));
    await loginRejected; expect(values.size).toBe(0);

    let resolveReset: (value: Response) => void;
    const resetResponse = new Promise<Response>((resolve) => { resolveReset = resolve; });
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => resetResponse).mockResolvedValueOnce(new Response(JSON.stringify({ token: "new-token", user: { id: "new-user" } }))));
    const pendingReset = api.resetPassword({ audience: AuthAudience.TUTOR, municipalityId: "town-a", challengeId: "challenge", code: "123456", password: "abcdef" });
    const resetRejected = expect(pendingReset).rejects.toMatchObject({ name: "AbortError" });
    await api.login("new-user", "new-pass"); resolveReset(new Response(JSON.stringify({ ok: true })));
    await resetRejected; expect(values.get("castragestao:token")).toBe("new-token");
  });

  it("clears the eligible reset session immediately after its version guard without issuing a new login", async () => {
    values.set("castragestao:token", "old-token");
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetch);
    await api.resetPassword({ audience: AuthAudience.TUTOR, municipalityId: "town-a", challengeId: "challenge", code: "123456", password: "abcdef" });
    expect(values.size).toBe(0); expect(fetch.mock.calls).toHaveLength(1); expect(fetch.mock.calls[0][0]).toBe("/api/auth/reset-password");
  });

  it("preserves a newer pending login when an older authenticated request returns unauthorized", async () => {
    values.set("castragestao:token", "old-token");
    const dispatchEvent = vi.fn(); vi.stubGlobal("window", { dispatchEvent });
    let resolveSession: (value: Response) => void;
    let resolveLogin: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSession = resolve; }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveLogin = resolve; })));
    const oldSession = api.getSession(); const rejected = expect(oldSession).rejects.toMatchObject({ status: 401 });
    const newLogin = api.login("new-user", "new-pass");
    resolveSession(new Response(JSON.stringify({ error: "Sessão expirada." }), { status: 401 }));
    await rejected; expect(dispatchEvent).not.toHaveBeenCalled();
    resolveLogin(new Response(JSON.stringify({ token: "new-token", user: { id: "new-user" } })));
    await newLogin; expect(values.get("castragestao:token")).toBe("new-token");
  });
});
