import { api } from "../../api";
import type { AnyRecord } from "../../types";

// The record of a municipality as its documents show it: name, state, department, brasão and logo. Without it a document still
// reads well, so a failure here never stops one from being made.
export async function loadMunicipalityRecord(municipalityId: string): Promise<AnyRecord | null> {
  if (!municipalityId) return null;
  try {
    const list = await api.getMunicipalities();
    return (Array.isArray(list) ? list : []).find((item: AnyRecord) => item.id === municipalityId) || null;
  } catch {
    return null;
  }
}
