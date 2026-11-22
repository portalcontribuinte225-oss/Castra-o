import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS } from "../../domain";
import { loadMunicipalityRecord } from "../municipal-documents/document-municipality";

const optionKeys = [CONFIG_KEYS.requestTypes, CONFIG_KEYS.documentTypes, CONFIG_KEYS.species, CONFIG_KEYS.sizes, CONFIG_KEYS.breeds, CONFIG_KEYS.neighborhoods, "ai"];

// The municipality's own record: the declaration names it and the requirement shows its header. Without it both still read well,
// so it never keeps the form from opening.
export const MUNICIPALITY_OPTION = "municipality";

export function useRequestOptions(municipalityId: string) {
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setOptions({});
    Promise.all([
      ...optionKeys.map(async (key) => [key, await api.getConfig(key, municipalityId)] as const),
      loadMunicipalityRecord(municipalityId).then((municipality) => [MUNICIPALITY_OPTION, municipality] as const),
    ])
      .then((entries) => { if (!cancelled) setOptions(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar as opções do município."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);
  return { options, loading, error, retry: () => setAttempt((current) => current + 1) };
}
