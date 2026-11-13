import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { AuthChallenge, TutorProfile } from "./auth-types";
import { DeliveryStatus } from "../../../shared/notification-contract.js";

export function useTutorProfile() {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    api.getTutorProfile().then((data) => { if (!cancelled) setProfile(data.profile); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar seu perfil."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  async function requestCode(kind: string, value: string, currentPassword: string) {
    if (saving) return false;
    setSaving(true); setError("");
    try {
      const result = await api.requestContactChallenge({ kind, value, currentPassword });
      setChallenge(result);
      if (!Array.isArray(result.delivery) || !result.delivery.some((delivery) => delivery.status === DeliveryStatus.SENT)) setError("O envio do código não foi confirmado. Aguarde o intervalo e tente novamente.");
      return true;
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível enviar o código ao contato novo."); return false; }
    finally { setSaving(false); }
  }
  async function confirm(code: string) {
    if (!challenge || saving) return false;
    setSaving(true); setError("");
    try {
      const result = await api.confirmContactChallenge(challenge.challengeId, code);
      setProfile(result.profile); setChallenge(null);
      return true;
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : "Não foi possível confirmar o contato."); return false; }
    finally { setSaving(false); }
  }
  return { profile, loading, saving, error, challenge, requestCode, confirm, cancel: () => { setChallenge(null); setError(""); }, retry: () => setAttempt((current) => current + 1) };
}
