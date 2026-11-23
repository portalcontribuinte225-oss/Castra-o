import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";

interface PolicyState {
  municipalityId: string;
  loading: boolean;
  error: string;
  phoneEnabled: boolean;
}

// E-mail is always asked; the phone is asked as soon as the municipality can reach it, by WhatsApp (its key and sender number are set)
// or by SMS (integrated, with the municipality's contract on and in force).
export async function loadFollowUpPolicy(municipalityId: string, readConfig = api.getConfig, readSmsAvailability = api.getSmsAvailability) {
  const [whatsapp, sms] = await Promise.all([
    readConfig("whatsapp", municipalityId),
    readSmsAvailability(municipalityId),
  ]);
  return { phoneEnabled: whatsapp?.active === true || sms?.active === true };
}

export function useFollowUpPolicy(municipalityId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PolicyState>({ municipalityId: "", loading: false, error: "", phoneEnabled: false });
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!municipalityId) return;
    let cancelled = false;
    setState({ municipalityId, loading: true, error: "", phoneEnabled: false });
    loadFollowUpPolicy(municipalityId).then((policy) => {
      if (cancelled) return;
      setState({ municipalityId, loading: false, error: "", phoneEnabled: policy.phoneEnabled });
    }).catch(() => {
      if (!cancelled) setState({ municipalityId, loading: false, phoneEnabled: false, error: "Não foi possível carregar os canais de acompanhamento. Tente novamente." });
    });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  const current = state.municipalityId === municipalityId;
  const error = !municipalityId ? "Selecione um município para continuar." : current ? state.error : "";
  const loading = Boolean(municipalityId) && (!current || state.loading);
  return { phoneEnabled: current && !loading && !error && state.phoneEnabled, loading, error, retry, ready: current && !loading && !error };
}
