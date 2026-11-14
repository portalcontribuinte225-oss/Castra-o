import { AuthAudience } from "../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../shared/notification-contract.js";

export type AuthAudienceValue = typeof AuthAudience[keyof typeof AuthAudience];
export type AuthChannel = typeof NotificationChannel[keyof typeof NotificationChannel];

export interface AuthRequestOptions {
  signal?: AbortSignal;
  isCurrent?: () => boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  role: string;
  municipalityId?: string;
  municipalityName?: string;
  municipalityState?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  mustChangePassword: boolean;
  profileComplete?: boolean;
}

export interface AuthChallenge {
  challengeId: string;
  expiresIn: number;
  retryAfter: number;
  serverNow?: string;
  expiresAt?: string;
  retryAt?: string;
  delivery?: Array<{ status?: string; reason?: string }>;
}

export interface RecoveryOption {
  id: string;
  channel: AuthChannel;
  maskedDestination: string;
}

export interface RecoveryOptions {
  recoveryToken: string;
  options: RecoveryOption[];
}

export interface RecoveryContext {
  audience: AuthAudienceValue;
  municipalityId: string;
}

export interface EnrollmentCredential {
  temporaryPassword: string;
  cpf: string;
  municipalityId: string;
  delivery?: { status?: string; reason?: string } | Array<{ status?: string; reason?: string }>;
}

export interface TutorProfile {
  id: string;
  name: string;
  cpf: string;
  municipalityId: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
}

export interface RecoveryTutor {
  id: string;
  name: string;
  cpf: string;
  maskedEmail?: string;
  maskedPhone?: string;
}
