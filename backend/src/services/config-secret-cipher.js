import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra secrets salvos na tabela config (ex.: config.ai.apiKey) com AES-256-GCM.
 * Chave mestra vem de CONFIG_ENCRYPTION_KEY (32 bytes, base64), única por ambiente.
 *
 * Payload cifrado tem o prefixo ENC_PREFIX para ser distinguível de valores
 * legados salvos em texto plano antes desta mudança — isso permite ler dados
 * antigos sem quebrar e cifrá-los apenas na próxima escrita (backfill implícito).
 */

const ENC_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

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
 * Decifra um valor salvo por encryptSecret. Valores sem o prefixo esperado
 * são tratados como texto plano legado e retornados como estão.
 */
export function decryptSecret(storedValue = "") {
  const value = String(storedValue || "");
  if (!value.startsWith(ENC_PREFIX)) return value;
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
