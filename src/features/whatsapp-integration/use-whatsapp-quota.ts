import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS } from "../../domain";
import type { AnyRecord } from "../../types";

const initialQuotaSettings = { plan: "", contractStart: "", contractEnd: "" };

// Contract and monthly quota of one municipality, plus the live usage shown in the status bar.
export function useWhatsappQuota(municipalityId: string) {
  const [settings, setSettings] = useState(initialQuotaSettings);
  const [saveStatus, setSaveStatus] = useState("");
  const [live, setLive] = useState<AnyRecord | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  useEffect(() => {
    setConfirmingEnd(false);
    if (!municipalityId) {
      setSettings(initialQuotaSettings);
      setSaveStatus("");
      setLive(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.getConfig(CONFIG_KEYS.whatsappQuota, municipalityId).catch(() => null),
      api.getWhatsappQuotaStatus(municipalityId).catch(() => null),
    ]).then(([quota, quotaLive]) => {
      if (cancelled) return;
      setSettings({
        plan: String(quota?.plan ?? ""),
        contractStart: quota?.contractStart ?? "",
        contractEnd: quota?.contractEnd ?? "",
      });
      setSaveStatus("");
      setLive(quotaLive);
    });
    return () => { cancelled = true; };
  }, [municipalityId]);

  const refreshLive = () => api.getWhatsappQuotaStatus(municipalityId).then(setLive).catch(() => {});

  async function save() {
    if (!municipalityId) {
      setSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    if (!settings.plan || Number(settings.plan) <= 0) {
      setSaveStatus("Informe um limite mensal válido.");
      return;
    }
    setSaveStatus("Salvando...");
    try {
      await api.setConfig(CONFIG_KEYS.whatsappQuota, {
        plan: Number(settings.plan),
        contractStart: settings.contractStart || "",
        contractEnd: settings.contractEnd || "",
      }, municipalityId);
      setSaveStatus("Cota salva com sucesso.");
      refreshLive();
    } catch (err) {
      setSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  async function endContractToday() {
    if (!municipalityId) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.setConfig(CONFIG_KEYS.whatsappQuota, {
        plan: Number(settings.plan),
        contractStart: settings.contractStart || "",
        contractEnd: today,
      }, municipalityId);
      setSettings((current) => ({ ...current, contractEnd: today }));
      setConfirmingEnd(false);
      setSaveStatus("Contrato encerrado hoje.");
      refreshLive();
    } catch (err) {
      setSaveStatus(`Erro ao encerrar contrato: ${err.message}`);
    }
  }

  async function resetUsed() {
    if (!municipalityId) return;
    try {
      await api.resetWhatsappQuota(municipalityId);
      setSaveStatus("Cota do mês zerada.");
      refreshLive();
    } catch (err) {
      setSaveStatus(`Erro ao zerar cota: ${err.message}`);
    }
  }

  return { settings, setSettings, saveStatus, live, confirmingEnd, setConfirmingEnd, save, endContractToday, resetUsed };
}
