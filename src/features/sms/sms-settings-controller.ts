import { buildDefaultSmsConfig, normalizeSmsConfig, SmsEnvironment, validateSmsToken } from "../../../shared/sms-contract.js";
import type { SmsAccountInput, SmsConnectionResult, SmsSettingsApi, SmsSettingsState, SmsTestAnswer, SmsTestOutcome } from "./sms-types";

const SECURE_STORAGE_UNAVAILABLE = "A configuração segura do servidor está indisponível. É possível apenas desativar ou remover o token.";

function initialState(): SmsSettingsState {
  return { config: buildDefaultSmsConfig(), token: "", ready: false, loading: false,
    saving: false, testing: false, confirmingRemoval: false, testPhone: "", sendingTest: false, testOutcome: null, error: "", notice: "", connection: null };
}

function connectionResult(value: SmsConnectionResult): SmsConnectionResult | null {
  if (!value || value.valid !== true || !Object.values(SmsEnvironment).includes(value.environment)
    || !Number.isFinite(new Date(value.checkedAt).getTime()) || !value.balance
    || !Number.isFinite(value.balance.credits) || value.balance.credits < 0 || !Number.isFinite(value.balance.sms) || value.balance.sms < 0) return null;
  return { valid: true, environment: value.environment, balance: { credits: value.balance.credits, sms: value.balance.sms }, checkedAt: value.checkedAt };
}

const notSent = (reason: string, detail = ""): SmsTestOutcome => ({ sent: false, reason, detail, providerMessageId: "" });

// The server answers a test send with fixed texts, so what it says is shown as it is; a missing reason is told as unknown.
function testOutcome(answer: SmsTestAnswer): SmsTestOutcome {
  if (answer?.status !== "sent") return notSent(String(answer?.reason || "erro desconhecido"), String(answer?.detail || ""));
  return { sent: true, reason: "", detail: "", providerMessageId: String(answer.providerMessageId || "") };
}

// This controller is private to one mounted municipality/permission context; secrets never enter shared storage. The master manages the
// platform's account, with or without a municipality; the messages of a municipality need one.
export function createSmsSettingsController(client: SmsSettingsApi, municipalityId: string, master: boolean, canManage: boolean) {
  const reachable = canManage && (Boolean(municipalityId) || master);
  let state = { ...initialState(), loading: reachable };
  let revision = 0;
  let mounted = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SmsSettingsState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  const current = (captured: number) => mounted && captured === revision;
  const busy = () => state.loading || state.saving || state.testing || state.sendingTest;
  const allowed = () => mounted && canManage && state.ready && !busy();
  const allowedAccount = () => allowed() && master;
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
  function tokenIssue() {
    const error = validateSmsToken(state.token);
    if (error) publish({ error });
    return Boolean(error);
  }
  // Every change to the platform's account (token, switch, removal) is stored at once and answered with the safe settings.
  async function persist(input: SmsAccountInput, notice: string) {
    const captured = revision;
    publish({ saving: true, error: "", notice: "", connection: null, testOutcome: null });
    try {
      const saved = await client.saveSmsAccount(input, municipalityId);
      if (!current(captured)) return;
      if (!saved || typeof saved !== "object") throw new Error("Missing safe configuration");
      publish({ config: normalizeSmsConfig(saved), token: "", confirmingRemoval: false, connection: null, notice });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível salvar. Verifique o token e as condições de ativação e tente novamente.") });
    } finally { if (current(captured)) publish({ saving: false }); }
  }
  function saveToken() {
    if (!allowedAccount() || !state.token || tokenIssue()) return;
    if (state.config.secureStorageAvailable === false) { publish({ error: SECURE_STORAGE_UNAVAILABLE }); return; }
    return persist({ token: state.token }, "Token salvo.");
  }
  function toggleActive(active: boolean) {
    if (!allowedAccount()) return;
    if (active && !state.config.hasToken) { publish({ error: "Informe um token antes de ativar o SMS." }); return; }
    if (active && state.config.secureStorageAvailable === false) { publish({ error: SECURE_STORAGE_UNAVAILABLE }); return; }
    return persist({ active }, active ? "SMS ativado." : "SMS desativado.");
  }
  function removeToken() {
    if (!allowedAccount()) return;
    return persist({ clearToken: true }, "Token removido e SMS desativado.");
  }
  // A message can only be turned on while the platform's channel is active; the server enforces it too.
  async function setUseActive(use: string, active: boolean) {
    if (!allowedUse() || (active && !state.config.active)) return;
    const captured = revision;
    publish({ saving: true, error: "", notice: "" });
    try {
      const saved = await client.setSmsUseActive(municipalityId, use, active);
      if (!current(captured)) return;
      if (!saved || typeof saved !== "object") throw new Error("Missing safe configuration");
      publish({ config: normalizeSmsConfig(saved) });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível alterar a mensagem. Tente novamente.") });
    } finally { if (current(captured)) publish({ saving: false }); }
  }
  async function testConnection() {
    if (!allowedAccount() || tokenIssue()) return;
    if (!(state.token || state.config.hasToken)) { publish({ error: "Informe um token para testar a conexão." }); return; }
    const captured = revision;
    const input = state.token ? { token: state.token } : {};
    publish({ testing: true, error: "", notice: "", connection: null });
    try {
      const result = connectionResult(await client.testSmsConnection(input));
      if (current(captured)) publish(result ? { connection: result } : { error: "Não foi possível validar a conexão. Confira o token e tente novamente." });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível consultar a conexão e o saldo. Tente novamente.") });
    } finally { if (current(captured)) publish({ testing: false }); }
  }
  // One real SMS to the typed number, through the saved token. "Sent" is the provider taking it; the carrier may still refuse.
  async function sendTest() {
    if (!allowedAccount()) return;
    const phone = state.testPhone.trim();
    if (!phone) { publish({ testOutcome: notSent("Informe um número para o teste.") }); return; }
    if (phone.replace(/\D/g, "").length !== 11) { publish({ testOutcome: notSent("Informe o celular completo, com DDD e o 9: (00) 00000-0000.") }); return; }
    if (!state.config.hasToken) { publish({ testOutcome: notSent("Salve o token antes de enviar um teste.") }); return; }
    const captured = revision;
    publish({ sendingTest: true, testOutcome: null, error: "", notice: "" });
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
    setToken: (token: string) => { if (allowedAccount()) publish({ token, connection: null, error: "", notice: "" }); },
    setConfirmingRemoval: (confirmingRemoval: boolean) => { if (allowedAccount()) publish({ confirmingRemoval }); },
    setTestPhone: (testPhone: string) => { if (allowedAccount()) publish({ testPhone, testOutcome: null }); },
    saveToken, toggleActive, removeToken, setUseActive, testConnection, sendTest,
  };
}
