import { buildDefaultSmsConfig, normalizeSmsConfig } from "../../../shared/sms-contract.js";
import type { SmsSettingsApi, SmsSettingsState, SmsTestAnswer, SmsTestOutcome } from "./sms-types";

function initialState(): SmsSettingsState {
  return { config: buildDefaultSmsConfig(), ready: false, loading: false, saving: false, testPhone: "", sendingTest: false, testOutcome: null, error: "" };
}

const notSent = (reason: string, detail = ""): SmsTestOutcome => ({ sent: false, reason, detail, providerMessageId: "" });

// The server answers a test send with fixed texts, so what it says is shown as it is; a missing reason is told as unknown.
function testOutcome(answer: SmsTestAnswer): SmsTestOutcome {
  if (answer?.status !== "sent") return notSent(String(answer?.reason || "erro desconhecido"), String(answer?.detail || ""));
  return { sent: true, reason: "", detail: "", providerMessageId: String(answer.providerMessageId || "") };
}

// This controller is private to one mounted municipality/permission context. Whether SMS is integrated comes from the server (the token
// lives in its variables); the messages of a municipality need one, and only the master sends a test.
export function createSmsSettingsController(client: SmsSettingsApi, municipalityId: string, master: boolean, canManage: boolean) {
  const reachable = canManage && (Boolean(municipalityId) || master);
  let state = { ...initialState(), loading: reachable };
  let revision = 0;
  let mounted = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SmsSettingsState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  const current = (captured: number) => mounted && captured === revision;
  const busy = () => state.loading || state.saving || state.sendingTest;
  const allowed = () => mounted && canManage && state.ready && !busy();
  const allowedTest = () => allowed() && master;
  const allowedUse = () => allowed() && Boolean(municipalityId);
  const statusOf = (error: unknown) => error && typeof error === "object" && "status" in error ? error.status : null;
  const failure = (error: unknown, message: string) => {
    const status = statusOf(error);
    return status === 401 || status === 403 ? "Sem permissão para configurar o SMS." : message;
  };
  // A refused number or too many tests come with the server's own words; any other failure stays generic.
  const testFailure = (error: unknown) => {
    const status = statusOf(error);
    return (status === 400 || status === 429) && error instanceof Error && error.message
      ? error.message : failure(error, "Não foi possível enviar o teste. Tente novamente.");
  };
  async function load() {
    const captured = ++revision;
    mounted = true;
    publish(initialState());
    if (!reachable) return;
    publish({ loading: true });
    try {
      const config = normalizeSmsConfig(await client.getSmsSettings(municipalityId));
      if (current(captured)) publish({ config, ready: true });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível carregar a configuração de SMS.") });
    } finally { if (current(captured)) publish({ loading: false }); }
  }
  // A message can only be turned on while SMS is integrated; the server enforces it too.
  async function setUseActive(use: string, active: boolean) {
    if (!allowedUse() || (active && !state.config.integrated)) return;
    const captured = revision;
    publish({ saving: true, error: "" });
    try {
      const saved = await client.setSmsUseActive(municipalityId, use, active);
      if (!current(captured)) return;
      if (!saved || typeof saved !== "object") throw new Error("Missing safe configuration");
      publish({ config: normalizeSmsConfig(saved) });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível alterar a mensagem. Tente novamente.") });
    } finally { if (current(captured)) publish({ saving: false }); }
  }
  // One real SMS to the typed number, through the server's token. "Sent" is the provider taking it; the carrier may still refuse.
  async function sendTest() {
    if (!allowedTest()) return;
    const phone = state.testPhone.trim();
    if (!phone) { publish({ testOutcome: notSent("Informe um número para o teste.") }); return; }
    if (phone.replace(/\D/g, "").length !== 11) { publish({ testOutcome: notSent("Informe o celular completo, com DDD e o 9: (00) 00000-0000.") }); return; }
    if (!state.config.integrated) { publish({ testOutcome: notSent("O SMS não está integrado.") }); return; }
    const captured = revision;
    publish({ sendingTest: true, testOutcome: null, error: "" });
    try {
      const answer = await client.sendSmsTest(municipalityId, phone);
      if (current(captured)) publish({ testOutcome: testOutcome(answer) });
    } catch (error) {
      if (current(captured)) publish({ testOutcome: notSent(testFailure(error)) });
    } finally { if (current(captured)) publish({ sendingTest: false }); }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    cancel: () => { mounted = false; revision++; publish(initialState()); },
    setTestPhone: (testPhone: string) => { if (allowedTest()) publish({ testPhone, testOutcome: null }); },
    setUseActive, sendTest,
  };
}
