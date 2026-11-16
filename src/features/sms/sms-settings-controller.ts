import { buildDefaultSmsConfig, normalizeSmsConfig, SMS_CONFIG_KEY, SmsEnvironment, validateSmsToken } from "../../../shared/sms-contract.js";
import type { SmsConnectionResult, SmsSettingsApi, SmsSettingsState } from "./sms-types";

const SECURE_STORAGE_UNAVAILABLE = "A configuração segura do servidor está indisponível. É possível apenas desativar ou remover o token.";

function initialState(): SmsSettingsState {
  return { config: buildDefaultSmsConfig(), token: "", ready: false, loading: false,
    saving: false, testing: false, confirmingRemoval: false, error: "", notice: "", connection: null };
}

function connectionResult(value: SmsConnectionResult): SmsConnectionResult | null {
  if (!value || value.valid !== true || !Object.values(SmsEnvironment).includes(value.environment)
    || !Number.isFinite(new Date(value.checkedAt).getTime()) || !value.balance
    || !Number.isFinite(value.balance.credits) || value.balance.credits < 0 || !Number.isFinite(value.balance.sms) || value.balance.sms < 0) return null;
  return { valid: true, environment: value.environment, balance: { credits: value.balance.credits, sms: value.balance.sms }, checkedAt: value.checkedAt };
}

// This controller is private to one mounted municipality/permission context; secrets never enter shared storage.
export function createSmsSettingsController(client: SmsSettingsApi, municipalityId: string, canManage: boolean) {
  let state = { ...initialState(), loading: canManage && Boolean(municipalityId) };
  let revision = 0;
  let mounted = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SmsSettingsState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  const current = (captured: number) => mounted && captured === revision;
  const busy = () => state.loading || state.saving || state.testing;
  const allowed = () => mounted && canManage && Boolean(municipalityId) && state.ready && !busy();
  const failure = (error: unknown, message: string) => {
    const status = error && typeof error === "object" && "status" in error ? error.status : null;
    return status === 401 || status === 403 ? "Sem permissão para configurar o SMS deste município." : message;
  };
  async function load() {
    const captured = ++revision;
    mounted = true;
    publish(initialState());
    if (!canManage || !municipalityId) return;
    publish({ loading: true });
    try {
      const config = normalizeSmsConfig(await client.getConfig(SMS_CONFIG_KEY, municipalityId));
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
  // Every change to the channel (token, switch, removal) is stored at once and answered with the safe settings.
  async function persist(input: { active?: boolean; token?: string; clearToken?: boolean }, notice: string) {
    const captured = revision;
    publish({ saving: true, error: "", notice: "", connection: null });
    try {
      const saved = await client.setConfig(SMS_CONFIG_KEY, input, municipalityId);
      if (!current(captured)) return;
      if (!saved || saved.value === undefined) throw new Error("Missing safe configuration");
      publish({ config: normalizeSmsConfig(saved.value), token: "", confirmingRemoval: false, connection: null, notice });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível salvar. Verifique o token e as condições de ativação e tente novamente.") });
    } finally { if (current(captured)) publish({ saving: false }); }
  }
  function saveToken() {
    if (!allowed() || !state.token || tokenIssue()) return;
    if (state.config.secureStorageAvailable === false) { publish({ error: SECURE_STORAGE_UNAVAILABLE }); return; }
    return persist({ token: state.token }, "Token salvo.");
  }
  function toggleActive(active: boolean) {
    if (!allowed()) return;
    if (active && !state.config.hasToken) { publish({ error: "Informe um token antes de ativar o SMS." }); return; }
    if (active && state.config.secureStorageAvailable === false) { publish({ error: SECURE_STORAGE_UNAVAILABLE }); return; }
    return persist({ active }, active ? "SMS ativado." : "SMS desativado.");
  }
  function removeToken() {
    if (!allowed()) return;
    return persist({ clearToken: true }, "Token removido e SMS desativado.");
  }
  // A message can only be turned on while the channel is active; the server enforces it too.
  async function setUseActive(use: string, active: boolean) {
    if (!allowed() || (active && !state.config.active)) return;
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
    if (!allowed() || tokenIssue()) return;
    if (!(state.token || state.config.hasToken)) { publish({ error: "Informe um token para testar a conexão." }); return; }
    const captured = revision;
    const input = { municipalityId, ...(state.token ? { token: state.token } : {}) };
    publish({ testing: true, error: "", notice: "", connection: null });
    try {
      const result = connectionResult(await client.testSmsConnection(input));
      if (current(captured)) publish(result ? { connection: result } : { error: "Não foi possível validar a conexão. Confira o token e tente novamente." });
    } catch (error) {
      if (current(captured)) publish({ error: failure(error, "Não foi possível consultar a conexão e o saldo. Tente novamente.") });
    } finally { if (current(captured)) publish({ testing: false }); }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    cancel: () => { mounted = false; revision++; publish(initialState()); },
    setToken: (token: string) => { if (allowed()) publish({ token, connection: null, error: "", notice: "" }); },
    setConfirmingRemoval: (confirmingRemoval: boolean) => { if (allowed()) publish({ confirmingRemoval }); },
    saveToken, toggleActive, removeToken, setUseActive, testConnection,
  };
}
