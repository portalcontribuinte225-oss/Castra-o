import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import type { EmailSettings, EmailUseRow } from "./email-integration-types";

// Only messages the server wrote are shown; anything else (network, malformed response) gets the fallback.
function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

// The e-mail screen of one scope: the municipality when there is one, the platform alone for the master without it.
export function useEmailSettings(municipalityId: string, master: boolean, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeId = useRef(municipalityId);
  activeId.current = municipalityId;
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const reachable = enabled && (Boolean(municipalityId) || master);

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    setDrafts({});
    setError("");
    setNotice("");
    if (!reachable) return;
    setLoading(true);
    api.getEmailSettings(municipalityId).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    }).catch((failure) => {
      if (!cancelled) setError(messageOf(failure, "Não foi possível carregar a integração de e-mail."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, reachable, attempt]);

  // The server answers every save with the whole screen, so the table never drifts from what is stored.
  const apply = useCallback((next: EmailSettings) => setSettings(next), []);

  const savedId = (row: EmailUseRow) => row.templateId || "";
  const changedIds = Object.fromEntries((settings?.uses || [])
    .filter((row) => drafts[row.key] !== undefined && drafts[row.key].trim() !== savedId(row))
    .map((row) => [row.key, drafts[row.key].trim()]));
  const dirty = Object.keys(changedIds).length > 0;

  function editId(key: string, value: string) {
    setNotice("");
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  async function saveTemplates() {
    if (saving || !dirty) return;
    const scope = municipalityId;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await api.saveEmailTemplates(changedIds, scope);
      if (activeId.current === scope) { apply(next); setDrafts({}); setNotice("Templates salvos. Valem para todos os municípios."); }
    } catch (failure) {
      if (activeId.current === scope) setError(messageOf(failure, "Não foi possível salvar os templates."));
    } finally { setSaving(false); }
  }

  async function toggle(row: EmailUseRow) {
    if (saving || !municipalityId) return;
    const scope = municipalityId;
    const turnOn = !(row.active && row.configured);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await api.setEmailUseActive(scope, row.key, turnOn);
      if (activeId.current === scope) apply(next);
    } catch (failure) {
      if (activeId.current === scope) setError(messageOf(failure, "Não foi possível alterar a mensagem."));
    } finally { setSaving(false); }
  }

  return { settings, drafts, dirty, loading, saving, error, notice, ready: Boolean(settings), retry, editId, saveTemplates, toggle };
}
