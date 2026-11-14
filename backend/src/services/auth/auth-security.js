import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { validateNewPassword } from "../../../../shared/auth-contract.js";

export function authError(status, message, code) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

export function authenticatedDigest(purpose, ...values) {
  if (!process.env.JWT_SECRET) throw authError(503, "Autenticação indisponível.");
  return createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify([purpose, ...values])).digest("hex");
}

export function safeDigestEqual(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || "")) || !/^[a-f0-9]{64}$/i.test(String(right || ""))) return false;
  const a = Buffer.from(String(left || ""), "hex");
  const b = Buffer.from(String(right || ""), "hex");
  return a.length === 32 && b.length === 32 && timingSafeEqual(a, b);
}

export function requireNewPassword(value) {
  const error = validateNewPassword(value);
  if (error) throw authError(400, error);
  return value;
}

export function temporaryPassword() { return randomBytes(18).toString("base64url"); }
export function verificationCode() { return String(randomInt(100000, 1000000)); }
export function maskEmail(value = "") {
  const [local, domain] = String(value || "").split("@");
  return domain ? `${local.slice(0, 1)}*****@${domain}` : "";
}
export function maskPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}` : "";
}
