import { isContractInForce } from "../../../shared/message-quota-contract.js";
import { isSmsIntegrated } from "./sms-credential.js";
import { getRuntimeConfig } from "./whatsapp.js";
import { isWhatsappReady } from "./whatsapp-credentials.js";

// The follow-up form asks for a phone as soon as the municipality can reach one: by WhatsApp (its key and sender number are set) or by
// SMS (integrated, with the municipality's contract on and in force).
export function canReachByPhone({ whatsapp, smsQuota } = {}, env = process.env) {
  return isWhatsappReady(getRuntimeConfig(whatsapp || {}, env)) || (isSmsIntegrated(env) && isContractInForce(smsQuota));
}
