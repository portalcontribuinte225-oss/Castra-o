export function stripEphemeralCredentials(value: Record<string, unknown>) {
  const { credential, temporaryPassword, temporary_password, password, ...record } = value;
  return record;
}

export function stripMunicipalityBootstrap(value: Record<string, unknown>) {
  const { defaultUser, default_user, defaultSector, default_sector, ...municipality } = stripEphemeralCredentials(value);
  return municipality;
}

// The answer to a new request carries only the request.
export function readSubmittedRequest(value: { request: Record<string, unknown> }) {
  if (!value?.request || typeof value.request !== "object" || Array.isArray(value.request)) {
    throw new Error("Resposta de solicitação inválida. Confira o protocolo antes de tentar enviar novamente.");
  }
  return stripEphemeralCredentials(value.request);
}
