import { followUpContacts, normalizeFollowUp, validateFollowUp } from "../../../shared/notification-contract.js";

// What the person chose: whether they want the notices about the request, or null while the question has no answer (nothing is chosen
// for them). The notices go to the contacts typed in the first step (or the profile's).
export interface FollowUpValue {
  enabled: boolean | null;
}

export const emptyFollowUp: FollowUpValue = { enabled: null };

// The contacts typed in the first step (or the profile has), as they were typed.
export interface TutorContacts {
  email: string;
  phone: string;
}

// The ones among them the municipality can reach: a valid e-mail, and the mobile phone only when it has a phone channel.
export function availableFollowUpContacts(contacts: TutorContacts, phoneEnabled: boolean): TutorContacts {
  return followUpContacts(contacts, { phoneEnabled });
}

// What the server is told: every contact that exists and can be reached.
export function resolveFollowUp(value: FollowUpValue, contacts: TutorContacts, phoneEnabled: boolean) {
  const available = availableFollowUpContacts(contacts, phoneEnabled);
  return { enabled: value.enabled === true, email: available.email, phone: available.phone };
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
