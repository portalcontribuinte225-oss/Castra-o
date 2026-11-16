import { useEffect, useState } from "react";
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
  const [live, setLive] = useState<MessageQuotaStatus | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  useEffect(() => {
    setConfirmingEnd(false);
    setSaveStatus("");
    if (!municipalityId) {
      setSettings(emptySettings);
      setLive(null);
      return;
    }
    let cancelled = false;
    api.getMessageQuota(channel, municipalityId).catch(() => null).then((status) => {
      if (cancelled) return;
      setLive(status);
      setSettings(settingsOf(status));
    });
    return () => { cancelled = true; };
  }, [channel, municipalityId]);

  async function persist(input: MessageQuotaInput, done: string) {
    setSaveStatus("Salvando...");
    try {
      const status = await api.saveMessageQuota(channel, municipalityId, input);
      setLive(status);
      setSettings(settingsOf(status));
      setConfirmingEnd(false);
      setSaveStatus(done);
    } catch (error) {
      setSaveStatus(`Não foi possível salvar: ${messageOf(error)}`);
    }
  }

  async function save() {
    if (!municipalityId) {
      setSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    const plan = Number(settings.plan);
    if (!Number.isSafeInteger(plan) || plan <= 0) {
      setSaveStatus("Informe um limite mensal válido.");
      return;
    }
    await persist({ plan, contractStart: settings.contractStart, contractEnd: settings.contractEnd }, "Cota salva com sucesso.");
  }

  async function endContractToday() {
    if (!municipalityId) return;
    await persist({ plan: Number(settings.plan), contractStart: settings.contractStart, contractEnd: localToday() }, "Contrato encerrado hoje.");
  }

  async function resetUsed() {
    if (!municipalityId) return;
    try {
      setLive(await api.resetMessageQuota(channel, municipalityId));
      setSaveStatus("Cota do mês zerada.");
    } catch (error) {
      setSaveStatus(`Erro ao zerar cota: ${messageOf(error)}`);
    }
  }

  return { settings, setSettings, saveStatus, live, confirmingEnd, setConfirmingEnd, save, endContractToday, resetUsed };
}

export type MessageContract = ReturnType<typeof useMessageContract>;
