import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import type { AccessChannel } from "./access-types";

interface ChannelsState {
  municipalityId: string;
  loading: boolean;
  error: string;
  channels: AccessChannel[];
}

// The channels the municipality can send the code by: e-mail, WhatsApp and SMS, each only while its message is on.
export function useAccessChannels(municipalityId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ChannelsState>({ municipalityId: "", loading: false, error: "", channels: [] });
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!municipalityId) return;
    let cancelled = false;
    setState({ municipalityId, loading: true, error: "", channels: [] });
    api.requestAccess.channels(municipalityId).then(({ channels }) => {
      if (!cancelled) setState({ municipalityId, loading: false, error: "", channels: Array.isArray(channels) ? channels : [] });
    }).catch(() => {
      if (!cancelled) setState({ municipalityId, loading: false, error: "Não foi possível carregar as formas de envio do código. Tente novamente.", channels: [] });
    });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  const current = state.municipalityId === municipalityId;
  const loading = Boolean(municipalityId) && (!current || state.loading);
  return { channels: current && !loading ? state.channels : [], loading, error: current ? state.error : "", retry };
}
