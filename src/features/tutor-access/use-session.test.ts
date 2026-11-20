import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthErrorCode } from "../../../shared/auth-contract.js";
import { ApiError } from "../../api";
import { GLOBAL_MUNICIPALITY_FILTER_KEY } from "../../domain";

const logout = vi.fn();
const getSession = vi.fn();
vi.mock("../../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../api")>(),
  api: { logout: () => logout(), getSession: (options) => getSession(options) },
}));

const { forgetBrowserSession, restoreBrowserSession } = await import("./use-session");

// A minimal localStorage: the tests run outside a browser.
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
    keys: () => [...items.keys()],
  };
}

describe("ending a session", () => {
  beforeEach(() => { logout.mockClear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("clears the global administration's municipality choice, so the next login starts with no municipality selected", () => {
    const storage = memoryStorage({ [GLOBAL_MUNICIPALITY_FILTER_KEY]: "municipality-a", "castragestao:user": "{}", "sidebar-collapsed": "true", "castragestao:municipalityId": "municipality-b" });
    vi.stubGlobal("localStorage", storage);
    forgetBrowserSession();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(storage.getItem(GLOBAL_MUNICIPALITY_FILTER_KEY)).toBeNull();
    expect(storage.getItem("castragestao:user")).toBeNull();
    expect(storage.keys().sort()).toEqual(["castragestao:municipalityId", "sidebar-collapsed"]);
  });

  it("is harmless when nothing was chosen", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    expect(() => forgetBrowserSession()).not.toThrow();
    expect(storage.keys()).toEqual([]);
  });
});

describe("restoring a saved session", () => {
  beforeEach(() => { getSession.mockReset(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("retries network errors and server downtime before restoring the session", async () => {
    const session = { user: { id: "staff-a" } };
    getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new ApiError("Unavailable", 503))
      .mockResolvedValueOnce(session);
    const onRetry = vi.fn();
    const restore = restoreBrowserSession(new AbortController().signal, onRetry);

    await vi.advanceTimersByTimeAsync(1000);
    expect(getSession).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(restore).resolves.toBe(session);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rejected session", async () => {
    getSession.mockRejectedValueOnce(new ApiError("Invalid session", 401, AuthErrorCode.SESSION_INVALID));

    await expect(restoreBrowserSession(new AbortController().signal, vi.fn())).rejects.toMatchObject({ code: AuthErrorCode.SESSION_INVALID });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("cancels a scheduled retry when a user leaves the saved session", async () => {
    getSession.mockRejectedValueOnce(new ApiError("Unavailable", 503));
    const controller = new AbortController();
    const restore = restoreBrowserSession(controller.signal, vi.fn());
    const cancelled = expect(restore).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.runAllTimersAsync();
    await cancelled;
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
