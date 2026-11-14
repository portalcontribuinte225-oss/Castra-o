import { AuthAudience } from "../../../shared/auth-contract.js";
import type { AuthAudienceValue } from "./auth-types";

export enum AuthEntryOrigin { STAFF = "staff-entry", REGISTERED_ANIMAL = "registered-animal", ENROLLMENT = "enrollment" }
export interface AuthEntryContext { origin: AuthEntryOrigin; audience: AuthAudienceValue; municipalityId: string }

export function createAuthEntryContext(origin: AuthEntryOrigin, municipalityId: string): AuthEntryContext | null {
  const audience = origin === AuthEntryOrigin.STAFF ? AuthAudience.STAFF : AuthAudience.TUTOR;
  if (audience === AuthAudience.TUTOR && !municipalityId) return null;
  return { origin, audience, municipalityId };
}

export function authEntryKey(context: AuthEntryContext) { return `${context.origin}:${context.audience}:${context.municipalityId}`; }
