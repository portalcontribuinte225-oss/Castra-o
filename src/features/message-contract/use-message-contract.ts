import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import type { MessageQuotaInput, MessageQuotaStatus } from "./message-contract-types";

const emptySettings = { plan: "", contractStart: "", contractEnd: "" };

const settingsOf = (status: MessageQuotaStatus | null) => ({
  plan: String(status?.plan ?? ""),
  contractStart: status?.contractStart ?? "",
  contractEnd: status?.contractEnd ?? "",
});

const messageOf = (error: unknown) => (error instanceof ApiError && error.message ? error.message : "tente novamente.");

// Today in the user's own calendar, the date the confirmation of "end the contract" shows.
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// The monthly contract of one channel for one municipality: the live usage the screen counts, and the form the global administration edits.
export function useMessageContract(channel: string, municipalityId: string) {
  const [settings, setSettings] = useState(emptySettings);
  const [saveStatus, setSaveStatus] = useState("");
  const [status, setStatus] = useState<MessageQuotaStatus | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
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

  function retry() {
    setFailedScope("");
    setAttempt((previous) => previous + 1);
  }

  useEffect(() => {
    const captured = ++revision.current;
    setLoadedScope("");
    setFailedScope("");
    setSaving(false);
    setConfirmingEnd(false);
    setSaveStatus("");
    setSettings(emptySettings);
    setStatus(null);
    if (!municipalityId) return;
    api.getMessageQuota(channel, municipalityId).then((loaded) => {
      if (!current(captured)) return;
      if (loaded !== null && typeof loaded?.active !== "boolean") throw new Error("Incomplete message quota");
      setStatus(loaded);
      setSettings(settingsOf(loaded));
      setLoadedScope(scope);
    }).catch(() => {
      if (current(captured)) setFailedScope(scope);
    });
    return () => { revision.current += 1; };
  }, [scope, attempt]);

  async function persist(
    request: () => Promise<MessageQuotaStatus | null>,
    done: string,
    failure: string,
    refreshForm = false,
  ) {
    if (!ready || saving) return;
    const captured = revision.current;
    setSaving(true);
    setSaveStatus("Salvando...");
    try {
      const saved = await request();
      if (!current(captured)) return;
      setStatus(saved);
      if (refreshForm) {
        setSettings(settingsOf(saved));
        setConfirmingEnd(false);
      }
      setSaveStatus(done);
    } catch (error) {
      if (current(captured)) setSaveStatus(`${failure}: ${messageOf(error)}`);
    } finally {
      if (current(captured)) setSaving(false);
    }
  }

  function saveQuota(input: MessageQuotaInput, done: string) {
    return persist(() => api.saveMessageQuota(channel, municipalityId, input), done, "Não foi possível salvar", true);
  }

  function save() {
    if (!ready || saving) return;
    const plan = Number(settings.plan);
    if (!Number.isSafeInteger(plan) || plan <= 0) {
      setSaveStatus("Informe um limite mensal válido.");
      return;
    }
    return saveQuota({ plan, contractStart: settings.contractStart, contractEnd: settings.contractEnd }, "Cota salva com sucesso.");
  }

  function endContractToday() {
    return saveQuota({ plan: Number(settings.plan), contractStart: settings.contractStart, contractEnd: localToday() }, "Contrato encerrado hoje.");
  }

  // The service of SMS or e-mail for the municipality, on or off; only the platform's administrator may.
  function setEnabled(enabled: boolean) {
    return persist(() => api.setMessageService(channel, municipalityId, enabled),
      enabled ? "Serviço ativado." : "Serviço desativado.", "Não foi possível alterar o serviço");
  }

  function resetUsed() {
    return persist(() => api.resetMessageQuota(channel, municipalityId), "Cota do mês zerada.", "Erro ao zerar cota");
  }

  return { settings, setSettings, ready, loadFailed, retry, saving, saveStatus, live, confirmingEnd, setConfirmingEnd, save, endContractToday, resetUsed, setEnabled };
}

export type MessageContract = ReturnType<typeof useMessageContract>;
