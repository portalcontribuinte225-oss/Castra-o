import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { AuthErrorCode } from "../../../shared/auth-contract.js";

const ADOPTION_ID = "0f8c3a52-6b1d-4e7a-9c2f-5d4b3a2e1f00";

// The page a shared adoption link opens in a browser that keeps a session, as main.tsx sets it up.
describe("a page opened by a shared adoption link", () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    values.set("castragestao:token", "staff-session");
    api.ignoreSavedSession();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("goes without the saved session and never ends it", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: "Sessão inválida", code: AuthErrorCode.SESSION_INVALID }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);

    expect(api.hasToken()).toBe(false);
    await expect(api.getPublicAdoption(ADOPTION_ID)).rejects.toMatchObject({ status: 401 });
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(values.get("castragestao:token")).toBe("staff-session");
  });

  it("uses the session of a sign-in made on the page", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ token: "visitor-session", user: { id: "user-a", mustChangePassword: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await api.login("visitor@example.test", "fake-password");
    await api.getAdoptions("municipality-a");

    expect(values.get("castragestao:token")).toBe("visitor-session");
    expect(api.hasToken()).toBe(true);
    expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer visitor-session" });
  });
});
