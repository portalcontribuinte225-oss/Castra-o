import { normalizeText } from "../../utils";
import type { StepToggles } from "../request-steps/request-steps";

export interface IdentificationType extends StepToggles {
  id: string;
  name: string;
  active?: boolean;
  municipalityId?: string;
}

type IdentificationTypeLike = Partial<IdentificationType>;

export function getActiveIdentificationTypes<T extends IdentificationTypeLike>(items: T[] | null | undefined): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item?.active !== false && typeof item?.name === "string" && item.name.trim() !== "");
}

// Falls back to the first active type when the stored id is empty, unknown or inactive.
export function resolveSelectedIdentificationType<T extends IdentificationTypeLike>(activeTypes: T[], selectedId: string): T | null {
  const selected = selectedId ? activeTypes.find((type) => type.id === selectedId) : undefined;
  return selected ?? activeTypes[0] ?? null;
}

export function hasDuplicateIdentificationTypeName(items: IdentificationTypeLike[], name: string, ignoreId?: string): boolean {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return false;
  return items.some((item) => item.id !== ignoreId && normalizeText(item.name ?? "") === normalizedName);
}
