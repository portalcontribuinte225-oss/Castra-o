import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthErrorCode } from "../../../shared/auth-contract.js";
import { api, SESSION_INVALID_EVENT } from "../../api";

describe("request tracking API boundaries", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", { getItem: () => "session-token" }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("opens the tracked request with the tracking token instead of the stored session token", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ request: { protocol: "000123/2026" } })));
    vi.stubGlobal("fetch", fetch);
    await api.getTrackedRequest("tracking-token");
    expect(fetch.mock.calls[0][0]).toBe("/api/request-tracking/request");
    expect(fetch.mock.calls[0][1]?.method).toBe("GET");
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer tracking-token" });
    expect(JSON.stringify(fetch.mock.calls[0][1]?.headers)).not.toContain("session-token");
  });

  it("never puts the tracking token or the code in a URL", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetch);
    await api.startRequestTracking({ municipalityId: "town-a", protocol: "000123/2026", contact: "citizen@example.com" });
    await api.confirmRequestTracking("challenge/with slash", "123456");
    await api.getTrackedRequest("tracking-token");
    for (const [url] of fetch.mock.calls) {
      expect(String(url)).not.toContain("tracking-token"); expect(String(url)).not.toContain("123456"); expect(String(url)).not.toContain("citizen");
    }
    expect(fetch.mock.calls[0][0]).toBe("/api/request-tracking/challenges");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ municipalityId: "town-a", protocol: "000123/2026", contact: "citizen@example.com" });
    expect(fetch.mock.calls[1][0]).toBe("/api/request-tracking/challenges/challenge%2Fwith%20slash/confirm");
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ code: "123456" });
  });

  it("an expired tracking session never signs the logged-in user out, while a rejected session still does", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const trackingError = "Acompanhamento expirado. Solicite um novo código.";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: trackingError }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Sessão inválida ou expirada.", code: AuthErrorCode.SESSION_INVALID }), { status: 401 })));
    await expect(api.getTrackedRequest("expired-token")).rejects.toMatchObject({ status: 401, message: trackingError });
    expect(dispatchEvent).not.toHaveBeenCalled();
    await expect(api.getRequests()).rejects.toMatchObject({ status: 401, code: AuthErrorCode.SESSION_INVALID });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: SESSION_INVALID_EVENT }));
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("carries the waiting time of a rate limit to the caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Aguarde para tentar novamente.", retryAfter: 60 }), { status: 429 })));
    await expect(api.startRequestTracking({ municipalityId: "town-a", protocol: "000123/2026", contact: "citizen@example.com" }))
      .rejects.toMatchObject({ status: 429, retryAfter: 60 });
  });
});
