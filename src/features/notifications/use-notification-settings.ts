import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { NOTIFICATIONS_CONFIG_KEY, normalizeNotificationConfig } from "../../../shared/notification-contract.js";

export type NotificationChannel = "email" | "whatsapp";

// Each channel tab saves only its own fields; the server merges them into the stored value.
export function notificationChannelPatch(value: ReturnType<typeof normalizeNotificationConfig>, channel: NotificationChannel) {
  return channel === "email" ? { emailTemplateId: value.emailTemplateId } : { whatsappTemplates: value.whatsappTemplates };
}

export function useNotificationSettings(municipalityId: string, channel: NotificationChannel) {
  const [attempt, setAttempt] = useState(0);
  const [value, setValue] = useState(() => normalizeNotificationConfig());
  const [loadedId, setLoadedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const activeId = useRef(municipalityId);
  activeId.current = municipalityId;
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setSuccess(false);
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

  async function save() {
    if (saving || loading || !municipalityId || loadedId !== municipalityId) return;
    const savedId = municipalityId;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const saved = await api.setConfig(NOTIFICATIONS_CONFIG_KEY, notificationChannelPatch(normalizeNotificationConfig(value), channel), savedId);
      if (activeId.current !== savedId) return;
      setValue(normalizeNotificationConfig(saved?.value));
      setSuccess(true);
    } catch {
      if (activeId.current === savedId) setError("Não foi possível salvar as notificações. Verifique sua permissão e tente novamente.");
    } finally { setSaving(false); }
  }

  return { value, setValue, loading: loading || (Boolean(municipalityId) && loadedId !== municipalityId && !error), saving, error, success, ready: Boolean(municipalityId) && loadedId === municipalityId, retry, save };
}
