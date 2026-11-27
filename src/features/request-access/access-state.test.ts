import { describe, expect, it } from "vitest";
import { NotificationChannel } from "../../../shared/notification-contract.js";
import { ACCESS_EXPIRED_MESSAGE, AccessActionType, AccessStep, accessFailureAction, accessReducer, initialAccessState } from "./access-state";
import type { AccessView } from "./access-types";

const challenge = { challengeId: "challenge-a", expiresIn: 600, retryAfter: 60 };
const view = { requests: [], account: { exists: false } } as AccessView;

describe("the access to the requests", () => {
  it("opens with the CPF of the last screen, no protocol and no channel chosen yet", () => {
    expect(initialAccessState()).toEqual({ step: AccessStep.IDENTIFY, cpf: "", channel: "", challenge: null, code: "", token: "", view: null,
      loading: false, error: "", retryUntil: 0 });
    expect(initialAccessState({ cpf: "52998224725" })).toMatchObject({ cpf: "52998224725" });
  });

  it("goes from the CPF to the code to the open requests, and back to the CPF to correct it", () => {
    let state = accessReducer(initialAccessState(), { type: AccessActionType.EDIT, fields: { cpf: "52998224725", channel: NotificationChannel.SMS } });
    state = accessReducer(accessReducer(state, { type: AccessActionType.START }), { type: AccessActionType.SENT, challenge });
    expect(state).toMatchObject({ step: AccessStep.CODE, challenge, loading: false, channel: NotificationChannel.SMS });
    state = accessReducer(state, { type: AccessActionType.EDIT, fields: { code: "123456" } });
    state = accessReducer(state, { type: AccessActionType.OPENED, token: "access-token", view });
    expect(state).toMatchObject({ step: AccessStep.VERIFIED, token: "access-token", view, code: "" });
    const corrected = accessReducer({ ...state, step: AccessStep.CODE }, { type: AccessActionType.CORRECT });
    expect(corrected).toMatchObject({ step: AccessStep.IDENTIFY, challenge: null, code: "", cpf: "52998224725", channel: NotificationChannel.SMS });
  });

  it("an expired access asks for a new code keeping the CPF and the channel, and nothing of the open requests", () => {
    const open = { ...initialAccessState({ cpf: "52998224725" }), step: AccessStep.VERIFIED, token: "access-token", view, channel: NotificationChannel.WHATSAPP };
    const action = accessFailureAction({ status: 401, message: "Acesso expirado." }, "fallback");
    expect(action).toEqual({ type: AccessActionType.EXPIRED });
    expect(accessReducer(open, action)).toMatchObject({ step: AccessStep.IDENTIFY, token: "", view: null, cpf: "52998224725",
      channel: NotificationChannel.WHATSAPP, error: ACCESS_EXPIRED_MESSAGE });
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
