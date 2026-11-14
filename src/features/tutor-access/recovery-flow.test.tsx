import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuthAudience, AuthErrorCode } from "../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { authEntryKey, AuthEntryOrigin, createAuthEntryContext } from "./auth-entry-context";
import { PasswordRecoveryFields } from "./password-recovery-form";
import { PasswordChangeForm } from "./password-change-form";
import { initialRecoveryState, RecoveryActionType, recoveryFailureAction, recoveryReducer, RecoveryStep } from "./recovery-state";
import { challengeWindow } from "./use-auth-challenge-clock";
import type { AuthChallenge } from "./auth-types";
import type { RecoveryState } from "./recovery-state";
import { RegistrationContactFields, registrationContactIssues } from "./registration-contact-fields";
import { buildRequestPayload } from "../registered-animals/request-payload";

const options = { recoveryToken: "signed-recovery-token", options: [
  { id: "email-option", channel: NotificationChannel.EMAIL, maskedDestination: "a*****@example.com" },
  { id: "wa-option", channel: NotificationChannel.WHATSAPP, maskedDestination: "(48) *****-1234" },
  { id: "sms-option", channel: NotificationChannel.SMS, maskedDestination: "(48) *****-1234" },
] };
const challenge: AuthChallenge = { challengeId: "challenge-one", expiresIn: 600, retryAfter: 60 };
function discovered() { return recoveryReducer(initialRecoveryState("52998224725"), { type: RecoveryActionType.DISCOVERED, result: options }); }
function sent() { return recoveryReducer(discovered(), { type: RecoveryActionType.SENT, challenge, optionId: "sms-option", error: "" }); }
function render(state: RecoveryState, clock = { expiresIn: 600, retryIn: 60 }) {
  return renderToStaticMarkup(<PasswordRecoveryFields audience={AuthAudience.TUTOR} state={{ ...state, clock, discover: vi.fn(async () => {}), send: vi.fn(async () => {}), reset: vi.fn(async () => {}), restart: vi.fn(), cancel: vi.fn(), edit: vi.fn() }} onBack={() => {}} />);
}

describe("access entry origins", () => {
  it("uses staff for Entrar and tutor for registered/enrolled entries, requiring town only for tutor", () => {
    expect(createAuthEntryContext(AuthEntryOrigin.STAFF, "")?.audience).toBe(AuthAudience.STAFF);
    for (const origin of [AuthEntryOrigin.REGISTERED_ANIMAL, AuthEntryOrigin.ENROLLMENT]) {
      expect(createAuthEntryContext(origin, "")).toBeNull();
      const context = createAuthEntryContext(origin, "town-a")!;
      expect(context.audience).toBe(AuthAudience.TUTOR); expect(context.municipalityId).toBe("town-a");
      expect(authEntryKey(context)).not.toBe(authEntryKey({ ...context, municipalityId: "town-b" }));
      expect(authEntryKey(context)).not.toBe(authEntryKey(createAuthEntryContext(AuthEntryOrigin.STAFF, "town-a")!));
    }
  });
});

