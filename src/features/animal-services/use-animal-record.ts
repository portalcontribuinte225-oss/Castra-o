import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import type { AnimalRecord } from "./animal-service-types";

export function useAnimalRecord(animalId: string) {
  const [record, setRecord] = useState<AnimalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setLoading(true);
    setError("");
    api.consultAnimalById(animalId).then((result) => { if (!cancelled) setRecord(result); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar o prontuário deste animal."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [animalId, attempt]);

  return { record, loading, error, retry };
}
