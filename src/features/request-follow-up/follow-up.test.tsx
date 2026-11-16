import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SMS_CONFIG_KEY } from "../../../shared/sms-contract.js";
import { buildFollowUpPayload, emptyFollowUp, getFollowUpIssues, maskFollowUpEmail, maskFollowUpPhone } from "./follow-up";
import { FollowUpStep } from "./follow-up-step";
import { FollowUpSummary } from "./follow-up-summary";
import { loadFollowUpPolicy } from "./use-follow-up-policy";

describe("follow-up preference", () => {
  it("requires an explicit answer and an email only after accepting", () => {
    expect(getFollowUpIssues(emptyFollowUp, false)).not.toHaveLength(0);
    expect(getFollowUpIssues({ enabled: false, email: "", phone: "" }, false)).toEqual([]);
    expect(getFollowUpIssues({ enabled: true, email: "", phone: "" }, false)).not.toHaveLength(0);
    expect(getFollowUpIssues({ enabled: true, email: "tutor@example.com", phone: "" }, true)).toEqual([]);
  });

  it("validates a supplied phone only while its channel is enabled", () => {
    const value = { enabled: true, email: "tutor@example.com", phone: "123" };
    expect(getFollowUpIssues(value, true)).not.toHaveLength(0);
    expect(getFollowUpIssues(value, false)).toEqual([]);
    expect(buildFollowUpPayload(value, false).phone).toBe("");
  });

  it("clears hidden contacts after declining and normalizes accepted contacts", () => {
    expect(buildFollowUpPayload({ enabled: false, email: "staff@example.com", phone: "48999998888" }, true)).toEqual({ enabled: false, email: "", phone: "" });
    expect(buildFollowUpPayload({ enabled: true, email: " Tutor@Example.com ", phone: "(48) 99999-8888" }, true)).toEqual({ enabled: true, email: "tutor@example.com", phone: "48999998888" });
  });

  it("rejects malformed email and overlong contact values", () => {
    for (const email of ["sem-arroba", "a@", "a@b", `${"x".repeat(255)}@example.com`]) {
      expect(getFollowUpIssues({ enabled: true, email, phone: "" }, false)).not.toHaveLength(0);
    }
  });

  it("masks contacts in the conclusion", () => {
    expect(maskFollowUpEmail("rodrigo@example.com")).toBe("r*****@example.com");
    expect(maskFollowUpPhone("48999991234")).toBe("(48) *****-1234");
    const html = renderToStaticMarkup(<FollowUpSummary value={{ enabled: true, email: "rodrigo@example.com", phone: "48999991234" }} />);
    expect(html).not.toContain("rodrigo@example.com");
    expect(html).not.toContain("48999991234");
    expect(html).toContain("r*****@example.com");
  });

  it("shows no phone or channel selector when no phone channel is available", () => {
    const html = renderToStaticMarkup(<FollowUpStep value={{ enabled: true, email: "", phone: "" }} onChange={() => {}} phoneEnabled={false} loading={false} error="" onRetry={() => {}} showErrors={false} />);
    expect(html).toContain('type="email"');
    expect(html).not.toContain('type="tel"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("SMS");
  });

  it("presents loading, retry and the consequence of declining", () => {
    const base = { value: { enabled: false, email: "", phone: "" }, onChange: () => {}, phoneEnabled: false, loading: false, error: "", onRetry: () => {}, showErrors: false };
    expect(renderToStaticMarkup(<FollowUpStep {...base} loading />)).toContain("Carregando canais");
    expect(renderToStaticMarkup(<FollowUpStep {...base} error="Falha ao carregar" />)).toContain("Tentar novamente");
    expect(renderToStaticMarkup(<FollowUpStep {...base} />)).toContain("mudanças na data");
  });
});

describe("municipal follow-up policy", () => {
  it("asks for a phone when WhatsApp or SMS is active in the selected municipality", async () => {
    // A has only WhatsApp, B has only SMS, C has neither.
    const read = vi.fn(async (key: string, municipalityId: string) => ({ active: municipalityId === (key === SMS_CONFIG_KEY ? "municipality-b" : "municipality-a") }));
    expect(await loadFollowUpPolicy("municipality-a", read)).toEqual({ phoneEnabled: true });
    expect(await loadFollowUpPolicy("municipality-b", read)).toEqual({ phoneEnabled: true });
    expect(await loadFollowUpPolicy("municipality-c", read)).toEqual({ phoneEnabled: false });
    expect(read).toHaveBeenCalledWith("whatsapp", "municipality-c");
    expect(read).toHaveBeenCalledWith(SMS_CONFIG_KEY, "municipality-c");
    expect(read.mock.calls.map(([key]) => key)).not.toContain("castragestao:notifications");
  });

  it("does not turn missing configuration or errors into an enabled phone", async () => {
    expect(await loadFollowUpPolicy("municipality-a", vi.fn(async () => null))).toEqual({ phoneEnabled: false });
    await expect(loadFollowUpPolicy("municipality-a", vi.fn(async () => { throw new Error("offline"); }))).rejects.toThrow();
  });
});
