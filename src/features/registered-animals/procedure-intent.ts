import { AuthAudience } from "../../../shared/auth-contract.js";
import type { SessionUser } from "../tutor-access/auth-types";

export interface ProcedureIntent {
  municipalityId: string;
  schedule?: string;
  requestTypeId?: string;
  ownerId?: string;
}

export function bindProcedureIntent(intent: ProcedureIntent | null, user: SessionUser | null): ProcedureIntent | null {
  if (!intent || !user || user.role !== AuthAudience.TUTOR || user.municipalityId !== intent.municipalityId || (intent.ownerId && intent.ownerId !== user.id)) return null;
  return { ...intent, ownerId: user.id };
}
