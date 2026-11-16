import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_MUNICIPALITY_FILTER_KEY } from "../../domain";

const logout = vi.fn();
vi.mock("../../api", () => ({ api: { logout: () => logout() }, ApiError: class extends Error {}, SESSION_INVALID_EVENT: "castragestao:session-invalid" }));

const { forgetBrowserSession } = await import("./use-session");

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