describe("three-step password recovery", () => {
  it("starts with identification only and advances to masked choices without showing code fields", () => {
    const identify = render(initialRecoveryState());
    expect(identify).toContain("CPF ou e-mail"); expect(identify).toContain("Continuar"); expect(identify).not.toContain("Nova senha");
    const choices = render(discovered());
    for (const label of ["e-mail: a*****@example.com", "WhatsApp: (48) *****-1234", "SMS: (48) *****-1234"]) expect(choices).toContain(label);
    expect(choices).not.toContain("52998224725"); expect(choices).not.toContain("signed-recovery-token"); expect(choices).not.toContain("Código recebido");
  });

  it("shows only supplied channels and handles an empty catalogue without inventing a destination", () => {
    const emailOnly = render({ ...discovered(), options: options.options.slice(0, 1) });
    expect(emailOnly).toContain("e-mail:"); expect(emailOnly).not.toContain("WhatsApp:"); expect(emailOnly).not.toContain("SMS:");
    const empty = render({ ...discovered(), options: [] });
    expect(empty).toContain("Nenhum contato disponível"); expect(empty).not.toContain("Receber código por");
  });

  it("keeps reset minimal and disables resend during cooldown without displaying a counter", () => {
    const html = render(sent());
    for (const text of ["Redefinir senha", "Código recebido", "Nova senha", "Confirmar nova senha", "Salvar nova senha", "Reenviar código", "Voltar ao login"]) expect(html).toContain(text);
    for (const removed of ["CPF ou e-mail", "52998224725", "Escolha o contato", "15 caracteres", "expira em", "segundos", "60s", "Se houver uma conta"]) expect(html).not.toContain(removed);
    expect(html).toContain('disabled="">Reenviar código');
    expect(render(sent(), { expiresIn: 540, retryIn: 0 })).not.toContain('disabled="">Reenviar código');
    expect(render(sent(), { expiresIn: 0, retryIn: 0 })).toContain("Código expirado. Reenvie.");
  });

  it("retains failed-delivery challenge/choice for resend and clears prior code/password on a new challenge", () => {
    const failed = recoveryReducer(discovered(), { type: RecoveryActionType.SENT, challenge, optionId: "wa-option", error: "Não foi possível enviar o código." });
    expect(failed).toMatchObject({ step: RecoveryStep.RESET, challenge, selectedOptionId: "wa-option" });
    expect(render(failed)).toContain("Não foi possível enviar o código");
    const edited = recoveryReducer(failed, { type: RecoveryActionType.EDIT, fields: { code: "123456", password: "abcdef", confirm: "abcdef" } });
    const resent = recoveryReducer(edited, { type: RecoveryActionType.SENT, challenge: { ...challenge, challengeId: "challenge-two" }, optionId: edited.selectedOptionId, error: "" });
    expect(resent).toMatchObject({ selectedOptionId: "wa-option", code: "", password: "", confirm: "", challenge: { challengeId: "challenge-two" } });
  });

  it("clears secrets/options on completion/back and keeps the account limit when restarting identification", () => {
    const state = recoveryReducer(sent(), { type: RecoveryActionType.EDIT, fields: { code: "123456", password: "abcdef", confirm: "abcdef" } });
    const limited = recoveryReducer(state, { type: RecoveryActionType.FAILED, error: "Aguarde.", retryUntil: 123000 });
    expect(recoveryReducer(limited, { type: RecoveryActionType.RESTART })).toMatchObject({ step: RecoveryStep.IDENTIFY, identifier: "52998224725", recoveryToken: "", options: [], challenge: null, password: "", confirm: "", code: "", retryUntil: 123000 });
    expect(recoveryReducer(state, { type: RecoveryActionType.CLEAR })).toEqual(initialRecoveryState());
  });

  it("restarts expired option discovery while retaining identification, and handles CPF/cooldown errors", () => {
    const state = recoveryReducer(sent(), { type: RecoveryActionType.EDIT, fields: { code: "123456", password: "abcdef", confirm: "abcdef" } });
    const expired = recoveryReducer(state, recoveryFailureAction({ code: AuthErrorCode.RECOVERY_OPTIONS_EXPIRED }, "Falha."));
    expect(expired).toMatchObject({ step: RecoveryStep.IDENTIFY, identifier: "52998224725", recoveryToken: "", selectedOptionId: "", challenge: null, code: "", password: "", confirm: "", error: "Escolha o contato novamente." });
    expect(recoveryFailureAction({ code: AuthErrorCode.CPF_REQUIRED }, "Falha.")).toMatchObject({ error: "Informe seu CPF." });
    expect(recoveryFailureAction({ message: "Aguarde.", retryAfter: 60 }, "Falha.", 1000)).toMatchObject({ retryUntil: 61000, error: "Aguarde." });
  });
});

describe("password policy and server challenge time", () => {
  it("keeps registration contacts optional and in the payload when operational follow-up is declined", () => {
    const html = renderToStaticMarkup(<RegistrationContactFields email="" phone="" onEmailChange={() => {}} onPhoneChange={() => {}} />);
    expect(html).toContain("opcional"); expect(html).toContain('type="email"'); expect(html).toContain('type="tel"');
    expect(html).not.toContain("required"); expect(html).not.toContain("WhatsApp");
    expect(registrationContactIssues("", "")).toEqual({ email: "", phone: "" });
    expect(registrationContactIssues("inválido", "123")).toMatchObject({ email: expect.any(String), phone: expect.any(String) });
    expect(registrationContactIssues("inválido", "123").email).not.toBe("");
    expect(registrationContactIssues("inválido", "123", false)).toEqual({ email: "", phone: "" });
    const body = buildRequestPayload({ email: "ana@example.com", phone: "48999991234", workflowData: { followUp: { enabled: false, email: "", phone: "" } } });
    expect(body).toMatchObject({ tutor_email: "ana@example.com", phone: "48999991234", workflow_data: { followUp: { enabled: false, email: "", phone: "" } } });
  });

  it("shows six-character policy for first change and the own-profile password form", () => {
    for (const mandatory of [false, true]) {
      const html = renderToStaticMarkup(<PasswordChangeForm mandatory={mandatory} onChanged={() => {}} />);
      expect(html).toContain("6 caracteres"); expect(html).not.toContain("15 caracteres");
    }
  });

  it("uses server deadlines after delivery time instead of restarting the original durations", () => {
    const delayed = { ...challenge, serverNow: "2026-11-13T12:00:45Z", expiresAt: "2026-11-13T12:10:00Z", retryAt: "2026-11-13T12:01:00Z" };
    expect(challengeWindow(delayed, 1000, 1000)).toEqual({ expiresIn: 555, retryIn: 15 });
    expect(challengeWindow(delayed, 1000, 16000)).toEqual({ expiresIn: 540, retryIn: 0 });
    expect(challengeWindow(delayed, 1000, 600000)).toEqual({ expiresIn: 0, retryIn: 0 });
  });
});
