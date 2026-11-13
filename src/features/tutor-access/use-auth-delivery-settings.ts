import { useEffect, useState } from "react";
import { api } from "../../api";
import { AUTH_DELIVERY_CONFIG_KEY, normalizeAuthDeliveryConfig } from "../../../shared/auth-contract.js";

export function useAuthDeliverySettings(municipalityId: string) {
  const [value, setValue] = useState(() => normalizeAuthDeliveryConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setValue(normalizeAuthDeliveryConfig()); setReady(false); setError(""); setSuccess(false);
    if (!municipalityId) { setLoading(false); return; }
    setLoading(true);
    api.getConfig(AUTH_DELIVERY_CONFIG_KEY, municipalityId).then((data) => { if (!cancelled) { setValue(normalizeAuthDeliveryConfig(data)); setReady(true); } })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar os templates de acesso."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);
  async function save() {
    if (!ready || !municipalityId || saving) return;
    setSaving(true); setError(""); setSuccess(false);
    try { const saved = await api.setConfig(AUTH_DELIVERY_CONFIG_KEY, normalizeAuthDeliveryConfig(value), municipalityId); setValue(normalizeAuthDeliveryConfig(saved.value)); setSuccess(true); }
    catch { setError("Não foi possível salvar os templates de acesso. Verifique sua permissão e tente novamente."); }
    finally { setSaving(false); }
  }
  return { value, setValue, loading, saving, ready, error, success, save, retry: () => setAttempt((current) => current + 1) };
}
