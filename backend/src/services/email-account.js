import { EMAIL_ACCOUNT_CONFIG_KEY, EMAIL_ID_PATTERN } from "../../../shared/email-contract.js";
import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { readEmailConfigValue, updateEmailConfigValue } from "../repositories/email-config.js";
import { AUDIT_ACTIONS } from "./audit.js";
import { decryptSecretStrict, encryptSecretStrict } from "./config-secret-cipher.js";

const KEY_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,200}$/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const ACCOUNT_FIELDS = ["serviceId", "publicKey", "privateKey", "clearPrivateKey", "publicUrl"];

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const pick = (next, current) => String(next === undefined ? current ?? "" : next).trim();

// The public address only builds the brasão link inside e-mails, so it is kept as an origin: no path, query or credentials.
// Plain http is accepted for a local address only, so a published system is always reached over https.
export function normalizePublicUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let url;
  try {
    url = new URL(text);
  } catch {
    throw fail("Informe o endereço público completo, por exemplo https://sistema.exemplo.com.br.");
  }
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname));
  if (!allowed || url.username || url.password) throw fail("O endereço público deve usar https, sem usuário nem senha.");
  return url.origin;
}

// Builds the stored value from a master save. Only known fields are kept; the private key is stored encrypted.
export function prepareEmailAccount(current = {}, input = {}) {
  const serviceId = pick(input.serviceId, current.serviceId);
  const publicKey = pick(input.publicKey, current.publicKey);
  if (serviceId && !EMAIL_ID_PATTERN.test(serviceId)) throw fail("O ID do serviço deve conter apenas letras, números, hífen e sublinhado.");
  if (publicKey && !KEY_PATTERN.test(publicKey)) throw fail("Chave pública inválida.");
  const nextKey = typeof input.privateKey === "string" ? input.privateKey.trim() : "";
  if (nextKey && !KEY_PATTERN.test(nextKey)) throw fail("Chave privada inválida.");
  const removeKey = input.clearPrivateKey === true;
  let privateKey = !removeKey && typeof current.privateKey === "string" ? current.privateKey : "";
  let privateKeyPreview = !removeKey && typeof current.privateKeyPreview === "string" ? current.privateKeyPreview : "";
  if (!removeKey && nextKey) {
    try {
      privateKey = encryptSecretStrict(nextKey);
    } catch {
      throw fail("O armazenamento seguro da chave privada do e-mail está indisponível.", 503);
    }
    privateKeyPreview = secretPreview(nextKey);
  }
  return { serviceId, publicKey, privateKey, privateKeyPreview, publicUrl: input.publicUrl === undefined ? String(current.publicUrl ?? "") : normalizePublicUrl(input.publicUrl) };
}

// What the master screen may read: the private key never leaves, only whether it exists and how it starts.
export function publicEmailAccount(value) {
  const source = asObject(value);
  const hasPrivateKey = Boolean(String(source.privateKey || "").trim());
  return {
    serviceId: String(source.serviceId || ""),
    publicKey: String(source.publicKey || ""),
    publicUrl: String(source.publicUrl || ""),
    hasPrivateKey,
    privateKeyPreview: hasPrivateKey ? String(source.privateKeyPreview || "") : "",
  };
}

// Sending needs the service and the public key; the private key is optional, as it always was.
export function isEmailAccountConfigured(account) {
  return Boolean(account?.serviceId && account?.publicKey);
}

export async function loadEmailAccount(database) {
  return asObject(await readEmailConfigValue(EMAIL_ACCOUNT_CONFIG_KEY, null, database));
}

// Read at every send, with no cache, so a change by the master applies at once. It throws when the stored key cannot be decrypted.
export async function getEmailRuntimeConfig(database) {
  const stored = await loadEmailAccount(database);
  return {
    serviceId: String(stored.serviceId || ""),
    publicKey: String(stored.publicKey || ""),
    publicUrl: String(stored.publicUrl || ""),
    privateKey: stored.privateKey ? decryptSecretStrict(stored.privateKey) : "",
  };
}

export async function saveEmailAccount({ input, audit, database } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw fail("Informe os dados da conta de e-mail.");
  const fields = ACCOUNT_FIELDS.filter((name) => input[name] !== undefined);
  const stored = await updateEmailConfigValue(EMAIL_ACCOUNT_CONFIG_KEY, null, (current) => prepareEmailAccount(asObject(current), input), {
    database,
    audit: audit && { ...audit, action: AUDIT_ACTIONS.EMAIL_ACCOUNT_UPDATE, entityType: "config", entityId: EMAIL_ACCOUNT_CONFIG_KEY, changes: { fields } },
  });
  return publicEmailAccount(stored);
}
