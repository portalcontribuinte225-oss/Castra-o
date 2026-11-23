import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import { ContractState } from "../../../shared/message-quota-contract.js";
import type { MessageQuotaInput, MessageQuotaStatus } from "./message-contract-types";

const emptySettings = { plan: "", contractStart: "", contractEnd: "" };

const settingsOf = (status: MessageQuotaStatus | null) => ({
  plan: String(status?.plan ?? ""),
  contractStart: status?.contractStart ?? "",
  contractEnd: status?.contractEnd ?? "",
});

const messageOf = (error: unknown) => (error instanceof ApiError && error.message ? error.message : "tente novamente.");

const contractStates: readonly string[] = Object.values(ContractState);

// A valid monthly limit is a whole number above zero; anything else answers 0.
function planOf(value: string) {
  const plan = Number(value);
  return Number.isSafeInteger(plan) && plan > 0 ? plan : 0;
}

// What the switch saves. On: the form as typed (a plan of 0 means the limit is not valid). Off: the stored contract as it is, or
// nothing when there is none.
export function contractInput(enabled: boolean, settings: typeof emptySettings, live: MessageQuotaStatus | null | undefined): MessageQuotaInput | null {
  if (enabled) return { plan: planOf(settings.plan), contractStart: settings.contractStart, contractEnd: settings.contractEnd, enabled };
  return live ? { plan: live.plan, contractStart: live.contractStart || "", contractEnd: live.contractEnd || "", enabled } : null;
}

// The monthly contract of one channel for one municipality: where it stands, the month's usage and the form the master edits. Its
// switch is the only on/off of the channel: turning it on saves the form, turning it off keeps the stored limit and dates.
export function useMessageContract(channel: string, municipalityId: string) {
  const [settings, setSettings] = useState(emptySettings);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [status, setStatus] = useState<MessageQuotaStatus | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadedScope, setLoadedScope] = useState("");
  const [failedScope, setFailedScope] = useState("");
  const [saving, setSaving] = useState(false);
  const scope = `${channel}:${municipalityId}`;
  const activeScope = useRef(scope);
  const revision = useRef(0);
  activeScope.current = scope;
  const current = (captured: number) => revision.current === captured && activeScope.current === scope;
  const ready = Boolean(municipalityId) && loadedScope === scope;
  const loadFailed = Boolean(municipalityId) && failedScope === scope;
  const live = ready ? status : undefined;
  // A stored contract is on unless the master switched it off; its form stays locked while it is on.
  const contractOn = Boolean(live) && live?.state !== ContractState.OFF;
  const canTurnOn = planOf(settings.plan) > 0;

  function report(message: string, ok = false) {
    setSaveStatus(message);
    setSaveOk(ok);
  }

  function retry() {
    setFailedScope("");
    setAttempt((previous) => previous + 1);
  }

  useEffect(() => {
    const captured = ++revision.current;
    setLoadedScope("");
    setFailedScope("");
    setSaving(false);
    report("");
    setSettings(emptySettings);
    setStatus(null);
    if (!municipalityId) return;
    api.getMessageQuota(channel, municipalityId).then((loaded) => {
      if (!current(captured)) return;
      if (loaded !== null && !contractStates.includes(loaded?.state)) throw new Error("Incomplete message quota");
      setStatus(loaded);
      setSettings(settingsOf(loaded));
      setLoadedScope(scope);
    }).catch(() => {
      if (current(captured)) setFailedScope(scope);
    });
    return () => { revision.current += 1; };
  }, [scope, attempt]);

  async function setActive(enabled: boolean) {
    if (!ready || saving) return;
    const input = contractInput(enabled, settings, live);
    if (!input?.plan) {
      report("Informe um limite mensal válido.");
      return;
    }
    const captured = revision.current;
    setSaving(true);
    report("Salvando...");
    try {
      const saved = await api.saveMessageQuota(channel, municipalityId, input);
      if (!current(captured)) return;
      setStatus(saved);
      setSettings(settingsOf(saved));
      report(enabled ? "Contrato ativado." : "Contrato desativado.", true);
    } catch (error) {
      if (current(captured)) report(`Não foi possível salvar: ${messageOf(error)}`);
    } finally {
      if (current(captured)) setSaving(false);
    }
  }

  return { settings, setSettings, ready, loadFailed, retry, saving, saveStatus, saveOk, live, contractOn, canTurnOn, setActive };
}

export type MessageContract = ReturnType<typeof useMessageContract>;
