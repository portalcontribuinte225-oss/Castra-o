import { AuthAudience } from "../../../../shared/auth-contract.js";
import { NotificationChannel } from "../../../../shared/notification-contract.js";

export function normalizeAuthEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizeAuthPhone(value) {
  let phone = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (phone.length >= 12 && phone.startsWith("55")) phone = phone.slice(2);
  return /^[1-9]\d{9,10}$/.test(phone) ? phone : "";
}

export function recoveryContacts(user) {
  const tutor = user.role === AuthAudience.TUTOR;
  const email = normalizeAuthEmail(tutor ? user.profile_email : user.email);
  const phone = tutor ? normalizeAuthPhone(user.profile_phone) : "";
  return { [NotificationChannel.EMAIL]: email, [NotificationChannel.WHATSAPP]: phone, [NotificationChannel.SMS]: phone };
}
