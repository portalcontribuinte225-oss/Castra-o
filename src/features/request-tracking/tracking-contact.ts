import { maskFollowUpEmail, maskFollowUpPhone } from "../request-follow-up/follow-up";

// The contact is echoed back masked; an unreadable one falls back to a neutral phrase.
export function maskTrackingContact(value: string): string {
  const text = value.trim();
  return (text.includes("@") ? maskFollowUpEmail(text) : maskFollowUpPhone(text)) || "o contato informado";
}
