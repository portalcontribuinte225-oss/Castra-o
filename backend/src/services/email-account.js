import { EMAIL_ID_PATTERN } from "../../../shared/email-contract.js";
import { secretPreview } from "../../../shared/secret-preview-contract.js";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { readPublicUrl } from "./public-url.js";
import { readServerCredential } from "./server-credentials.js";

const KEY_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,200}$/;

// The platform's EmailJS account, read from the environment. The private key is required: without it anyone who knows the
// service and the public key could send through the account. The public address comes along for the screen.
export function readEmailAccount(env = process.env) {
  const fields = {
    serviceId: readServerCredential(ServerCredential.EMAILJS_SERVICE_ID, (value) => EMAIL_ID_PATTERN.test(value), env),
    publicKey: readServerCredential(ServerCredential.EMAILJS_PUBLIC_KEY, (value) => KEY_PATTERN.test(value), env),
    privateKey: readServerCredential(ServerCredential.EMAILJS_PRIVATE_KEY, (value) => KEY_PATTERN.test(value), env),
  };
  const publicUrl = readPublicUrl(env);
  const issues = [
    [ServerCredential.EMAILJS_SERVICE_ID, fields.serviceId.issue],
    [ServerCredential.EMAILJS_PUBLIC_KEY, fields.publicKey.issue],
    [ServerCredential.EMAILJS_PRIVATE_KEY, fields.privateKey.issue],
    [ServerCredential.APP_PUBLIC_URL, publicUrl.issue],
  ].filter(([, problem]) => problem).map(([variable, problem]) => ({ variable, problem }));
  return { serviceId: fields.serviceId.value, publicKey: fields.publicKey.value, privateKey: fields.privateKey.value, publicUrl: publicUrl.url, issues };
}

export function isEmailAccountConfigured(account) {
  return Boolean(account?.serviceId && account?.publicKey && account?.privateKey);
}

// What the master screen reads: the private key never leaves, only how it starts, and which variables need fixing.
export function publicEmailAccount(account) {
  return {
    serviceId: account.serviceId,
    publicKey: account.publicKey,
    publicUrl: account.publicUrl,
    privateKeyPreview: secretPreview(account.privateKey),
    issues: account.issues,
  };
}
