import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { NOTIFICATIONS_CONFIG_KEY } from "../../../shared/notification-contract.js";

interface PolicyState {
  municipalityId: string;
  loading: boolean;
  error: string;
  phoneEnabled: boolean;
}

export async function loadFollowUpPolicy(municipalityId: string, readConfig = api.getConfig) {
  const [notifications, whatsapp] = await Promise.all([
    readConfig(NOTIFICATIONS_CONFIG_KEY, municipalityId),
    readConfig("whatsapp", municipalityId),
  ]);
  if (!notifications || notifications.emailEnabled !== true) throw new Error("Configuração indisponível.");
  return { phoneEnabled: whatsapp?.active === true };
}

export function useFollowUpPolicy(municipalityId: string, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PolicyState>({ municipalityId: "", loading: false, error: "", phoneEnabled: false });
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!enabled || !municipalityId) return;
    let cancelled = false;
    setState({ municipalityId, loading: true, error: "", phoneEnabled: false });
    loadFollowUpPolicy(municipalityId).then((policy) => {
      if (cancelled) return;
      setState({ municipalityId, loading: false, error: "", phoneEnabled: policy.phoneEnabled });
    }).catch(() => {
      if (!cancelled) setState({ municipalityId, loading: false, phoneEnabled: false, error: "Não foi possível carregar os canais de acompanhamento. Tente novamente." });
    });
    return () => { cancelled = true; };
  }, [municipalityId, enabled, attempt]);

  const current = state.municipalityId === municipalityId;
  const error = !municipalityId ? "Selecione um município para continuar." : current ? state.error : "";
  const loading = enabled && Boolean(municipalityId) && (!current || state.loading);
  return { phoneEnabled: enabled && current && !loading && !error && state.phoneEnabled, loading, error, retry, ready: !enabled || (current && !loading && !error) };
}
