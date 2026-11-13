import { normalizeFollowUp, validateFollowUp } from "../../../shared/notification-contract.js";

export interface FollowUpValue {
  enabled: boolean | null;
  email: string;
  phone: string;
}

export const emptyFollowUp: FollowUpValue = { enabled: null, email: "", phone: "" };

export function getFollowUpIssues(value: FollowUpValue, phoneEnabled: boolean): string[] {
  const issue = validateFollowUp(value, { whatsappEnabled: phoneEnabled });
  return issue ? [issue] : [];
}

export function buildFollowUpPayload(value: FollowUpValue, phoneEnabled: boolean) {
  return normalizeFollowUp(value, { whatsappEnabled: phoneEnabled });
}

export function maskFollowUpEmail(email: string): string {
  const [name, domain] = email.split("@");
  return name && domain ? `${name[0]}*****@${domain}` : "";
}

export function maskFollowUpPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}` : "";
}
