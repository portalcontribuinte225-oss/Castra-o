import { useEffect, useState } from "react";
import { api } from "../../api";
import { CONFIG_KEYS } from "../../domain";

const optionKeys = [CONFIG_KEYS.requestTypes, CONFIG_KEYS.identificationTypes, CONFIG_KEYS.documentTypes, CONFIG_KEYS.species, CONFIG_KEYS.sizes, CONFIG_KEYS.breeds, CONFIG_KEYS.neighborhoods, "ai"];

// The municipality's own record (its name and department), which the declaration of the request names. Without it the declaration
// still reads well ("a Prefeitura"), so it never keeps the form from opening.
export const MUNICIPALITY_OPTION = "municipality";

async function loadMunicipality(municipalityId: string) {
  try {
    const list = await api.getMunicipalities();
    return (Array.isArray(list) ? list : []).find((item: { id?: string }) => item.id === municipalityId) || null;
  } catch {
    return null;
  }
}

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
      loadMunicipality(municipalityId).then((municipality) => [MUNICIPALITY_OPTION, municipality] as const),
    ])
      .then((entries) => { if (!cancelled) setOptions(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar as opções do município."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [municipalityId, attempt]);
  return { options, loading, error, retry: () => setAttempt((current) => current + 1) };
}
