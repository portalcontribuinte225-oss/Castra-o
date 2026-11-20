import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS, initialWhatsappSettings } from "../../domain";
import type { AnyRecord } from "../../types";

const savedIdsOf = (source: AnyRecord) => ({ wabaId: String(source.wabaId || ""), phoneNumberId: String(source.phoneNumberId || "") });

// Credentials, the "active" switch and the connection test of one municipality.
export function useWhatsappCredentials(municipalityId: string) {
  const [settings, setSettings] = useState<AnyRecord>(initialWhatsappSettings);
  // The account and number ids as stored, to know when the screen holds something not saved yet.
  const [savedIds, setSavedIds] = useState(savedIdsOf(initialWhatsappSettings));
  const [attempt, setAttempt] = useState(0);
  const [loadedId, setLoadedId] = useState("");
  const [failedId, setFailedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [testPhone, setTestPhoneValue] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const activeScope = useRef(municipalityId);
  const revision = useRef(0);
  activeScope.current = municipalityId;
  const current = (captured: number) => revision.current === captured && activeScope.current === municipalityId;
  const ready = Boolean(municipalityId) && loadedId === municipalityId;
  const loadFailed = Boolean(municipalityId) && failedId === municipalityId;

  function retry() {
    setFailedId("");
    setAttempt((previous) => previous + 1);
  }

  function apply(value: AnyRecord) {
    setSettings({ ...initialWhatsappSettings, ...value, accessToken: "" });
    setSavedIds(savedIdsOf(value));
  }

  useEffect(() => {
    const captured = ++revision.current;
    setLoadedId("");
    setFailedId("");
    setSaving(false);
    setTesting(false);
    apply({});
    setSaveStatus(municipalityId ? "" : "Selecione um município para configurar o WhatsApp.");
    setTestPhoneValue("");
    setTestStatus("");
    setConfirmingRemoval(false);
    if (!municipalityId) return;
    api.getConfig(CONFIG_KEYS.whatsapp, municipalityId).then((whatsapp) => {
      if (!current(captured)) return;
      if (whatsapp !== null && (typeof whatsapp?.hasAccessToken !== "boolean"
        || typeof whatsapp.wabaId !== "string" || typeof whatsapp.phoneNumberId !== "string")) {
        throw new Error("Incomplete WhatsApp settings");
      }
      apply(whatsapp || {});
      setLoadedId(municipalityId);
    }).catch(() => {
      if (current(captured)) setFailedId(municipalityId);
    });
    return () => { revision.current += 1; };
  }, [municipalityId, attempt]);

  const hasToken = Boolean(settings.accessToken || settings.hasAccessToken);
  const hasCredentials = hasToken && Boolean(settings.phoneNumberId);
  const isActive = ready && hasCredentials && settings.active !== false;
  // The catalog can only be read from Meta with the token and the account id.
  const canSync = ready && hasToken && Boolean(settings.wabaId);
  const idsChanged = settings.wabaId !== savedIds.wabaId || settings.phoneNumberId !== savedIds.phoneNumberId;

  async function persist(input: AnyRecord, pending: string, done: string, onSaved: (value: AnyRecord) => void) {
    if (!ready || saving) return;
    const captured = revision.current;
    setSaving(true);
    setSaveStatus(pending);
    try {
      const saved = await api.setConfig(CONFIG_KEYS.whatsapp, input, municipalityId);
      if (!current(captured)) return;
      if (!saved?.value) throw new Error("Configuração indisponível.");
      onSaved(saved.value);
      setSaveStatus(done);
    } catch (error) {
      if (current(captured)) setSaveStatus(`Não foi possível salvar: ${error instanceof Error ? error.message : "tente novamente."}`);
    } finally {
      if (current(captured)) setSaving(false);
    }
  }

  function save() {
    return persist({
      active: hasCredentials && settings.active !== false,
      ...(settings.phoneNumberId !== savedIds.phoneNumberId ? { phoneNumberId: settings.phoneNumberId } : {}),
      ...(settings.wabaId !== savedIds.wabaId ? { wabaId: settings.wabaId } : {}),
      ...(settings.accessToken ? { accessToken: settings.accessToken } : {}),
    }, "Salvando configuração...", "Configuração salva com sucesso.", apply);
  }

  // With a token saved the switch is stored at once, so it is still there after reloading the page.
  function toggleActive(checked: boolean) {
    if (!ready || saving) return;
    if (!settings.hasAccessToken) {
      setSettings((previous) => ({ ...previous, active: checked }));
      return;
    }
    return persist(
      { active: checked },
      checked ? "Ativando..." : "Desativando...",
      checked ? "WhatsApp ativado com sucesso." : "WhatsApp desativado com sucesso.",
      (value) => setSettings((previous) => ({ ...previous, active: Boolean(value.active) })),
    );
  }

  // Removing the token also turns the channel off on the server.
  function removeToken() {
    return persist({ clearAccessToken: true }, "Removendo token...", "Token removido com sucesso. O WhatsApp foi desativado.", (value) => {
      apply(value);
      setConfirmingRemoval(false);
    });
  }

  async function sendTest() {
    if (!ready || saving || testing) return;
    if (!testPhone.trim()) { setTestStatus("Informe um número para o teste."); return; }
    const captured = revision.current;
    setTesting(true);
    setTestStatus("Enviando...");
    try {
      const result = await api.sendWhatsappTest(municipalityId, testPhone.trim());
      if (!current(captured)) return;
      if (result.status === "sent") setTestStatus("Mensagem de teste enviada com sucesso!");
      else setTestStatus(`Não enviado: ${result.reason || "erro desconhecido"}`);
    } catch (error) {
      if (current(captured)) setTestStatus(`Erro: ${error instanceof Error ? error.message : "tente novamente."}`);
    } finally {
      if (current(captured)) setTesting(false);
    }
  }

  function setTestPhone(value: string) {
    setTestPhoneValue(value);
    setTestStatus("");
  }

  return {
    settings, setSettings, ready, loadFailed, retry, saving, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, isActive, canSync, idsChanged,
    confirmingRemoval, setConfirmingRemoval, save, toggleActive, removeToken, sendTest,
  };
}
