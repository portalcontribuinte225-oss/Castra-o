import type { EnrollmentCredential } from "./auth-types";

export function stripEphemeralCredentials(value: Record<string, unknown>) {
  const { enrollment, credential, temporaryPassword, temporary_password, password, ...record } = value;
  return record;
}

export function stripMunicipalityBootstrap(value: Record<string, unknown>) {
  const { defaultUser, default_user, defaultSector, default_sector, ...municipality } = stripEphemeralCredentials(value);
  return municipality;
}

export function splitSubmissionEnvelope(value: { request: Record<string, unknown>; enrollment?: EnrollmentCredential }) {
  if (!value?.request || typeof value.request !== "object" || Array.isArray(value.request)) {
    throw new Error("Resposta de solicitação inválida. Confira o protocolo antes de tentar enviar novamente.");
  }
  return { request: stripEphemeralCredentials(value.request), enrollment: value.enrollment };
}
