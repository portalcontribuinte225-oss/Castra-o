import { RequestStatus } from "./request-contract.js";

const DAY_MS = 86400000;
export function scheduleDate(value) {
  const input = String(value || "");
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/) || input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [year, month, day] = input.includes("-") ? match.slice(1).map(Number) : [Number(match[3]), Number(match[2]), Number(match[1])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || year < 2000 || year > 2200) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function displayScheduleDate(value) {
  const iso = scheduleDate(value);
  return iso ? iso.split("-").reverse().join("/") : "";
}
export function normalizeSlots(slots, time = "08:00", vacancies = 0) {
  const source = Array.isArray(slots) && slots.length ? slots : [{ time, vacancies }];
  const seen = new Set();
  return source.filter((slot) => slot && /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time) && Number.isSafeInteger(Number(slot.vacancies)) && Number(slot.vacancies) > 0)
    .filter((slot) => { if (seen.has(slot.time)) return false; seen.add(slot.time); return true; })
    .map((slot) => ({ time: slot.time, vacancies: Number(slot.vacancies) })).sort((a, b) => a.time.localeCompare(b.time));
}
export function resizeScheduleSlots(slots, total, time = "08:00") {
  const current = normalizeSlots(slots);
  if (!total) return [];
  if (!current.length) return normalizeSlots([], time, total);
  let remaining = total;
  return current.map((slot, index) => {
    const vacancies = index === current.length - 1 ? remaining : Math.min(slot.vacancies, remaining);
    remaining -= vacancies;
    return { time: slot.time, vacancies };
  }).filter((slot) => slot.vacancies > 0);
}
function occurrence(value, key, fallback = {}) {
  const date = scheduleDate(value.date || value.start);
  if (!date) return null;
  const slots = normalizeSlots(value.slots, value.time || fallback.time, value.vacancies ?? fallback.vacancies);
  return {
    id: value.id || key, occurrenceKey: key, date: displayScheduleDate(date), active: value.active !== false && fallback.active !== false,
    slots, vacancies: slots.reduce((sum, slot) => sum + slot.vacancies, 0), startTime: slots[0]?.time || "",
    scheduleRuleId: value.schedule_rule_id || value.scheduleRuleId || fallback.id || "",
    kind: value.kind || fallback.kind || "", locationName: value.location_name || value.locationName || fallback.locationName || "",
    locationAddress: value.location_address || value.locationAddress || fallback.locationAddress || "", addressUrl: value.address_url || value.addressUrl || fallback.addressUrl || "",
  };
}
export function buildScheduleOccurrences(stored, rules, from, to) {
  const days = new Map();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule?.id || rule.active === false || rule.unavailable) continue;
    const kind = String(rule.kind || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (kind === "mutirao" && Array.isArray(rule.occurrences) && rule.occurrences.length) {
      rule.occurrences.forEach((item, index) => {
        const day = occurrence(item, `rule:${rule.id}:${item.id || index}:${scheduleDate(item.date || item.start)}`, rule);
        if (day && day.active && scheduleDate(day.date) >= from && scheduleDate(day.date) <= to) days.set(day.occurrenceKey, day);
      });
      continue;
    }
    const first = scheduleDate(rule.start), last = scheduleDate(rule.end || rule.start);
    if (!first || !last || !Array.isArray(rule.weekdays)) continue;
    const repeatEvery = Number(rule.repeatEvery ?? 1);
    if (!Number.isSafeInteger(repeatEvery) || repeatEvery < 1) continue;
    const start = Math.max(Date.parse(`${first}T00:00:00Z`), Date.parse(`${from}T00:00:00Z`));
    const end = Math.min(Date.parse(`${last}T00:00:00Z`), Date.parse(`${to}T00:00:00Z`));
    for (let instant = start; instant <= end; instant += DAY_MS) {
      const date = new Date(instant);
      if (!rule.weekdays.includes(date.getUTCDay())) continue;
      const weekDistance = Math.floor((instant - Date.parse(`${first}T00:00:00Z`)) / (7 * DAY_MS));
      if (weekDistance % repeatEvery !== 0) continue;
      const iso = date.toISOString().slice(0, 10);
      const day = occurrence({ ...rule, date: iso }, `rule:${rule.id}:${iso}`, rule);
      if (day?.active) days.set(day.occurrenceKey, day);
    }
  }
  for (const value of stored) {
    const iso = scheduleDate(value.date);
    if (!iso || iso < from || iso > to) continue;
    const ruleId = value.schedule_rule_id || value.scheduleRuleId;
    // Stored occurrences override their rule's generated date without collapsing other locations.
    if (ruleId) for (const [key, day] of days) if (key.startsWith("rule:") && day.scheduleRuleId === ruleId && scheduleDate(day.date) === iso) days.delete(key);
    const day = occurrence(value, `day:${value.id}`);
    if (day?.active) days.set(day.occurrenceKey, day);
  }
  return [...days.values()].sort((a, b) => scheduleDate(a.date).localeCompare(scheduleDate(b.date)) || a.occurrenceKey.localeCompare(b.occurrenceKey));
}
export function allocateScheduleAvailability(days, requests) {
  const output = days.map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, remaining: slot.vacancies })) }));
  for (const request of requests) {
    if (request.status === RequestStatus.CANCELLED) continue;
    const workflow = request.workflow_data || {};
    const date = scheduleDate(request.schedule_date);
    const matches = output.filter((day) => scheduleDate(day.date) === date);
    const exact = workflow.scheduleOccurrenceKey ? matches.filter((day) => day.occurrenceKey === workflow.scheduleOccurrenceKey) : [];
    // Unknown/ambiguous legacy occurrence consumes conservatively in every matching location.
    const targets = exact.length ? exact : matches;
    for (const day of targets) {
      let count = Math.max(Array.isArray(request.animals) ? request.animals.length : 0, 1);
      const time = workflow.scheduleSlotTime || workflow.scheduleTime;
      const slot = day.slots.find((candidate) => candidate.time === time);
      if (slot) {
        const used = Math.min(slot.remaining, count); slot.remaining -= used; count -= used;
      }
      for (const candidate of day.slots.filter((candidate) => candidate !== slot)) {
        const used = Math.min(candidate.remaining, count); candidate.remaining -= used; count -= used;
      }
    }
  }
  return output.map((day) => ({ ...day, remaining: day.slots.reduce((sum, slot) => sum + slot.remaining, 0) }));
}
