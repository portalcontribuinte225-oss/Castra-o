import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS, initialWhatsappSettings } from "../../domain";
import type { AnyRecord } from "../../types";

// The ids and the token variable as stored, to know when the screen holds something not saved yet.
const savedFieldsOf = (source: AnyRecord) => ({
  wabaId: String(source.wabaId || ""),
  phoneNumberId: String(source.phoneNumberId || ""),
  tokenVariable: String(source.tokenVariable || ""),
});

// Credentials, the "active" switch and the connection test of one municipality. The token itself lives in the server's variables:
// the screen only chooses which one the municipality uses.
export function useWhatsappCredentials(municipalityId: string) {
  const [settings, setSettings] = useState<AnyRecord>(initialWhatsappSettings);
  const [saved, setSaved] = useState(savedFieldsOf(initialWhatsappSettings));
  const [attempt, setAttempt] = useState(0);
  const [loadedId, setLoadedId] = useState("");
  const [failedId, setFailedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [testPhone, setTestPhoneValue] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testing, setTesting] = useState(false);
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
    setSettings({ ...initialWhatsappSettings, ...value });
    setSaved(savedFieldsOf(value));
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

  const hasToken = Boolean(settings.hasAccessToken);
  const hasCredentials = hasToken && Boolean(settings.phoneNumberId);
  const isActive = ready && hasCredentials && settings.active !== false;
  // The catalog can only be read from Meta with the token and the account id.
  const canSync = ready && hasToken && Boolean(settings.wabaId);
  const changed = (Object.keys(saved) as (keyof typeof saved)[]).some((name) => String(settings[name] || "") !== saved[name]);

  async function persist(input: AnyRecord, pending: string, done: string, onSaved: (value: AnyRecord) => void) {
    if (!ready || saving) return;
    const captured = revision.current;
    setSaving(true);
    setSaveStatus(pending);
    try {
      const stored = await api.setConfig(CONFIG_KEYS.whatsapp, input, municipalityId);
      if (!current(captured)) return;
      if (!stored?.value) throw new Error("Configuração indisponível.");
      onSaved(stored.value);
      setSaveStatus(done);
    } catch (error) {
      if (current(captured)) setSaveStatus(`Não foi possível salvar: ${error instanceof Error ? error.message : "tente novamente."}`);
    } finally {
      if (current(captured)) setSaving(false);
    }
  }

  // Sends only what changed; choosing no variable turns the channel off on the server.
  function save() {
    const input = Object.fromEntries((Object.keys(saved) as (keyof typeof saved)[])
      .filter((name) => String(settings[name] || "") !== saved[name])
      .map((name) => [name, String(settings[name] || "")]));
    return persist(input, "Salvando configuração...", "Configuração salva com sucesso.", apply);
  }

  // The switch is stored at once. Turning it on needs a saved variable that holds a token.
  function toggleActive(checked: boolean) {
    if (!ready || saving) return;
    if (checked && !hasToken) {
      setSaveStatus("Escolha e salve a variável do token antes de ativar o WhatsApp.");
      return;
    }
    return persist(
      { active: checked },
      checked ? "Ativando..." : "Desativando...",
      checked ? "WhatsApp ativado com sucesso." : "WhatsApp desativado com sucesso.",
      (value) => setSettings((previous) => ({ ...previous, active: Boolean(value.active) })),
    );
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
    settings, setSettings, ready, loadFailed, retry, saving, saveStatus, testPhone, setTestPhone, testStatus, testing, hasCredentials, isActive, canSync, changed,
    savedTokenVariable: saved.tokenVariable, save, toggleActive, sendTest,
  };
}
