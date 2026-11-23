import { validateSmsToken } from "../../../shared/sms-contract.js";
import { ServerCredential } from "../../../shared/server-credential-contract.js";
import { readServerCredential } from "./server-credentials.js";

// SMSMais sandbox tokens start like this: they never send, so they count as no token.
const SANDBOX_TOKEN_PREFIX = "sbx_";

// The platform's SMSMais token (SMS_TOKEN) when it can send; "" when it is missing, malformed or a sandbox one.
export function readProductionSmsToken(env = process.env) {
  const { value } = readServerCredential(ServerCredential.SMS_TOKEN, (token) => !validateSmsToken(token), env);
  return value && !value.startsWith(SANDBOX_TOKEN_PREFIX) ? value : "";
}

// SMS is integrated when the server holds a production token.
export const isSmsIntegrated = (env = process.env) => Boolean(readProductionSmsToken(env));
