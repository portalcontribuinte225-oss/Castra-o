import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { normalizeEmailStatus } from "../../../shared/email-contract.js";

export type EmailStatus = ReturnType<typeof normalizeEmailStatus>;

export function useEmailStatus(municipalityId: string, canManage: boolean) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError("");
    if (!municipalityId || !canManage) { setLoading(false); return; }
    setLoading(true);
    api.getEmailIntegrationStatus(municipalityId).then((data) => { if (!cancelled) setStatus(normalizeEmailStatus(data)); })
      .catch(() => { if (!cancelled) setError("Não foi possível consultar a integração de e-mail."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, canManage, attempt]);

  return { status, loading, error, retry };
}
