import { LEGACY_DOCUMENTS_REVIEWED, NotificationEvent } from "./notification-contract.js";

const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// The single document-review value was used for both outcomes. Known-use normalization drops its old key on write.
export function inheritDocumentNoticeValues(stored) {
  const values = asObject(stored);
  if (!Object.hasOwn(values, LEGACY_DOCUMENTS_REVIEWED)) return values;
  const notices = { ...values };
  for (const key of [NotificationEvent.DOCUMENTS_APPROVED, NotificationEvent.DOCUMENTS_REJECTED]) {
    if (!Object.hasOwn(values, key)) notices[key] = values[LEGACY_DOCUMENTS_REVIEWED];
  }
  return notices;
}

// Reads a stored `{ active: { <use>: boolean } }` row for a list of uses: only known uses survive, and an explicit `false`
// is kept because some uses start on. Every channel with per-use switches (e-mail, SMS) reads its rows through here.
export function normalizeUseSwitches(stored, uses) {
  const active = inheritDocumentNoticeValues(asObject(stored).active);
  return Object.fromEntries(uses.filter(({ key }) => typeof active[key] === "boolean").map(({ key }) => [key, active[key]]));
}

export function isUseOn(switches, use) {
  const stored = asObject(switches)[use?.key];
  return typeof stored === "boolean" ? stored : use?.defaultActive === true;
}
