import { useEffect, useState } from "react";
import type { AnyRecord } from "../../types";
import { api } from "../../api";
import { AdoptionStatus, readAdoptionShareId } from "../../../shared/adoption-contract.js";

export enum SharedAdoptionState {
  NONE = "none",
  LOADING = "loading",
  AVAILABLE = "available",
  ADOPTED = "adopted",
  MISSING = "missing",
}

export interface SharedAdoption {
  id: string;
  state: SharedAdoptionState;
  animal: AnyRecord | null;
}

// The animal of the shared link the public page was opened with: read from the address once, then fetched. The page
// switches to the animal's municipality, and the address goes back to the home page.
export function useSharedAdoption(enabled: boolean, onMunicipality: (municipalityId: string) => void): SharedAdoption {
  const [id] = useState(() => (enabled ? readAdoptionShareId(window.location.pathname) : ""));
  const [result, setResult] = useState<Omit<SharedAdoption, "id">>(() => ({
    state: id ? SharedAdoptionState.LOADING : SharedAdoptionState.NONE,
    animal: null,
  }));

  useEffect(() => {
    if (!id) return undefined;
    window.history.replaceState(window.history.state, "", "/");
    let current = true;
    api.getPublicAdoption(id)
      .then((animal: AnyRecord) => {
        if (!current) return;
        if (animal?.municipality_id) onMunicipality(animal.municipality_id);
        setResult({ state: animal?.status === AdoptionStatus.ADOPTED ? SharedAdoptionState.ADOPTED : SharedAdoptionState.AVAILABLE, animal });
      })
      .catch(() => {
        if (current) setResult({ state: SharedAdoptionState.MISSING, animal: null });
      });
    return () => {
      current = false;
    };
  }, [id]);

  return { id, ...result };
}
