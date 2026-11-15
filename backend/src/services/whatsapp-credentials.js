import { encryptSecretStrict } from "./config-secret-cipher.js";

const ID_PATTERN = /^\d{5,30}$/;
const MAX_TOKEN_LENGTH = 1000;
// Only the start of the token is kept readable, so the screen can show which token is saved.
const TOKEN_PREVIEW_LENGTH = 8;

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function pick(next, current) {
  return String(next === undefined ? current ?? "" : next).trim();
}

// Builds the stored value from an admin save. Only known fields are kept, so removed settings disappear on the next save.
export function prepareWhatsappCredentials(current = {}, input = {}) {
  const phoneNumberId = pick(input.phoneNumberId, current.phoneNumberId);
  const wabaId = pick(input.wabaId, current.wabaId);
  if (phoneNumberId && !ID_PATTERN.test(phoneNumberId)) throw fail("O ID do número de telefone deve conter apenas dígitos.");
  if (wabaId && !ID_PATTERN.test(wabaId)) throw fail("O ID da conta do WhatsApp Business deve conter apenas dígitos.");
  const nextToken = typeof input.accessToken === "string" ? input.accessToken.trim() : "";
  if (nextToken.length > MAX_TOKEN_LENGTH) throw fail("Token do WhatsApp inválido.");
  const removeToken = input.clearAccessToken === true;
  let accessToken = !removeToken && typeof current.accessToken === "string" ? current.accessToken : "";
  let tokenPreview = !removeToken && typeof current.tokenPreview === "string" ? current.tokenPreview : "";
  if (!removeToken && nextToken) {
    try {
      accessToken = encryptSecretStrict(nextToken);
    } catch {
      throw fail("O armazenamento seguro do token do WhatsApp está indisponível.", 503);
    }
    tokenPreview = nextToken.slice(0, TOKEN_PREVIEW_LENGTH);
  }
  return {
    // Without a token the channel cannot send, so removing it also turns the channel off.
    active: removeToken ? false : input.active === undefined ? current.active === true : input.active === true,
    provider: "cloud_api",
    phoneNumberId,
    wabaId,
    accessToken,
    tokenPreview,
  };
}

// Visitors only learn whether the channel is on (the public follow-up form needs that); staff also see the identifiers.
export function publicWhatsappConfig(value, internalViewer = false) {
  const source = value && typeof value === "object" ? value : {};
  const active = source.active === true;
  if (!internalViewer) return { active };
  return {
    active,
    provider: "cloud_api",
    phoneNumberId: String(source.phoneNumberId || ""),
    wabaId: String(source.wabaId || ""),
    hasAccessToken: Boolean(String(source.accessToken || "").trim()),
    tokenPreview: String(source.accessToken || "").trim() ? String(source.tokenPreview || "") : "",
  };
}
