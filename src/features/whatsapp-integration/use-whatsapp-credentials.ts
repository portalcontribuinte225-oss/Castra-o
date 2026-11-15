import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS, initialWhatsappSettings } from "../../domain";
import type { AnyRecord } from "../../types";

const savedIdsOf = (source: AnyRecord) => ({ wabaId: String(source.wabaId || ""), phoneNumberId: String(source.phoneNumberId || "") });

// Credentials, the "active" switch and the connection test of one municipality.
export function useWhatsappCredentials(municipalityId: string) {
  const [settings, setSettings] = useState<AnyRecord>(initialWhatsappSettings);
  // The account and number ids as stored, to know when the screen holds something not saved yet.
  const [savedIds, setSavedIds] = useState(savedIdsOf(initialWhatsappSettings));
  const [saveStatus, setSaveStatus] = useState("");
  const [testPhone, setTestPhoneValue] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => {
    setTestPhoneValue("");
    setTestStatus("");
    setConfirmingRemoval(false);
    if (!municipalityId) {
      setSettings(initialWhatsappSettings);
      setSavedIds(savedIdsOf(initialWhatsappSettings));
      setSaveStatus("Selecione um município para configurar o WhatsApp.");
      return;
    }
    let cancelled = false;
    setSaveStatus("Carregando configuração...");
    api.getConfig(CONFIG_KEYS.whatsapp, municipalityId).catch(() => null).then((whatsapp) => {
      if (cancelled) return;
      setSettings({ ...initialWhatsappSettings, ...(whatsapp || {}) });
      setSavedIds(savedIdsOf(whatsapp || {}));
      setSaveStatus("");
    });
    return () => { cancelled = true; };
  }, [municipalityId]);

  const hasToken = Boolean(settings.accessToken || settings.hasAccessToken);
  const hasCredentials = hasToken && Boolean(settings.phoneNumberId);
  const isActive = hasCredentials && settings.active !== false;
  // The catalog can only be read from Meta with the token and the account id.
  const canSync = hasToken && Boolean(settings.wabaId);
  const idsChanged = settings.wabaId !== savedIds.wabaId || settings.phoneNumberId !== savedIds.phoneNumberId;

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
      setSavedIds(savedIdsOf({ ...nextSettings, ...(saved?.value || {}) }));
      setSaveStatus("Configuração salva com sucesso.");
    } catch (err) {
      setSaveStatus(`Não foi possível salvar: ${err.message}`);
    }
  }

  // With a token saved the switch is stored at once, so it is still there after reloading the page.
  async function toggleActive(checked: boolean) {
    const previous = Boolean(settings.active);
    setSettings((current) => ({ ...current, active: checked }));
    if (!municipalityId || !settings.hasAccessToken) return;
    setSaveStatus(checked ? "Ativando..." : "Desativando...");
    try {
      const saved = await api.setConfig(CONFIG_KEYS.whatsapp, { provider: settings.provider || "cloud_api", ...savedIds, active: checked }, municipalityId);
      setSettings((current) => ({ ...current, active: Boolean(saved?.value?.active) }));
      setSaveStatus(checked ? "WhatsApp ativado com sucesso." : "WhatsApp desativado com sucesso.");
    } catch (err) {
      setSettings((current) => ({ ...current, active: previous }));
      setSaveStatus(`Não foi possível alterar: ${err.message}`);
    }
  }

  // Removing the token also turns the channel off on the server.
  async function removeToken() {
    if (!municipalityId) return;
    setSaveStatus("Removendo token...");
    try {
      const saved = await api.setConfig(CONFIG_KEYS.whatsapp, { ...settings, accessToken: "", clearAccessToken: true }, municipalityId);
      setSettings({ ...initialWhatsappSettings, ...(saved?.value || {}), accessToken: "" });
      setSavedIds(savedIdsOf(saved?.value || {}));
      setConfirmingRemoval(false);
      setSaveStatus("Token removido com sucesso. O WhatsApp foi desativado.");
    } catch (err) {
      setSaveStatus(`Não foi possível remover o token: ${err.message}`);
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

  return {
    settings, setSettings, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, isActive, canSync, idsChanged,
    confirmingRemoval, setConfirmingRemoval, save, toggleActive, removeToken, sendTest,
  };
}
