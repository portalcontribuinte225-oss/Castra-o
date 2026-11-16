import { followUpContacts, normalizeFollowUp, validateFollowUp } from "../../../shared/notification-contract.js";

// What the person chose: whether they want to follow the request and by which of the contacts they gave in the Tutor step.
export interface FollowUpValue {
  enabled: boolean | null;
  useEmail: boolean;
  usePhone: boolean;
}

export const emptyFollowUp: FollowUpValue = { enabled: null, useEmail: true, usePhone: true };

// The contacts the tutor gave (or the profile has), as they were typed.
export interface TutorContacts {
  email: string;
  phone: string;
}

// The ones among them the municipality can reach: a valid e-mail, and the mobile phone only when it has a phone channel.
export function availableFollowUpContacts(contacts: TutorContacts, phoneEnabled: boolean): TutorContacts {
  return followUpContacts(contacts, { phoneEnabled });
}

// What the server is told: the contacts that were chosen and can be reached.
export function resolveFollowUp(value: FollowUpValue, contacts: TutorContacts, phoneEnabled: boolean) {
  const available = availableFollowUpContacts(contacts, phoneEnabled);
  return { enabled: value.enabled, email: value.useEmail ? available.email : "", phone: value.usePhone ? available.phone : "" };
}

export function getFollowUpIssues(value: FollowUpValue, contacts: TutorContacts, phoneEnabled: boolean): string[] {
  const issue = validateFollowUp(resolveFollowUp(value, contacts, phoneEnabled), { phoneEnabled });
  return issue ? [issue] : [];
}

export function buildFollowUpPayload(value: FollowUpValue, contacts: TutorContacts, phoneEnabled: boolean) {
  return normalizeFollowUp(resolveFollowUp(value, contacts, phoneEnabled), { phoneEnabled });
}

export function maskFollowUpEmail(email: string): string {
  const [name, domain] = email.split("@");
  return name && domain ? `${name[0]}*****@${domain}` : "";
}

export function maskFollowUpPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}` : "";
}
