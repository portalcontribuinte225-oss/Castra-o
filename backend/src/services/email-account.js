import { EMAIL_ID_PATTERN } from "../../../shared/email-contract.js";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { readPublicUrl } from "./public-url.js";
import { readServerCredential } from "./server-credentials.js";

const KEY_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,200}$/;

// The platform's EmailJS account, read from the environment. The private key is required: without it anyone who knows the
// service and the public key could send through the account. The public address comes along for the images of the e-mails.
export function readEmailAccount(env = process.env) {
  const read = (variable, pattern) => readServerCredential(variable, (value) => pattern.test(value), env).value;
  return {
    serviceId: read(ServerCredential.EMAILJS_SERVICE_ID, EMAIL_ID_PATTERN),
    publicKey: read(ServerCredential.EMAILJS_PUBLIC_KEY, KEY_PATTERN),
    privateKey: read(ServerCredential.EMAILJS_PRIVATE_KEY, KEY_PATTERN),
    publicUrl: readPublicUrl(env).url,
  };
}

export function isEmailAccountConfigured(account) {
  return Boolean(account?.serviceId && account?.publicKey && account?.privateKey);
}
