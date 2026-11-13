import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { RegisteredRequestContext } from "./registered-animal-types";

export function useRegisteredContext(animalId: string, requestTypeId: string) {
  const [context, setContext] = useState<RegisteredRequestContext | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `${animalId}:${requestTypeId}`;
  useEffect(() => {
    if (!animalId) return;
    let cancelled = false;
    setLoading(true); setError("");
    api.getAnimalRequestContext(animalId, requestTypeId).then((result: RegisteredRequestContext) => {
      if (!cancelled) { setContext(result); setLoadedKey(key); }
    }).catch((failure) => { if (!cancelled) setError(failure instanceof ApiError ? failure.message : "Não foi possível preparar a solicitação para este animal."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [animalId, requestTypeId, attempt]);
  return { context, loading: loading || loadedKey !== key, error, ready: loadedKey === key && !loading && !error, retry: () => setAttempt((current) => current + 1) };
}
