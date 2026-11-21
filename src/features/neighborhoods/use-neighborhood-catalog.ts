import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS } from "../../domain";
import type { AnyRecord } from "../../types";

interface CatalogResult {
  municipalityId: string;
  items: AnyRecord[] | null;
}

export function useNeighborhoodCatalog(municipalityId: string) {
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setResult(null);
    if (!municipalityId) return;

    let cancelled = false;
    api.getConfig(CONFIG_KEYS.neighborhoods, municipalityId).then((value) => {
      if (!cancelled) setResult({ municipalityId, items: Array.isArray(value) ? value : null });
    }).catch(() => {
      if (!cancelled) setResult({ municipalityId, items: null });
    });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);

  const current = result?.municipalityId === municipalityId ? result : null;
  return {
    items: current?.items ?? [],
    ready: Boolean(current?.items),
    failed: current?.items === null,
    retry: () => {
      setResult(null);
      setAttempt((value) => value + 1);
    },
  };
}
