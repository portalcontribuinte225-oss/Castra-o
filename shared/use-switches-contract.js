const asObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// Reads a stored `{ active: { <use>: boolean } }` row for a list of uses: only known uses survive, and an explicit `false`
// is kept because some uses start on. Every channel with per-use switches (e-mail, SMS) reads its rows through here.
export function normalizeUseSwitches(stored, uses) {
  const active = asObject(asObject(stored).active);
  return Object.fromEntries(uses.filter(({ key }) => typeof active[key] === "boolean").map(({ key }) => [key, active[key]]));
}

export function isUseOn(switches, use) {
  const stored = asObject(switches)[use?.key];
  return typeof stored === "boolean" ? stored : use?.defaultActive === true;
}
