import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { availableFollowUpContacts, buildFollowUpPayload, emptyFollowUp, getFollowUpIssues, maskFollowUpEmail, maskFollowUpPhone, resolveFollowUp } from "./follow-up";
import type { FollowUpValue, TutorContacts } from "./follow-up";
import { FollowUpStep } from "./follow-up-step";
import { FollowUpSummary } from "./follow-up-summary";
import { loadFollowUpPolicy } from "./use-follow-up-policy";

const both: TutorContacts = { email: "Tutor@Example.com", phone: "(48) 99999-1234" };
const yes: FollowUpValue = { ...emptyFollowUp, enabled: true };

describe("follow-up preference", () => {
  it("requires an explicit answer, and then at least one contact chosen among the ones the tutor gave", () => {
    expect(getFollowUpIssues(emptyFollowUp, both, true)).not.toHaveLength(0);
    expect(getFollowUpIssues({ ...emptyFollowUp, enabled: false }, { email: "", phone: "" }, true)).toEqual([]);
    expect(getFollowUpIssues(yes, both, true)).toEqual([]);
    expect(getFollowUpIssues({ ...yes, usePhone: false }, both, true)).toEqual([]);
    expect(getFollowUpIssues({ ...yes, useEmail: false }, both, true)).toEqual([]);
    expect(getFollowUpIssues({ ...yes, useEmail: false, usePhone: false }, both, true)[0]).toContain("ao menos um contato");
    expect(getFollowUpIssues(yes, { email: "", phone: "(48) 99999-1234" }, false)[0]).toContain("ao menos um contato");
  });

  it("offers only the contacts the municipality can reach: a valid e-mail, and the mobile only with a phone channel", () => {
    expect(availableFollowUpContacts(both, true)).toEqual({ email: "tutor@example.com", phone: "48999991234" });
    expect(availableFollowUpContacts(both, false)).toEqual({ email: "tutor@example.com", phone: "" });
    expect(availableFollowUpContacts({ email: "", phone: "(48) 99999-1234" }, true)).toEqual({ email: "", phone: "48999991234" });
    expect(availableFollowUpContacts({ email: "bad", phone: "(48) 3333-4444" }, true)).toEqual({ email: "", phone: "" });
  });

  it("sends what was chosen: the chosen contacts that exist, and nothing when the answer is no", () => {
    expect(buildFollowUpPayload(yes, both, true)).toEqual({ enabled: true, email: "tutor@example.com", phone: "48999991234" });
    expect(buildFollowUpPayload({ ...yes, usePhone: false }, both, true)).toEqual({ enabled: true, email: "tutor@example.com", phone: "" });
    expect(buildFollowUpPayload({ ...yes, useEmail: false }, both, true)).toEqual({ enabled: true, email: "", phone: "48999991234" });
    expect(buildFollowUpPayload(yes, both, false)).toEqual({ enabled: true, email: "tutor@example.com", phone: "" });
    expect(buildFollowUpPayload({ ...emptyFollowUp, enabled: false }, both, true)).toEqual({ enabled: false, email: "", phone: "" });
    expect(resolveFollowUp(yes, { email: "", phone: "(48) 99999-1234" }, true)).toEqual({ enabled: true, email: "", phone: "48999991234" });
    expect(() => buildFollowUpPayload({ ...yes, useEmail: false, usePhone: false }, both, true)).toThrow();
  });

  it("follows the contacts when the tutor changes them after answering, with the same choice", () => {
    const chosen = { ...yes, usePhone: false };
    expect(buildFollowUpPayload(chosen, { email: "first@example.com", phone: "(48) 99999-1234" }, true).email).toBe("first@example.com");
    expect(buildFollowUpPayload(chosen, { email: "second@example.com", phone: "(48) 99999-1234" }, true).email).toBe("second@example.com");
    expect(buildFollowUpPayload(chosen, { email: "second@example.com", phone: "(48) 99999-1234" }, true).phone).toBe("");
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

describe("follow-up step", () => {
  const base = { value: emptyFollowUp, onChange: () => {}, contacts: both, phoneEnabled: true, loading: false, error: "", onRetry: () => {}, showErrors: false };
  const step = (props: Partial<React.ComponentProps<typeof FollowUpStep>> = {}) => renderToStaticMarkup(<FollowUpStep {...base} {...props} />);

  it("asks the question first and shows no contact until the answer is yes", () => {
    const html = step();
    expect(html).toContain("Quer acompanhar sua solicitação?"); expect(html).toContain('type="radio"');
    expect(html).not.toContain("Receber os avisos por"); expect(html).not.toContain('type="email"'); expect(html).not.toContain('type="tel"');
  });

  it("after yes, offers the contacts already given, masked and marked, with nothing to type again", () => {
    const html = step({ value: yes, onEditContacts: () => {} });
    expect(html).toContain("Receber os avisos por");
    expect(html).toContain("E-mail <strong>t*****@example.com</strong>"); expect(html).toContain("Celular <strong>(48) *****-1234</strong>");
    expect(html.match(/type="checkbox"[^>]*checked=""/g)).toHaveLength(2);
    expect(html).not.toContain('type="email"'); expect(html).not.toContain('type="tel"');
    expect(html).not.toContain("tutor@example.com"); expect(html).not.toContain("99999-1234");
    expect(html).toContain("Alterar contatos");
    expect(step({ value: yes })).not.toContain("Alterar contatos");
  });

  it("shows a contact as unmarked when it was unmarked, and the issue when none is left", () => {
    const one = step({ value: { ...yes, usePhone: false } });
    expect(one.match(/type="checkbox"[^>]*checked=""/g)).toHaveLength(1);
    const none = step({ value: { ...yes, useEmail: false, usePhone: false }, showErrors: true });
    expect(none.match(/type="checkbox"[^>]*checked=""/g)).toBeNull();
    expect(none).toContain("Selecione ao menos um contato");
  });

  it("offers only the e-mail when the municipality has no phone channel, and only the phone when no e-mail was given", () => {
    const noPhoneChannel = step({ value: yes, phoneEnabled: false });
    expect(noPhoneChannel).toContain("E-mail <strong>"); expect(noPhoneChannel).not.toContain("Celular <strong>");
    const noEmail = step({ value: yes, contacts: { email: "", phone: "(48) 99999-1234" } });
    expect(noEmail).not.toContain("E-mail <strong>"); expect(noEmail).toContain("Celular <strong>");
  });

  it("cannot be accepted when there is no way to reach the tutor, and tells how to fix it", () => {
    const noChannel = step({ contacts: { email: "", phone: "(48) 99999-1234" }, phoneEnabled: false, onEditContacts: () => {} });
    expect(noChannel).toContain("ainda não envia avisos por celular"); expect(noChannel).toContain("Informar e-mail");
    expect(noChannel).toMatch(/<input[^>]*type="radio"[^>]*disabled=""[^>]*\/>\s*Sim/);
    expect(noChannel).not.toMatch(/<input[^>]*type="radio"[^>]*disabled=""[^>]*\/>\s*Não/);
    const noContact = step({ contacts: { email: "", phone: "(48) 3333-4444" }, phoneEnabled: true });
    expect(noContact).toContain("Não há contato disponível");
    expect(step({ contacts: { email: "", phone: "" }, phoneEnabled: false })).not.toContain("Informar e-mail");
  });

  it("explains the consequence of declining without saying the contact is missing", () => {
    const html = step({ value: { ...emptyFollowUp, enabled: false } });
    expect(html).toContain("Você optou por não receber avisos"); expect(html).toContain("mudanças na data"); expect(html).not.toContain("Sem um contato");
  });

  it("presents loading and retry, locking the answer meanwhile", () => {
    expect(step({ loading: true })).toContain("Carregando canais");
    expect(step({ loading: true })).toMatch(/<fieldset[^>]*disabled=""/);
    expect(step({ error: "Falha ao carregar" })).toContain("Tentar novamente");
    expect(step({ error: "Falha ao carregar", contacts: { email: "", phone: "" } })).not.toContain("ainda não envia avisos");
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
