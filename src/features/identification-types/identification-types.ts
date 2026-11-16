import { normalizeText } from "../../utils";

export interface IdentificationType {
  id: string;
  name: string;
  active?: boolean;
  municipalityId?: string;
  // Off, a request made with this type does not ask for the tutor's data.
  stepTutor?: boolean;
}

type IdentificationTypeLike = Partial<IdentificationType>;

export function hasDuplicateIdentificationTypeName(items: IdentificationTypeLike[], name: string, ignoreId?: string): boolean {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return false;
  return items.some((item) => item.id !== ignoreId && normalizeText(item.name ?? "") === normalizedName);
}
