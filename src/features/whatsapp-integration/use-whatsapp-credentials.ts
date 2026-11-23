import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS, initialWhatsappSettings } from "../../domain";
import type { AnyRecord } from "../../types";

// The ids and the chosen key as stored, to know when the screen holds something not saved yet.
const savedFieldsOf = (source: AnyRecord) => ({
  wabaId: String(source.wabaId || ""),
  phoneNumberId: String(source.phoneNumberId || ""),
  tokenVariable: String(source.tokenVariable || ""),
});

// What the server answers about the municipality's WhatsApp: everyone gets whether the chosen key is in the server; the master also
// the ids and the key names. No part of a token ever arrives.
function isWhatsappView(value: AnyRecord | null, master: boolean) {
  if (value === null) return true;
  if (typeof value?.integrated !== "boolean") return false;
  return !master || (typeof value.wabaId === "string" && typeof value.phoneNumberId === "string" && Array.isArray(value.tokenVariables));
}

// The ids, the chosen key and the send test of one municipality. The token itself lives in the server's variables: the screen only
// chooses which one the municipality uses, and choosing none takes WhatsApp out of use.
export function useWhatsappCredentials(municipalityId: string, master: boolean) {
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
      if (!isWhatsappView(whatsapp, master)) throw new Error("Incomplete WhatsApp settings");
      apply(whatsapp || {});
      setLoadedId(municipalityId);
    }).catch(() => {
      if (current(captured)) setFailedId(municipalityId);
    });
    return () => { revision.current += 1; };
  }, [municipalityId, master, attempt]);

  const integrated = Boolean(settings.integrated);
  const hasCredentials = integrated && Boolean(settings.phoneNumberId);
  // The catalog can only be read from Meta with the token and the account id.
  const canSync = ready && integrated && Boolean(settings.wabaId);
  const changed = (Object.keys(saved) as (keyof typeof saved)[]).some((name) => String(settings[name] || "") !== saved[name]);

  // Sends only what changed; choosing no key takes the channel out of use on the server.
  async function save() {
    if (!ready || saving) return;
    const input = Object.fromEntries((Object.keys(saved) as (keyof typeof saved)[])
      .filter((name) => String(settings[name] || "") !== saved[name])
      .map((name) => [name, String(settings[name] || "")]));
    const captured = revision.current;
    setSaving(true);
    setSaveStatus("Salvando configuração...");
    try {
      const stored = await api.setConfig(CONFIG_KEYS.whatsapp, input, municipalityId);
      if (!current(captured)) return;
      if (!stored?.value) throw new Error("Configuração indisponível.");
      apply(stored.value);
      setSaveStatus("Configuração salva com sucesso.");
    } catch (error) {
      if (current(captured)) setSaveStatus(`Não foi possível salvar: ${error instanceof Error ? error.message : "tente novamente."}`);
    } finally {
      if (current(captured)) setSaving(false);
    }
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
    settings, setSettings, ready, loadFailed, retry, saving, saveStatus, testPhone, setTestPhone, testStatus, testing, integrated, hasCredentials, canSync,
    changed, save, sendTest,
  };
}
