import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra secrets salvos na tabela config (ex.: config.ai.apiKey) com AES-256-GCM.
 * Chave mestra vem de CONFIG_ENCRYPTION_KEY (32 bytes, base64), única por ambiente.
 *
 * Payload cifrado tem o prefixo ENC_PREFIX. Sem CONFIG_ENCRYPTION_KEY o valor é
 * gravado em texto plano; com a chave, um valor em texto plano é cifrado na
 * próxima escrita.
 */

const ENC_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

function strictEncryptionKey() {
  const raw = process.env.CONFIG_ENCRYPTION_KEY || "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw)) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 && key.toString("base64") === raw ? key : null;
}

const secureStorageError = () => Object.assign(new Error("O armazenamento seguro está indisponível."), { status: 503 });

export function encryptSecretStrict(plainText) {
  const key = strictEncryptionKey();
  if (!key || typeof plainText !== "string" || !plainText) throw secureStorageError();
  const iv = randomBytes(IV_LENGTH); const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${ENC_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`;
}

function getEncryptionKey() {
  const raw = process.env.CONFIG_ENCRYPTION_KEY || "";
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    console.warn("[config-secret-cipher] CONFIG_ENCRYPTION_KEY deve ter 32 bytes em base64; criptografia desativada.");
    return null;
  }
  return key;
}

/**
 * Cifra um texto. Se CONFIG_ENCRYPTION_KEY não estiver configurada, retorna o
 * texto original em claro (fallback seguro para não bloquear o ambiente).
 */
export function encryptSecret(plainText = "") {
  const text = String(plainText || "");
  if (!text) return "";
  const key = getEncryptionKey();
  if (!key) return text;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return `${ENC_PREFIX}${payload}`;
}

/**
 * Decifra um valor salvo por encryptSecret. Valores sem o prefixo esperado são
 * texto plano (gravados sem CONFIG_ENCRYPTION_KEY) e retornam como estão.
 */
export function decryptSecret(storedValue = "") {
  const value = String(storedValue || "");
  if (!isEncryptedSecret(value)) return value;
  const key = getEncryptionKey();
  if (!key) {
    console.warn("[config-secret-cipher] Valor cifrado encontrado mas CONFIG_ENCRYPTION_KEY ausente; retornando vazio.");
    return "";
  }
  try {
    const payload = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = payload.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (err) {
    console.warn("[config-secret-cipher] Falha ao decifrar secret:", err.message);
    return "";
  }
}
