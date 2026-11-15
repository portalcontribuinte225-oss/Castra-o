import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS, initialWhatsappSettings } from "../../domain";
import type { AnyRecord } from "../../types";

// Credentials, the "active" switch and the connection test of one municipality.
export function useWhatsappCredentials(municipalityId: string) {
  const [settings, setSettings] = useState<AnyRecord>(initialWhatsappSettings);
  const [saveStatus, setSaveStatus] = useState("");
  const [testPhone, setTestPhoneValue] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setTestPhoneValue("");
    setTestStatus("");
    if (!municipalityId) {
      setSettings(initialWhatsappSettings);
      setSaveStatus("Selecione um município para configurar o WhatsApp.");
      return;
    }
    let cancelled = false;
    setSaveStatus("Carregando configuração...");
    api.getConfig(CONFIG_KEYS.whatsapp, municipalityId).catch(() => null).then((whatsapp) => {
      if (cancelled) return;
      setSettings({ ...initialWhatsappSettings, ...(whatsapp || {}) });
      setSaveStatus("");
    });
    return () => { cancelled = true; };
  }, [municipalityId]);

  const hasToken = Boolean(settings.accessToken || settings.hasAccessToken);
  const hasCredentials = hasToken && Boolean(settings.phoneNumberId);
  const isActive = hasCredentials && settings.active !== false;
  // The catalog can only be read from Meta with the token and the account id.
  const canSync = hasToken && Boolean(settings.wabaId);

  async function save() {
    if (!municipalityId) {
      setSaveStatus("Selecione um município antes de salvar.");
      return;
    }
    const nextSettings = {
      ...settings,
      // Ativa automaticamente quando credenciais estão preenchidas; só salva false se explicitamente desativado pelo toggle
      active: hasCredentials ? (settings.active !== false) : false,
      provider: settings.provider || "cloud_api",
      phoneNumberId: settings.phoneNumberId || "",
      wabaId: settings.wabaId || "",
      accessToken: settings.accessToken || "",
    };
    setSaveStatus("Salvando configuração...");
    try {
      const saved = await api.setConfig(CONFIG_KEYS.whatsapp, nextSettings, municipalityId);
      setSettings({
        ...nextSettings,
        ...(saved?.value || {}),
        accessToken: "",
        hasAccessToken: Boolean(saved?.value?.hasAccessToken || nextSettings.accessToken || settings.hasAccessToken),
      });
      setSaveStatus("Configuração salva com sucesso.");
    } catch (err) {
      setSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) { setTestStatus("Informe um número para o teste."); return; }
    setTesting(true);
    setTestStatus("Enviando...");
    try {
      const result = await api.sendWhatsappTest(municipalityId, testPhone.trim());
      if (result.status === "sent") setTestStatus("Mensagem de teste enviada com sucesso!");
      else setTestStatus(`Não enviado: ${result.reason || "erro desconhecido"}`);
    } catch (err) {
      setTestStatus(`Erro: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  function setTestPhone(value: string) {
    setTestPhoneValue(value);
    setTestStatus("");
  }

  return { settings, setSettings, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, isActive, canSync, save, sendTest };
}
