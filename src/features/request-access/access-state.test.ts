import { describe, expect, it } from "vitest";
import { ContactKind } from "../../../shared/auth-contract.js";
import { ACCESS_EXPIRED_MESSAGE, AccessActionType, AccessStep, accessFailureAction, accessReducer, initialAccessState } from "./access-state";
import type { AccessView } from "./access-types";

const challenge = { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 };
const view = { request: { protocol: "000123/2026" }, account: { exists: false } } as AccessView;

describe("the access to a request", () => {
  it("opens with the protocol of the link or the protocol and CPF of the last screen, and the code by e-mail", () => {
    expect(initialAccessState()).toMatchObject({ step: AccessStep.IDENTIFY, protocol: "", cpf: "", channel: ContactKind.EMAIL, code: "", token: "", view: null });
    expect(initialAccessState({ protocol: "000123/2026", cpf: "52998224725" })).toMatchObject({ protocol: "000123/2026", cpf: "52998224725" });
  });

  it("goes from the data to the code to the open request, and back to the data to correct them", () => {
    let state = accessReducer(initialAccessState({ protocol: "000123/2026" }), { type: AccessActionType.EDIT, fields: { cpf: "52998224725", channel: ContactKind.PHONE } });
    state = accessReducer(accessReducer(state, { type: AccessActionType.START }), { type: AccessActionType.SENT, challenge });
    expect(state).toMatchObject({ step: AccessStep.CODE, challenge, loading: false, channel: ContactKind.PHONE });
    state = accessReducer(state, { type: AccessActionType.EDIT, fields: { code: "123456" } });
    state = accessReducer(state, { type: AccessActionType.OPENED, token: "access-token", view });
    expect(state).toMatchObject({ step: AccessStep.VERIFIED, token: "access-token", view, code: "" });
    const corrected = accessReducer({ ...state, step: AccessStep.CODE }, { type: AccessActionType.CORRECT });
    expect(corrected).toMatchObject({ step: AccessStep.IDENTIFY, challenge: null, code: "", protocol: "000123/2026", cpf: "52998224725" });
  });

  it("an expired access asks for a new code keeping what was typed, and nothing of the open request", () => {
    const open = { ...initialAccessState({ protocol: "000123/2026", cpf: "52998224725" }), step: AccessStep.VERIFIED, token: "access-token", view, channel: ContactKind.PHONE };
    const action = accessFailureAction({ status: 401, message: "Acesso expirado." }, "fallback");
    expect(action).toEqual({ type: AccessActionType.EXPIRED });
    expect(accessReducer(open, action)).toMatchObject({ step: AccessStep.IDENTIFY, token: "", view: null, protocol: "000123/2026", cpf: "52998224725",
      channel: ContactKind.PHONE, error: ACCESS_EXPIRED_MESSAGE });
  });

  it("an account found while creating the password turns the page into the sign-in, and other failures keep the person where they are", () => {
    const open = { ...initialAccessState(), step: AccessStep.VERIFIED, token: "access-token", view, loading: true };
    const found = accessReducer(open, accessFailureAction({ status: 409, message: "Este CPF já tem acesso." }, "fallback"));
    expect(found).toMatchObject({ step: AccessStep.VERIFIED, loading: false, error: "Este CPF já tem acesso.", view: { account: { exists: true } } });
    const limited = accessFailureAction({ status: 429, message: "Aguarde.", retryAfter: 60 }, "fallback", 1_000);
    expect(limited).toEqual({ type: AccessActionType.FAILED, error: "Aguarde.", retryUntil: 61_000 });
    expect(accessFailureAction(undefined, "Não foi possível enviar o código.")).toMatchObject({ error: "Não foi possível enviar o código." });
  });
});
