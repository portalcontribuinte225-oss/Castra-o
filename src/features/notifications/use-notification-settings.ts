import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { NOTIFICATIONS_CONFIG_KEY, normalizeNotificationConfig } from "../../../shared/notification-contract.js";

// The municipality's choice for the automatic notices: whether the same notice also goes by WhatsApp. It saves as soon as it changes.
export function useNotificationSettings(municipalityId: string) {
  const [attempt, setAttempt] = useState(0);
  const [value, setValue] = useState(() => normalizeNotificationConfig());
  const [loadedId, setLoadedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeId = useRef(municipalityId);
  activeId.current = municipalityId;
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setValue(normalizeNotificationConfig());
    setLoadedId("");
    if (!municipalityId) return;
    setLoading(true);
    api.getConfig(NOTIFICATIONS_CONFIG_KEY, municipalityId).then((config) => {
      if (cancelled) return;
      setValue(normalizeNotificationConfig(config));
      setLoadedId(municipalityId);
    }).catch(() => {
      if (!cancelled) setError("Não foi possível carregar as notificações do município.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  async function setMultiChannel(multiChannel: boolean) {
    if (saving || loading || !municipalityId || loadedId !== municipalityId) return;
    const savedId = municipalityId;
    setSaving(true);
    setError("");
    try {
      const saved = await api.setConfig(NOTIFICATIONS_CONFIG_KEY, { multiChannel }, savedId);
      if (activeId.current === savedId) setValue(normalizeNotificationConfig(saved?.value));
    } catch {
      if (activeId.current === savedId) setError("Não foi possível salvar a opção. Verifique sua permissão e tente novamente.");
    } finally { setSaving(false); }
  }

  return { value, loading: loading || (Boolean(municipalityId) && loadedId !== municipalityId && !error), saving, error, ready: Boolean(municipalityId) && loadedId === municipalityId, retry, setMultiChannel };
}
