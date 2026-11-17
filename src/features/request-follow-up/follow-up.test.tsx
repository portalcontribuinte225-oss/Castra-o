import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { availableFollowUpContacts, buildFollowUpPayload, emptyFollowUp, getFollowUpIssues, maskFollowUpEmail, maskFollowUpPhone, resolveFollowUp } from "./follow-up";
import type { FollowUpValue, TutorContacts } from "./follow-up";
import { FollowUpSummary } from "./follow-up-summary";
import { loadFollowUpPolicy } from "./use-follow-up-policy";

const both: TutorContacts = { email: "Tutor@Example.com", phone: "(48) 99999-1234" };
const yes: FollowUpValue = { enabled: true };

describe("follow-up preference", () => {
  it("starts with no answer, sent as no notices, and accepting them needs at least one contact the municipality can reach", () => {
    expect(emptyFollowUp).toEqual({ enabled: null });
    expect(getFollowUpIssues(emptyFollowUp, { email: "", phone: "" }, true)).toEqual([]);
    expect(getFollowUpIssues(yes, both, true)).toEqual([]);
    expect(getFollowUpIssues(yes, { email: "", phone: "" }, true)[0]).toContain("ao menos um contato");
    expect(getFollowUpIssues(yes, { email: "bad", phone: "(48) 3333-4444" }, true)[0]).toContain("ao menos um contato");
    expect(getFollowUpIssues(yes, { email: "", phone: "(48) 99999-1234" }, false)[0]).toContain("ao menos um contato");
  });

  it("offers only the contacts the municipality can reach: a valid e-mail, and the mobile only with a phone channel", () => {
    expect(availableFollowUpContacts(both, true)).toEqual({ email: "tutor@example.com", phone: "48999991234" });
    expect(availableFollowUpContacts(both, false)).toEqual({ email: "tutor@example.com", phone: "" });
    expect(availableFollowUpContacts({ email: "", phone: "(48) 99999-1234" }, true)).toEqual({ email: "", phone: "48999991234" });
    expect(availableFollowUpContacts({ email: "bad", phone: "(48) 3333-4444" }, true)).toEqual({ email: "", phone: "" });
  });

  it("sends every contact that exists and can be reached, and nothing when the answer is no", () => {
    expect(buildFollowUpPayload(yes, both, true)).toEqual({ enabled: true, email: "tutor@example.com", phone: "48999991234" });
    expect(buildFollowUpPayload(yes, both, false)).toEqual({ enabled: true, email: "tutor@example.com", phone: "" });
    expect(buildFollowUpPayload(yes, { email: "", phone: "(48) 99999-1234" }, true)).toEqual({ enabled: true, email: "", phone: "48999991234" });
    expect(buildFollowUpPayload(emptyFollowUp, both, true)).toEqual({ enabled: false, email: "", phone: "" });
    expect(resolveFollowUp(yes, { email: "", phone: "(48) 99999-1234" }, true)).toEqual({ enabled: true, email: "", phone: "48999991234" });
    expect(() => buildFollowUpPayload(yes, { email: "", phone: "" }, true)).toThrow();
  });

  it("follows the contacts when they change after the answer", () => {
    expect(buildFollowUpPayload(yes, { email: "first@example.com", phone: "" }, true).email).toBe("first@example.com");
    expect(buildFollowUpPayload(yes, { email: "second@example.com", phone: "" }, true).email).toBe("second@example.com");
  });

  it("masks contacts in the conclusion", () => {
    expect(maskFollowUpEmail("rodrigo@example.com")).toBe("r*****@example.com");
    expect(maskFollowUpPhone("48999991234")).toBe("(48) *****-1234");
    const html = renderToStaticMarkup(<FollowUpSummary value={{ enabled: true, email: "rodrigo@example.com", phone: "48999991234" }} />);
    expect(html).not.toContain("rodrigo@example.com");
    expect(html).not.toContain("48999991234");
    expect(html).toContain("r*****@example.com");
  });
});

describe("municipal follow-up policy", () => {
  it("asks for a phone when WhatsApp is active or SMS can reach the selected municipality", async () => {
    // A has only WhatsApp, B has only SMS (the platform's channel with a contract), C has neither.
    const readConfig = vi.fn(async (_key: string, municipalityId: string) => ({ active: municipalityId === "municipality-a" }));
    const readSms = vi.fn(async (municipalityId: string) => ({ active: municipalityId === "municipality-b" }));
    expect(await loadFollowUpPolicy("municipality-a", readConfig, readSms)).toEqual({ phoneEnabled: true });
    expect(await loadFollowUpPolicy("municipality-b", readConfig, readSms)).toEqual({ phoneEnabled: true });
    expect(await loadFollowUpPolicy("municipality-c", readConfig, readSms)).toEqual({ phoneEnabled: false });
    expect(readConfig).toHaveBeenCalledWith("whatsapp", "municipality-c");
    expect(readSms).toHaveBeenCalledWith("municipality-c");
    expect(readConfig.mock.calls.map(([key]) => key)).toEqual(["whatsapp", "whatsapp", "whatsapp"]);
  });

  it("does not turn missing configuration or errors into an enabled phone", async () => {
    const none = vi.fn(async () => null);
    expect(await loadFollowUpPolicy("municipality-a", none, none)).toEqual({ phoneEnabled: false });
    const offline = vi.fn(async () => { throw new Error("offline"); });
    await expect(loadFollowUpPolicy("municipality-a", offline, none)).rejects.toThrow();
    await expect(loadFollowUpPolicy("municipality-a", none, offline)).rejects.toThrow();
  });
});
